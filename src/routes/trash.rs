use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;

use crate::auth::{AdminUser, AuthUser};
use crate::dto::{
    CleanTrashResponse, FileDto, FolderDto, TrashFileDto, TrashFolderDto, TrashListing,
};
use crate::error::{ApiError, ApiResult};
use crate::models::{FileRow, FolderRow};
use crate::services::log_activity;
use crate::state::AppState;
use crate::storage;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/trash", get(get_trash))
        .route("/api/trash/restore/file/{public_id}", post(restore_file))
        .route(
            "/api/trash/restore/folder/{public_id}",
            post(restore_folder),
        )
        .route(
            "/api/trash/file/{public_id}",
            delete(delete_file_permanently),
        )
        .route(
            "/api/trash/folder/{public_id}",
            delete(delete_folder_permanently),
        )
        .route("/api/trash/clean", delete(clean_trash_user))
        .route("/api/trash/clean", post(clean_trash_admin))
}

async fn get_trash(State(state): State<AppState>, user: AuthUser) -> ApiResult<Json<TrashListing>> {
    let folders = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "UserId" = $1 AND "DeletedAt" IS NOT NULL
           ORDER BY "DeletedAt" DESC"#,
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let files = sqlx::query_as::<_, FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "UserId" = $1 AND "DeletedAt" IS NOT NULL
           ORDER BY "DeletedAt" DESC"#,
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let mut folder_dtos = Vec::with_capacity(folders.len());
    for folder in &folders {
        let parent_public_id = match folder.parent_id {
            Some(parent_id) => {
                sqlx::query_scalar::<_, String>(
                    r#"SELECT "PublicId" FROM "Folders" WHERE "Id" = $1"#,
                )
                .bind(parent_id)
                .fetch_optional(&state.db)
                .await?
            }
            None => None,
        };
        folder_dtos.push(TrashFolderDto {
            public_id: folder.public_id.clone(),
            name: folder.name.clone(),
            parent_public_id,
            created_at: folder.created_at,
            deleted_at: folder.deleted_at.unwrap_or_else(chrono::Utc::now),
        });
    }

    let mut file_dtos = Vec::with_capacity(files.len());
    for file in &files {
        let folder_public_id = match file.folder_id {
            Some(folder_id) => {
                sqlx::query_scalar::<_, String>(
                    r#"SELECT "PublicId" FROM "Folders" WHERE "Id" = $1"#,
                )
                .bind(folder_id)
                .fetch_optional(&state.db)
                .await?
            }
            None => None,
        };
        file_dtos.push(TrashFileDto {
            public_id: file.public_id.clone(),
            filename: file.filename.clone(),
            file_type: file.file_type.clone(),
            size: file.size,
            uploaded_at: file.uploaded_at,
            folder_public_id,
            deleted_at: file.deleted_at.unwrap_or_else(chrono::Utc::now),
        });
    }

    Ok(Json(TrashListing {
        folders: folder_dtos,
        files: file_dtos,
    }))
}

