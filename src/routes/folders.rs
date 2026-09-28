use std::io::{Cursor, Write};

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;

use crate::auth::AuthUser;
use crate::dto::{CreateFolderRequest, FileDto, FolderDto, FolderListing, RenameFolderRequest};
use crate::error::{ApiError, ApiResult};
use crate::models::{FileRow, FolderRow};
use crate::services::log_activity;
use crate::state::AppState;
use crate::storage;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/folders/exists", get(check_exists))
        .route("/api/folders", post(create_folder))
        .route("/api/folders/{public_id}", get(get_folder))
        .route(
            "/api/folders/{public_id}",
            axum::routing::put(rename_folder),
        )
        .route(
            "/api/folders/{public_id}",
            axum::routing::delete(delete_folder),
        )
        .route("/api/folders/delete/{public_id}", post(delete_folder_post))
        .route("/api/folders/download/{public_id}", get(download_folder))
        .route(
            "/api/folders/download-zip/{public_id}",
            get(download_folder),
        )
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExistsQuery {
    name: String,
    parent_public_id: Option<String>,
}

async fn check_exists(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<ExistsQuery>,
) -> ApiResult<Json<serde_json::Value>> {
    if query.name.trim().is_empty() {
        return Err(ApiError::bad_request("Folder name is required."));
    }

    let mut parent_id: Option<i32> = None;
    if let Some(parent_public_id) = query.parent_public_id.as_deref() {
        if !parent_public_id.trim().is_empty() && !parent_public_id.eq_ignore_ascii_case("root") {
            let parent = sqlx::query_scalar::<_, i32>(
                r#"SELECT "Id" FROM "Folders"
                   WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
            )
            .bind(parent_public_id)
            .bind(user.id)
            .fetch_optional(&state.db)
            .await?;
            match parent {
                Some(id) => parent_id = Some(id),
                None => return Err(ApiError::not_found()),
            }
        }
    }

    let exists = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(
               SELECT 1 FROM "Folders"
               WHERE LOWER("Name") = LOWER($1)
                 AND "ParentId" IS NOT DISTINCT FROM $2
                 AND "UserId" = $3
                 AND "DeletedAt" IS NULL
           )"#,
    )
    .bind(query.name.trim())
    .bind(parent_id)
    .bind(user.id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(serde_json::json!({ "exists": exists })))
}

async fn create_folder(
    State(state): State<AppState>,
    user: AuthUser,
    Json(request): Json<CreateFolderRequest>,
) -> ApiResult<Json<FolderDto>> {
    if request.name.trim().is_empty() {
        return Err(ApiError::bad_request("Folder name is required."));
    }

    let mut parent_id: Option<i32> = None;
    if let Some(parent_public_id) = request.parent_public_id.as_deref() {
        if !parent_public_id.trim().is_empty() {
            let parent = sqlx::query_scalar::<_, i32>(
                r#"SELECT "Id" FROM "Folders"
                   WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
            )
            .bind(parent_public_id)
            .bind(user.id)
            .fetch_optional(&state.db)
            .await?;
            match parent {
                Some(id) => parent_id = Some(id),
                None => return Err(ApiError::not_found()),
            }
        }
    }

    let public_id = uuid::Uuid::new_v4().simple().to_string();
    let created_at = chrono::Utc::now();

    sqlx::query(
        r#"INSERT INTO "Folders" ("UserId", "PublicId", "Name", "ParentId", "CreatedAt")
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(user.id)
    .bind(&public_id)
    .bind(request.name.trim())
    .bind(parent_id)
    .bind(created_at)
    .execute(&state.db)
    .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "create-folder",
        "success",
        &format!("Created {}", request.name.trim()),
    )
    .await;

    Ok(Json(FolderDto {
        public_id,
        name: request.name.trim().to_string(),
        parent_public_id: request.parent_public_id,
        created_at,
    }))
}

