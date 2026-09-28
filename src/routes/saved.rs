use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;

use crate::auth::AuthUser;
use crate::dto::{
    SaveRequest, SavedFileDto, SavedFolderDto, SavedItemDto, SavedListResponse, SavedStatusResponse,
};
use crate::error::{ApiError, ApiResult};
use crate::models::SavedItemRow;
use crate::services::log_activity;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/saved", get(get_saved_items))
        .route("/api/saved", post(save_item))
        .route("/api/saved", delete(remove_saved_by_target))
        .route("/api/saved/check", get(check_saved))
        .route("/api/saved/share/{token}", get(check_saved_share))
        .route("/api/saved/share/{token}", post(save_from_share))
        .route("/api/saved/share/{token}", delete(remove_saved_share))
        .route("/api/saved/{id}", delete(remove_saved_item))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PaginationQuery {
    page: Option<i32>,
    page_size: Option<i32>,
}

async fn get_saved_items(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<PaginationQuery>,
) -> ApiResult<Json<SavedListResponse>> {
    let current_page = query.page.unwrap_or(1).max(1);
    let mut size = query.page_size.unwrap_or(30);
    if size <= 0 {
        size = 30;
    }
    if size > 100 {
        size = 100;
    }

    let total =
        sqlx::query_scalar::<_, i64>(r#"SELECT COUNT(*) FROM "SavedItems" WHERE "UserId" = $1"#)
            .bind(user.id)
            .fetch_one(&state.db)
            .await?;

    let items = sqlx::query_as::<_, SavedItemRow>(
        r#"SELECT "Id", "UserId", "TargetType", "TargetId", "SavedAt"
           FROM "SavedItems"
           WHERE "UserId" = $1
           ORDER BY "SavedAt" DESC
           LIMIT $2 OFFSET $3"#,
    )
    .bind(user.id)
    .bind(size as i64)
    .bind(((current_page - 1) * size) as i64)
    .fetch_all(&state.db)
    .await?;

    let file_ids: Vec<i32> = items
        .iter()
        .filter(|i| i.target_type == "file")
        .map(|i| i.target_id)
        .collect();
    let folder_ids: Vec<i32> = items
        .iter()
        .filter(|i| i.target_type == "folder")
        .map(|i| i.target_id)
        .collect();

    let files = if file_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, crate::models::FileRow>(
            r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                      "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
               FROM "Files" WHERE "Id" = ANY($1)"#,
        )
        .bind(&file_ids)
        .fetch_all(&state.db)
        .await?
    };
    let folders = if folder_ids.is_empty() {
        vec![]
    } else {
        sqlx::query_as::<_, crate::models::FolderRow>(
            r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
               FROM "Folders" WHERE "Id" = ANY($1)"#,
        )
        .bind(&folder_ids)
        .fetch_all(&state.db)
        .await?
    };

    let file_map: std::collections::HashMap<i32, &crate::models::FileRow> =
        files.iter().map(|f| (f.id, f)).collect();
    let folder_map: std::collections::HashMap<i32, &crate::models::FolderRow> =
        folders.iter().map(|f| (f.id, f)).collect();

    let results: Vec<SavedItemDto> = items
        .iter()
        .map(|item| {
            if item.target_type == "file" {
                if let Some(file) = file_map.get(&item.target_id) {
                    return SavedItemDto {
                        id: item.id,
                        target_type: item.target_type.clone(),
                        target_id: item.target_id,
                        saved_at: item.saved_at,
                        available: file.deleted_at.is_none(),
                        file: Some(SavedFileDto {
                            public_id: file.public_id.clone(),
                            filename: file.filename.clone(),
                            file_type: file.file_type.clone(),
                            size: file.size,
                            uploaded_at: file.uploaded_at,
                        }),
                        folder: None,
                    };
                }
            }
            if item.target_type == "folder" {
                if let Some(folder) = folder_map.get(&item.target_id) {
                    return SavedItemDto {
                        id: item.id,
                        target_type: item.target_type.clone(),
                        target_id: item.target_id,
                        saved_at: item.saved_at,
                        available: folder.deleted_at.is_none(),
                        file: None,
                        folder: Some(SavedFolderDto {
                            public_id: folder.public_id.clone(),
                            name: folder.name.clone(),
                            created_at: folder.created_at,
                        }),
                    };
                }
            }
            SavedItemDto {
                id: item.id,
                target_type: item.target_type.clone(),
                target_id: item.target_id,
                saved_at: item.saved_at,
                available: false,
                file: None,
                folder: None,
            }
        })
        .collect();

    Ok(Json(SavedListResponse {
        items: results,
        total,
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CheckQuery {
    target_type: String,
    public_id: String,
}

async fn check_saved(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<CheckQuery>,
) -> ApiResult<Json<SavedStatusResponse>> {
    let normalized = normalize_target_type(&query.target_type)?;
    if query.public_id.trim().is_empty() {
        return Err(ApiError::bad_request("PublicId is required."));
    }

    let target_id =
        resolve_target_id(&state, &normalized, &query.public_id, user.id, false).await?;
    let target_id = match target_id {
        Some(id) => id,
        None => return Err(ApiError::not_found()),
    };

    let saved = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM "SavedItems"
           WHERE "UserId" = $1 AND "TargetType" = $2 AND "TargetId" = $3)"#,
    )
    .bind(user.id)
    .bind(&normalized)
    .bind(target_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(SavedStatusResponse { saved }))
}

async fn check_saved_share(
    State(state): State<AppState>,
    user: AuthUser,
    Path(token): Path<String>,
) -> ApiResult<Json<SavedStatusResponse>> {
    if token.trim().is_empty() {
        return Err(ApiError::bad_request("Token is required."));
    }
    let share = find_share(&state, &token)
        .await?
        .ok_or_else(ApiError::not_found)?;

    let (target_type, target_id) = if let Some(file_id) = share.file_id {
        ("file", file_id)
    } else if let Some(folder_id) = share.folder_id {
        ("folder", folder_id)
    } else {
        return Err(ApiError::not_found());
    };

    let saved = sqlx::query_scalar::<_, bool>(
        r#"SELECT EXISTS(SELECT 1 FROM "SavedItems"
           WHERE "UserId" = $1 AND "TargetType" = $2 AND "TargetId" = $3)"#,
    )
    .bind(user.id)
    .bind(target_type)
    .bind(target_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(SavedStatusResponse { saved }))
}

async fn save_item(
    State(state): State<AppState>,
    user: AuthUser,
    Json(request): Json<SaveRequest>,
) -> ApiResult<Json<i32>> {
    let normalized = normalize_target_type(&request.target_type)?;
    if request.public_id.trim().is_empty() {
        return Err(ApiError::bad_request("PublicId is required."));
    }

    let target_id = resolve_target_id(&state, &normalized, &request.public_id, user.id, true)
        .await?
        .ok_or_else(ApiError::not_found)?;

    if let Some(existing) = find_saved(&state, user.id, &normalized, target_id).await? {
        return Ok(Json(existing.id));
    }

    let id = insert_saved(&state, user.id, &normalized, target_id).await?;
    log_activity(
        &state.db,
        Some(user.id),
        "save-item",
        "success",
        &format!("Saved {} {}", normalized, request.public_id),
    )
    .await;
    Ok(Json(id))
}

async fn save_from_share(
    State(state): State<AppState>,
    user: AuthUser,
    Path(token): Path<String>,
) -> ApiResult<Json<i32>> {
    if token.trim().is_empty() {
        return Err(ApiError::bad_request("Token is required."));
    }
    let share = find_share(&state, &token)
        .await?
        .ok_or_else(ApiError::not_found)?;

    let (target_type, target_id, label) = if let Some(file_id) = share.file_id {
        let file = sqlx::query_as::<_, crate::models::FileRow>(
            r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                      "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
               FROM "Files" WHERE "Id" = $1"#,
        )
        .bind(file_id)
        .fetch_optional(&state.db)
        .await?;
        let file = file
            .filter(|f| f.deleted_at.is_none())
            .ok_or_else(ApiError::not_found)?;
        ("file", file.id, format!("file {}", file.public_id))
    } else if let Some(folder_id) = share.folder_id {
        let folder = sqlx::query_as::<_, crate::models::FolderRow>(
            r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
               FROM "Folders" WHERE "Id" = $1"#,
        )
        .bind(folder_id)
        .fetch_optional(&state.db)
        .await?;
        let folder = folder
            .filter(|f| f.deleted_at.is_none())
            .ok_or_else(ApiError::not_found)?;
        ("folder", folder.id, format!("folder {}", folder.public_id))
    } else {
        return Err(ApiError::not_found());
    };

    if let Some(existing) = find_saved(&state, user.id, target_type, target_id).await? {
        return Ok(Json(existing.id));
    }

    let id = insert_saved(&state, user.id, target_type, target_id).await?;
    log_activity(
        &state.db,
        Some(user.id),
        "save-item",
        "success",
        &format!("Saved {label}"),
    )
    .await;
    Ok(Json(id))
}

async fn remove_saved_share(
    State(state): State<AppState>,
    user: AuthUser,
    Path(token): Path<String>,
) -> ApiResult<Response> {
    if token.trim().is_empty() {
        return Err(ApiError::bad_request("Token is required."));
    }
    let share = find_share(&state, &token)
        .await?
        .ok_or_else(ApiError::not_found)?;

    let (target_type, target_id) = if let Some(file_id) = share.file_id {
        ("file", file_id)
    } else if let Some(folder_id) = share.folder_id {
        ("folder", folder_id)
    } else {
        return Err(ApiError::not_found());
    };

    let item = find_saved(&state, user.id, target_type, target_id)
        .await?
        .ok_or_else(ApiError::not_found)?;

    sqlx::query(r#"DELETE FROM "SavedItems" WHERE "Id" = $1"#)
        .bind(item.id)
        .execute(&state.db)
        .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "remove-saved",
        "success",
        &format!("Removed saved {} {}", target_type, target_id),
    )
    .await;

    Ok(axum::http::StatusCode::OK.into_response())
}

async fn remove_saved_item(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<i32>,
) -> ApiResult<Response> {
    let item = sqlx::query_as::<_, SavedItemRow>(
        r#"SELECT "Id", "UserId", "TargetType", "TargetId", "SavedAt"
           FROM "SavedItems" WHERE "Id" = $1 AND "UserId" = $2"#,
    )
    .bind(id)
    .bind(user.id)
    .fetch_optional(&state.db)
    .await?;
    let item = item.ok_or_else(ApiError::not_found)?;

    sqlx::query(r#"DELETE FROM "SavedItems" WHERE "Id" = $1"#)
        .bind(item.id)
        .execute(&state.db)
        .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "remove-saved",
        "success",
        &format!("Removed saved item {}", id),
    )
    .await;

    Ok(axum::http::StatusCode::OK.into_response())
}

async fn remove_saved_by_target(
    State(state): State<AppState>,
    user: AuthUser,
    Json(request): Json<SaveRequest>,
) -> ApiResult<Response> {
    let normalized = normalize_target_type(&request.target_type)?;
    if request.public_id.trim().is_empty() {
        return Err(ApiError::bad_request("PublicId is required."));
    }

    // Note: the C# implementation did NOT filter by user here; kept for parity.
    let target_id = resolve_target_id(&state, &normalized, &request.public_id, user.id, false)
        .await?
        .ok_or_else(ApiError::not_found)?;

    let item = find_saved(&state, user.id, &normalized, target_id)
        .await?
        .ok_or_else(ApiError::not_found)?;

    sqlx::query(r#"DELETE FROM "SavedItems" WHERE "Id" = $1"#)
        .bind(item.id)
        .execute(&state.db)
        .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "remove-saved",
        "success",
        &format!("Removed saved {} {}", normalized, request.public_id),
    )
    .await;

    Ok(axum::http::StatusCode::OK.into_response())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn normalize_target_type(value: &str) -> ApiResult<String> {
    let normalized = value.trim().to_lowercase();
    if normalized == "file" || normalized == "folder" {
        Ok(normalized)
    } else {
        Err(ApiError::bad_request("Invalid target type."))
    }
}

async fn resolve_target_id(
    state: &AppState,
    target_type: &str,
    public_id: &str,
    user_id: i32,
    active_only: bool,
) -> ApiResult<Option<i32>> {
    let id = if target_type == "file" {
        if active_only {
            sqlx::query_scalar::<_, i32>(
                r#"SELECT "Id" FROM "Files"
                   WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
            )
            .bind(public_id)
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?
        } else {
            sqlx::query_scalar::<_, i32>(
                r#"SELECT "Id" FROM "Files" WHERE "PublicId" = $1 AND "UserId" = $2"#,
            )
            .bind(public_id)
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?
        }
    } else if active_only {
        sqlx::query_scalar::<_, i32>(
            r#"SELECT "Id" FROM "Folders"
               WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
        )
        .bind(public_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
    } else {
        sqlx::query_scalar::<_, i32>(
            r#"SELECT "Id" FROM "Folders" WHERE "PublicId" = $1 AND "UserId" = $2"#,
        )
        .bind(public_id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
    };
    Ok(id)
}

async fn find_saved(
    state: &AppState,
    user_id: i32,
    target_type: &str,
    target_id: i32,
) -> ApiResult<Option<SavedItemRow>> {
    let row = sqlx::query_as::<_, SavedItemRow>(
        r#"SELECT "Id", "UserId", "TargetType", "TargetId", "SavedAt"
           FROM "SavedItems"
           WHERE "UserId" = $1 AND "TargetType" = $2 AND "TargetId" = $3"#,
    )
    .bind(user_id)
    .bind(target_type)
    .bind(target_id)
    .fetch_optional(&state.db)
    .await?;
    Ok(row)
}

async fn insert_saved(
    state: &AppState,
    user_id: i32,
    target_type: &str,
    target_id: i32,
) -> ApiResult<i32> {
    let id = sqlx::query_scalar::<_, i32>(
        r#"INSERT INTO "SavedItems" ("UserId", "TargetType", "TargetId", "SavedAt")
           VALUES ($1, $2, $3, $4) RETURNING "Id""#,
    )
    .bind(user_id)
    .bind(target_type)
    .bind(target_id)
    .bind(chrono::Utc::now())
    .fetch_one(&state.db)
    .await?;
    Ok(id)
}

async fn find_share(state: &AppState, token: &str) -> ApiResult<Option<crate::models::ShareRow>> {
    let row = sqlx::query_as::<_, crate::models::ShareRow>(
        r#"SELECT "Id", "FileId", "FolderId", "Token", "CreatedAt"
           FROM "Shares" WHERE "Token" = $1"#,
    )
    .bind(token)
    .fetch_optional(&state.db)
    .await?;
    Ok(row)
}