async fn restore_file(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Json<FileDto>> {
    let file = sqlx::query_as::<_, FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NOT NULL"#,
    )
    .bind(&public_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let mut file = file.ok_or_else(ApiError::not_found)?;

    if let Some(folder_id) = file.folder_id {
        let exists = sqlx::query_scalar::<_, bool>(
            r#"SELECT EXISTS(SELECT 1 FROM "Folders"
               WHERE "Id" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL)"#,
        )
        .bind(folder_id)
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
        if !exists {
            file.folder_id = None;
        }
    }

    let next_thumbnail = state.thumb.try_restore_thumbnail_from_trash(&file, user.id);
    let thumbnail = next_thumbnail.or(file.thumbnail_name.clone());

    sqlx::query(r#"UPDATE "Files" SET "DeletedAt" = NULL, "FolderId" = $1, "ThumbnailName" = $2 WHERE "Id" = $3"#)
        .bind(file.folder_id)
        .bind(thumbnail)
        .bind(file.id)
        .execute(&state.db)
        .await?;

    file.deleted_at = None;
    Ok(Json(FileDto::from_row(&file)))
}

async fn restore_folder(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Json<FolderDto>> {
    let folder = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NOT NULL"#,
    )
    .bind(&public_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let mut folder = folder.ok_or_else(ApiError::not_found)?;

    if let Some(parent_id) = folder.parent_id {
        let exists = sqlx::query_scalar::<_, bool>(
            r#"SELECT EXISTS(SELECT 1 FROM "Folders"
               WHERE "Id" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL)"#,
        )
        .bind(parent_id)
        .bind(user.id)
        .fetch_one(&state.db)
        .await?;
        if !exists {
            folder.parent_id = None;
        }
    }

    sqlx::query(r#"UPDATE "Folders" SET "ParentId" = $1 WHERE "Id" = $2"#)
        .bind(folder.parent_id)
        .bind(folder.id)
        .execute(&state.db)
        .await?;

    restore_folder_tree(&state, &folder, user.id).await?;

    let parent_public_id = match folder.parent_id {
        Some(parent_id) => {
            sqlx::query_scalar::<_, String>(r#"SELECT "PublicId" FROM "Folders" WHERE "Id" = $1"#)
                .bind(parent_id)
                .fetch_optional(&state.db)
                .await?
        }
        None => None,
    };

    Ok(Json(FolderDto {
        public_id: folder.public_id,
        name: folder.name,
        parent_public_id,
        created_at: folder.created_at,
    }))
}

async fn delete_file_permanently(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Response> {
    let file = sqlx::query_as::<_, FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NOT NULL"#,
    )
    .bind(&public_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let file = file.ok_or_else(ApiError::not_found)?;

    let full_path = storage::file_path(
        &state.config,
        file.user_id,
        file.folder_id,
        &file.stored_name,
    )
    .ok_or_else(|| ApiError::bad_request("Invalid storage path."))?;
    if full_path.is_file() {
        let _ = tokio::fs::remove_file(&full_path).await;
    }
    if let Some(thumb_path) = state.thumb.try_build_thumbnail_path(&file) {
        if thumb_path.is_file() {
            let _ = tokio::fs::remove_file(&thumb_path).await;
        }
    }

    sqlx::query(r#"DELETE FROM "Files" WHERE "Id" = $1"#)
        .bind(file.id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT.into_response())
}

async fn delete_folder_permanently(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Response> {
    let folder = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NOT NULL"#,
    )
    .bind(&public_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let folder = folder.ok_or_else(ApiError::not_found)?;

    delete_folder_tree(&state, &folder, user.id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

async fn clean_trash_user(
    State(state): State<AppState>,
    user: AuthUser,
) -> ApiResult<Json<CleanTrashResponse>> {
    let deleted_folders = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "UserId" = $1 AND "DeletedAt" IS NOT NULL"#,
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let deleted_ids: std::collections::HashSet<i32> =
        deleted_folders.iter().map(|f| f.id).collect();

    for folder in &deleted_folders {
        let is_root = match folder.parent_id {
            None => true,
            Some(parent_id) => !deleted_ids.contains(&parent_id),
        };
        if is_root {
            delete_folder_tree(&state, folder, user.id).await?;
        }
    }

    // Files directly in the trash (no folder, or folder not in the deleted set).
    let files_to_delete = sqlx::query_as::<_, FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "UserId" = $1 AND "DeletedAt" IS NOT NULL"#,
    )
    .bind(user.id)
    .fetch_all(&state.db)
    .await?;

    let mut removed_files = 0i64;
    for file in &files_to_delete {
        let orphaned = match file.folder_id {
            None => true,
            Some(folder_id) => !deleted_ids.contains(&folder_id),
        };
        if !orphaned {
            continue;
        }
        let full_path = storage::file_path(
            &state.config,
            file.user_id,
            file.folder_id,
            &file.stored_name,
        )
        .ok_or_else(|| ApiError::bad_request("Invalid storage path."))?;
        if full_path.is_file() {
            let _ = tokio::fs::remove_file(&full_path).await;
        }
        if let Some(thumb_path) = state.thumb.try_build_thumbnail_path(file) {
            if thumb_path.is_file() {
                let _ = tokio::fs::remove_file(&thumb_path).await;
            }
        }
        sqlx::query(r#"DELETE FROM "Files" WHERE "Id" = $1"#)
            .bind(file.id)
            .execute(&state.db)
            .await?;
        removed_files += 1;
    }

    log_activity(
        &state.db,
        Some(user.id),
        "clean-trash",
        "success",
        &format!(
            "Cleaned {} folders and {} files",
            deleted_folders.len(),
            removed_files
        ),
    )
    .await;

    Ok(Json(CleanTrashResponse {
        cleaned_at: chrono::Utc::now(),
        removed_folders: deleted_folders.len() as i64,
        removed_files,
    }))
}

#[derive(Debug, Deserialize)]
struct CleanQuery {
    days: Option<i64>,
}

async fn clean_trash_admin(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<CleanQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    let retention_days = query.days.unwrap_or(30);
    if retention_days <= 0 {
        return Err(ApiError::bad_request(
            "Retention days must be greater than 0.",
        ));
    }
    let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days);
    cleanup_trash(&state, cutoff).await?;
    Ok(Json(serde_json::json!({ "cleanedAt": chrono::Utc::now() })))
}

/// Global trash cleanup used both by the admin endpoint and the daily timer.
pub async fn cleanup_trash(
    state: &AppState,
    cutoff: chrono::DateTime<chrono::Utc>,
) -> ApiResult<()> {
    // Root-level deleted folders whose parent is not itself deleted.
    let folders = sqlx::query_as::<_, FolderRow>(
        r#"SELECT f."Id", f."UserId", f."PublicId", f."Name", f."ParentId", f."CreatedAt", f."DeletedAt"
           FROM "Folders" f
           WHERE f."DeletedAt" IS NOT NULL AND f."DeletedAt" < $1
             AND (f."ParentId" IS NULL OR EXISTS(
                   SELECT 1 FROM "Folders" p WHERE p."Id" = f."ParentId" AND p."DeletedAt" IS NULL))"#,
    )
    .bind(cutoff)
    .fetch_all(&state.db)
    .await?;

    for folder in &folders {
        delete_folder_tree(state, folder, folder.user_id).await?;
    }

    let files = sqlx::query_as::<_, FileRow>(
        r#"SELECT f."Id", f."UserId", f."FolderId", f."PublicId", f."Filename", f."StoredName",
                  f."ThumbnailName", f."FileType", f."Size", f."UploadedAt", f."DeletedAt"
           FROM "Files" f
           WHERE f."DeletedAt" IS NOT NULL AND f."DeletedAt" < $1
             AND (f."FolderId" IS NULL OR EXISTS(
                   SELECT 1 FROM "Folders" p WHERE p."Id" = f."FolderId" AND p."DeletedAt" IS NULL))"#,
    )
    .bind(cutoff)
    .fetch_all(&state.db)
    .await?;

    for file in &files {
        if let Some(full_path) = storage::file_path(
            &state.config,
            file.user_id,
            file.folder_id,
            &file.stored_name,
        ) {
            if full_path.is_file() {
                let _ = tokio::fs::remove_file(&full_path).await;
            }
        }
        if let Some(thumb_path) = state.thumb.try_build_thumbnail_path(file) {
            if thumb_path.is_file() {
                let _ = tokio::fs::remove_file(&thumb_path).await;
            }
        }
        sqlx::query(r#"DELETE FROM "Files" WHERE "Id" = $1"#)
            .bind(file.id)
            .execute(&state.db)
            .await?;
    }

    Ok(())
}

async fn restore_folder_tree(state: &AppState, folder: &FolderRow, user_id: i32) -> ApiResult<()> {
    sqlx::query(r#"UPDATE "Folders" SET "DeletedAt" = NULL WHERE "Id" = $1"#)
        .bind(folder.id)
        .execute(&state.db)
        .await?;

    let files = sqlx::query_as::<_, FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "UserId" = $1 AND "FolderId" = $2 AND "DeletedAt" IS NOT NULL"#,
    )
    .bind(user_id)
    .bind(folder.id)
    .fetch_all(&state.db)
    .await?;

    for file in &files {
        let next_thumbnail = state.thumb.try_restore_thumbnail_from_trash(file, user_id);
        sqlx::query(
            r#"UPDATE "Files" SET "DeletedAt" = NULL, "ThumbnailName" = $2 WHERE "Id" = $1"#,
        )
        .bind(file.id)
        .bind(next_thumbnail.or(file.thumbnail_name.clone()))
        .execute(&state.db)
        .await?;
    }

    let children = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "UserId" = $1 AND "ParentId" = $2 AND "DeletedAt" IS NOT NULL"#,
    )
    .bind(user_id)
    .bind(folder.id)
    .fetch_all(&state.db)
    .await?;

    for child in &children {
        Box::pin(restore_folder_tree(state, child, user_id)).await?;
    }

    Ok(())
}

async fn delete_folder_tree(state: &AppState, folder: &FolderRow, user_id: i32) -> ApiResult<()> {
    let files = sqlx::query_as::<_, FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "UserId" = $1 AND "FolderId" = $2"#,
    )
    .bind(user_id)
    .bind(folder.id)
    .fetch_all(&state.db)
    .await?;

    for file in &files {
        let full_path = storage::file_path(
            &state.config,
            file.user_id,
            file.folder_id,
            &file.stored_name,
        )
        .ok_or_else(|| ApiError::bad_request("Invalid storage path."))?;
        if full_path.is_file() {
            let _ = tokio::fs::remove_file(&full_path).await;
        }
        if let Some(thumb_path) = state.thumb.try_build_thumbnail_path(file) {
            if thumb_path.is_file() {
                let _ = tokio::fs::remove_file(&thumb_path).await;
            }
        }
        sqlx::query(r#"DELETE FROM "Files" WHERE "Id" = $1"#)
            .bind(file.id)
            .execute(&state.db)
            .await?;
    }

    let children = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "UserId" = $1 AND "ParentId" = $2"#,
    )
    .bind(user_id)
    .bind(folder.id)
    .fetch_all(&state.db)
    .await?;

    for child in &children {
        Box::pin(delete_folder_tree(state, child, user_id)).await?;
    }

    sqlx::query(r#"DELETE FROM "Folders" WHERE "Id" = $1"#)
        .bind(folder.id)
        .execute(&state.db)
        .await?;

    Ok(())
}