async fn get_folder(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Json<FolderListing>> {
    if public_id.eq_ignore_ascii_case("root") {
        let root_folders = sqlx::query_as::<_, FolderRow>(
            r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
               FROM "Folders"
               WHERE "UserId" = $1 AND "ParentId" IS NULL AND "DeletedAt" IS NULL
               ORDER BY "Name""#,
        )
        .bind(user.id)
        .fetch_all(&state.db)
        .await?;

        let mut root_files = sqlx::query_as::<_, FileRow>(
            r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                      "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
               FROM "Files"
               WHERE "UserId" = $1 AND "FolderId" IS NULL AND "DeletedAt" IS NULL
               ORDER BY "Filename""#,
        )
        .bind(user.id)
        .fetch_all(&state.db)
        .await?;

        ensure_thumbnail_names(&state, &mut root_files, user.id).await?;

        return Ok(Json(FolderListing {
            folder: None,
            folders: root_folders
                .iter()
                .map(|f| FolderDto::from_row(f, None))
                .collect(),
            files: root_files.iter().map(FileDto::from_row).collect(),
        }));
    }

    let folder = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
    )
    .bind(&public_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let folder = folder.ok_or_else(ApiError::not_found)?;

    let folders = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "UserId" = $1 AND "ParentId" = $2 AND "DeletedAt" IS NULL
           ORDER BY "Name""#,
    )
    .bind(user.id)
    .bind(folder.id)
    .fetch_all(&state.db)
    .await?;

    let mut files = sqlx::query_as::<_, FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "UserId" = $1 AND "FolderId" = $2 AND "DeletedAt" IS NULL
           ORDER BY "Filename""#,
    )
    .bind(user.id)
    .bind(folder.id)
    .fetch_all(&state.db)
    .await?;

    ensure_thumbnail_names(&state, &mut files, user.id).await?;

    let parent_public_id = match folder.parent_id {
        Some(parent_id) => {
            sqlx::query_scalar::<_, String>(r#"SELECT "PublicId" FROM "Folders" WHERE "Id" = $1"#)
                .bind(parent_id)
                .fetch_optional(&state.db)
                .await?
        }
        None => None,
    };

    Ok(Json(FolderListing {
        folder: Some(FolderDto::from_row(&folder, parent_public_id)),
        folders: folders
            .iter()
            .map(|f| FolderDto::from_row(f, Some(public_id.clone())))
            .collect(),
        files: files.iter().map(FileDto::from_row).collect(),
    }))
}

async fn rename_folder(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
    Json(request): Json<RenameFolderRequest>,
) -> ApiResult<Json<FolderDto>> {
    if request.name.trim().is_empty() {
        return Err(ApiError::bad_request("Folder name is required."));
    }

    let folder = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
    )
    .bind(&public_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let folder = folder.ok_or_else(ApiError::not_found)?;

    sqlx::query(r#"UPDATE "Folders" SET "Name" = $1 WHERE "Id" = $2"#)
        .bind(request.name.trim())
        .bind(folder.id)
        .execute(&state.db)
        .await?;

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
        name: request.name.trim().to_string(),
        parent_public_id,
        created_at: folder.created_at,
    }))
}

async fn delete_folder(state: State<AppState>, user: AuthUser, path: Path<String>) -> Response {
    delete_folder_internal(state, user, path).await
}

async fn delete_folder_post(
    state: State<AppState>,
    user: AuthUser,
    path: Path<String>,
) -> Response {
    delete_folder_internal(state, user, path).await
}

