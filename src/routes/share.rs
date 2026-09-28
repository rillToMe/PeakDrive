use std::io::{Cursor, Write};

use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};

use crate::auth::AuthUser;
use crate::dto::ShareResponse;
use crate::error::{ApiError, ApiResult};
use crate::models::{FileRow, FolderRow, ShareRow};
use crate::routes::serve_file_range;
use crate::services::log_activity;
use crate::state::AppState;
use crate::storage;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/share/{public_id}", post(create_share))
        .route("/api/share/folder/{public_id}", post(create_folder_share))
        .route("/s/{token}", get(get_shared_file))
        .route("/s/file/{token}", get(get_shared_file))
        .route("/s/folder/{token}", get(get_shared_folder))
}

async fn create_share(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Json<ShareResponse>> {
    let file = crate::routes::find_file(&state.db, &public_id, user.id)
        .await?
        .ok_or_else(ApiError::not_found)?;

    let token = uuid::Uuid::new_v4().simple().to_string();
    sqlx::query(r#"INSERT INTO "Shares" ("FileId", "Token", "CreatedAt") VALUES ($1, $2, $3)"#)
        .bind(file.id)
        .bind(&token)
        .bind(chrono::Utc::now())
        .execute(&state.db)
        .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "share-file",
        "success",
        &format!("Shared {}", file.filename),
    )
    .await;

    Ok(Json(ShareResponse {
        url: build_share_url(&state, &token, "file"),
        token,
    }))
}

async fn create_folder_share(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Json<ShareResponse>> {
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

    let token = uuid::Uuid::new_v4().simple().to_string();
    sqlx::query(r#"INSERT INTO "Shares" ("FolderId", "Token", "CreatedAt") VALUES ($1, $2, $3)"#)
        .bind(folder.id)
        .bind(&token)
        .bind(chrono::Utc::now())
        .execute(&state.db)
        .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "share-folder",
        "success",
        &format!("Shared {}", folder.name),
    )
    .await;

    Ok(Json(ShareResponse {
        url: build_share_url(&state, &token, "folder"),
        token,
    }))
}

async fn get_shared_file(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Response> {
    let share = find_share(&state, &token)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let file_id = share.file_id.ok_or_else(ApiError::not_found)?;

    let file = sqlx::query_as::<_, FileRow>(
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

    let full_path = storage::file_path(
        &state.config,
        file.user_id,
        file.folder_id,
        &file.stored_name,
    )
    .ok_or_else(|| ApiError::bad_request("Invalid storage path."))?;
    if !full_path.is_file() {
        return Err(ApiError::not_found());
    }

    // Inline for image/video (enables streaming), attachment otherwise.
    if file.file_type.starts_with("image/") || file.file_type.starts_with("video/") {
        serve_file_range(&full_path, &file.file_type, None, &headers).await
    } else {
        serve_file_range(&full_path, &file.file_type, Some(&file.filename), &headers).await
    }
}

async fn get_shared_folder(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> ApiResult<Response> {
    let share = find_share(&state, &token)
        .await?
        .ok_or_else(ApiError::not_found)?;
    let folder_id = share.folder_id.ok_or_else(ApiError::not_found)?;

    let folder = sqlx::query_as::<_, FolderRow>(
        r#"SELECT "Id", "UserId", "PublicId", "Name", "ParentId", "CreatedAt", "DeletedAt"
           FROM "Folders" WHERE "Id" = $1"#,
    )
    .bind(folder_id)
    .fetch_optional(&state.db)
    .await?;
    let folder = folder
        .filter(|f| f.deleted_at.is_none())
        .ok_or_else(ApiError::not_found)?;

    let mut entries: Vec<(String, std::path::PathBuf)> = Vec::new();
    collect_entries(&state, &folder, folder.user_id, &folder.name, &mut entries).await?;

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

fn collect_entries<'a>(
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
               WHERE "UserId" = $1 AND "FolderId" = $2 AND "DeletedAt" IS NULL
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
            collect_entries(state, &child, user_id, &child_path, out).await?;
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

async fn find_share(state: &AppState, token: &str) -> ApiResult<Option<ShareRow>> {
    let row = sqlx::query_as::<_, ShareRow>(
        r#"SELECT "Id", "FileId", "FolderId", "Token", "CreatedAt"
           FROM "Shares" WHERE "Token" = $1"#,
    )
    .bind(token)
    .fetch_optional(&state.db)
    .await?;
    Ok(row)
}

fn build_share_url(state: &AppState, token: &str, kind: &str) -> String {
    let base = state.config.share_base_url.trim_end_matches('/');
    if base.to_lowercase().ends_with("/s") {
        format!("{base}/{kind}/{token}")
    } else {
        format!("{base}/s/{kind}/{token}")
    }
}

#[allow(dead_code)]
fn _status() -> StatusCode {
    StatusCode::OK
}

#[allow(dead_code)]
fn _into(resp: Response) -> Response {
    resp.into_response()
}