async fn delete_folder_internal(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> Response {
    let result = async {
        let folder = sqlx::query_as::<_, FolderRow>(
            r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
               FROM "Folders"
               WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
        )
        .bind(&public_id)
        .bind(user.id)
        .fetch_optional(&state.db)
        .await?;
        let folder = folder.ok_or_else(ApiError::not_found)?;

        move_folder_to_trash(&state, &folder, user.id, chrono::Utc::now()).await?;
        log_activity(
            &state.db,
            Some(user.id),
            "delete-folder",
            "success",
            &format!("Moved {} to trash", folder.name),
        )
        .await;
        Ok::<(), ApiError>(())
    }
    .await;

    match result {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(err) => err.into_response(),
    }
}

async fn download_folder(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Response> {
    let folder = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
    )
    .bind(&public_id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let folder = folder.ok_or_else(ApiError::not_found)?;

    // Gather the file set first, then build the archive off the async runtime.
    let mut entries: Vec<(String, std::path::PathBuf)> = Vec::new();
    collect_folder_entries(&state, &folder, user.id, &folder.name, &mut entries).await?;

    let zip_bytes = tokio::task::spawn_blocking(move || build_zip(entries))
        .await
        .map_err(|e| ApiError::internal(e.to_string()))??;

    let download_name = format!("{}.zip", folder.name);
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(axum::http::header::CONTENT_TYPE, "application/zip")
        .header(
            axum::http::header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{download_name}\""),
        )
        .body(axum::body::Body::from(zip_bytes))
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(response)
}

/// Recursively collect `(zip_entry_path, absolute_path)` pairs for a folder.
fn collect_folder_entries<'a>(
    state: &'a AppState,
    folder: &'a FolderRow,
    user_id: i32,
    current_path: &'a str,
    out: &'a mut Vec<(String, std::path::PathBuf)>,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ApiResult<()>> + Send + 'a>> {
    Box::pin(async move {
        let files = sqlx::query_as::<_, FileRow>(
            r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                      "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
               FROM "Files"
               WHERE "UserId" = $1 AND "FolderId" = $2
               ORDER BY "Filename""#,
        )
        .bind(user_id)
        .bind(folder.id)
        .fetch_all(&state.db)
        .await?;

        for file in files {
            let path = storage::file_path(
                &state.config,
                file.user_id,
                file.folder_id,
                &file.stored_name,
            )
            .ok_or_else(|| ApiError::bad_request("Invalid storage path."))?;
            if !path.is_file() {
                continue;
            }
            let entry = format!("{}/{}", current_path, file.filename).replace('\\', "/");
            out.push((entry, path));
        }

        let children = sqlx::query_as::<_, FolderRow>(
            r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
               FROM "Folders"
               WHERE "UserId" = $1 AND "ParentId" = $2 AND "DeletedAt" IS NULL
               ORDER BY "Name""#,
        )
        .bind(user_id)
        .bind(folder.id)
        .fetch_all(&state.db)
        .await?;

        for child in children {
            let child_path = format!("{}/{}", current_path, child.name).replace('\\', "/");
            collect_folder_entries(state, &child, user_id, &child_path, out).await?;
        }

        Ok(())
    })
}

fn build_zip(entries: Vec<(String, std::path::PathBuf)>) -> Result<Vec<u8>, ApiError> {
    let mut cursor = Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut cursor);
        let options: zip::write::SimpleFileOptions = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);
        for (entry, path) in entries {
            let data = std::fs::read(&path)?;
            zip.start_file(entry, options)
                .map_err(|e| ApiError::internal(e.to_string()))?;
            zip.write_all(&data)?;
        }
        zip.finish()
            .map_err(|e| ApiError::internal(e.to_string()))?;
    }
    Ok(cursor.into_inner())
}

async fn ensure_thumbnail_names(
    state: &AppState,
    files: &mut [FileRow],
    user_id: i32,
) -> ApiResult<()> {
    let mut changed = false;
    for file in files.iter_mut() {
        if file
            .thumbnail_name
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false)
        {
            continue;
        }
        if !state.thumb.is_model_file(&file.filename) {
            continue;
        }
        if let Some((name, _)) = state
            .thumb
            .try_get_thumbnail_output_path(user_id, &file.public_id)
        {
            file.thumbnail_name = Some(name.clone());
            sqlx::query(r#"UPDATE "Files" SET "ThumbnailName" = $1 WHERE "Id" = $2"#)
                .bind(&name)
                .bind(file.id)
                .execute(&state.db)
                .await?;
            changed = true;
        }
    }
    let _ = changed;
    Ok(())
}

async fn move_folder_to_trash(
    state: &AppState,
    folder: &FolderRow,
    user_id: i32,
    deleted_at: chrono::DateTime<chrono::Utc>,
) -> ApiResult<()> {
    sqlx::query(r#"UPDATE "Folders" SET "DeletedAt" = $1 WHERE "Id" = $2"#)
        .bind(deleted_at)
        .bind(folder.id)
        .execute(&state.db)
        .await?;

    let files = sqlx::query_as::<_, FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "UserId" = $1 AND "FolderId" = $2 AND "DeletedAt" IS NULL"#,
    )
    .bind(user_id)
    .bind(folder.id)
    .fetch_all(&state.db)
    .await?;

    for file in files {
        let next_thumbnail = state.thumb.try_move_thumbnail_to_trash(&file, user_id);
        sqlx::query(r#"UPDATE "Files" SET "DeletedAt" = $1, "ThumbnailName" = $2 WHERE "Id" = $3"#)
            .bind(deleted_at)
            .bind(next_thumbnail.or(file.thumbnail_name.clone()))
            .bind(file.id)
            .execute(&state.db)
            .await?;
    }

    let children = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders"
           WHERE "UserId" = $1 AND "ParentId" = $2 AND "DeletedAt" IS NULL"#,
    )
    .bind(user_id)
    .bind(folder.id)
    .fetch_all(&state.db)
    .await?;

    for child in children {
        Box::pin(move_folder_to_trash(state, &child, user_id, deleted_at)).await?;
    }

    Ok(())
}
