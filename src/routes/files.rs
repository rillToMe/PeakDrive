use axum::extract::{Multipart, Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use serde::Deserialize;
use tokio::io::AsyncWriteExt;

use crate::auth::AuthUser;
use crate::dto::{FileDetailDto, RenameFileRequest, StorageUsageDto};
use crate::error::{ApiError, ApiResult};
use crate::models::FileRow;
use crate::routes::{find_file, serve_file_range};
use crate::services::log_activity;
use crate::state::AppState;
use crate::storage;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/files/upload", post(upload))
        .route("/api/files/thumbnail/{public_id}", get(view_thumbnail))
        .route("/api/files/view/{public_id}", get(view_file))
        .route("/api/files/download/{public_id}", get(download_file))
        .route("/api/files/usage", get(storage_usage))
        .route("/api/files/{public_id}", put(rename_file))
        .route("/api/files/{public_id}", axum::routing::delete(delete_file))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UploadQuery {
    folder_public_id: Option<String>,
}

/// A file that has been streamed to disk during a multipart upload.
struct UploadedFile {
    original_name: String,
    content_type: String,
    stored_name: String,
    full_path: std::path::PathBuf,
    size: i64,
}

async fn upload(
    State(state): State<AppState>,
    user: AuthUser,
    Query(query): Query<UploadQuery>,
    mut multipart: Multipart,
) -> ApiResult<Response> {
    let mut folder_id: Option<i32> = None;
    if let Some(folder_public_id) = query.folder_public_id.as_deref() {
        if !folder_public_id.trim().is_empty() {
            let folder = sqlx::query_scalar::<_, i32>(
                r#"SELECT "Id" FROM "Folders"
                   WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
            )
            .bind(folder_public_id)
            .bind(user.id)
            .fetch_optional(&state.db)
            .await?;
            match folder {
                Some(id) => folder_id = Some(id),
                None => {
                    log_activity(
                        &state.db,
                        Some(user.id),
                        "upload",
                        "error",
                        "Folder not found.",
                    )
                    .await;
                    return Err(ApiError::not_found());
                }
            }
        }
    }

    // Find the first file field and stream it straight to disk. All work happens
    // inside the loop body: the `Field` borrows `multipart`, so it must not
    // escape the iteration. Files may be up to 5 GB and must never be buffered
    // in RAM, hence `chunk()` rather than `bytes()`.
    // (`while let` cannot be used here: the temporary future borrows `multipart`
    // for the whole body, which the borrow checker rejects.)
    let mut uploaded: Option<UploadedFile> = None;
    #[allow(clippy::while_let_loop)]
    loop {
        match multipart
            .next_field()
            .await
            .map_err(|e| ApiError::bad_request(e.to_string()))?
        {
            Some(mut field) => {
                if field.file_name().is_none() {
                    continue;
                }

                let original_name = field.file_name().unwrap_or_default().to_string();
                let content_type = field
                    .content_type()
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| "application/octet-stream".to_string());

                let extension = std::path::Path::new(&original_name)
                    .extension()
                    .map(|e| format!(".{}", e.to_string_lossy()))
                    .unwrap_or_default();
                let stored_name = format!("{}{}", uuid::Uuid::new_v4().simple(), extension);

                let folder_dir = storage::user_folder_dir(&state.config, user.id, folder_id);
                if !storage::is_within_root(&folder_dir, &storage::storage_root(&state.config)) {
                    log_activity(
                        &state.db,
                        Some(user.id),
                        "upload",
                        "error",
                        "Invalid storage path.",
                    )
                    .await;
                    return Err(ApiError::bad_request("Invalid storage path."));
                }
                tokio::fs::create_dir_all(&folder_dir).await?;

                let full_path = storage::file_path(&state.config, user.id, folder_id, &stored_name)
                    .ok_or_else(|| ApiError::bad_request("Invalid storage path."))?;

                let mut handle = tokio::fs::File::create(&full_path).await?;
                let mut size: i64 = 0;
                loop {
                    match field
                        .chunk()
                        .await
                        .map_err(|e| ApiError::bad_request(e.to_string()))?
                    {
                        Some(chunk) => {
                            size += chunk.len() as i64;
                            if let Err(err) = handle.write_all(&chunk).await {
                                drop(handle);
                                let _ = tokio::fs::remove_file(&full_path).await;
                                return Err(ApiError::from(err));
                            }
                        }
                        None => break,
                    }
                }
                if let Err(err) = handle.flush().await {
                    drop(handle);
                    let _ = tokio::fs::remove_file(&full_path).await;
                    return Err(ApiError::from(err));
                }
                drop(handle);

                uploaded = Some(UploadedFile {
                    original_name,
                    content_type,
                    stored_name,
                    full_path,
                    size,
                });
                break;
            }
            None => break,
        }
    }

    let UploadedFile {
        original_name,
        content_type,
        stored_name,
        full_path,
        size,
    } = match uploaded {
        Some(uploaded) => uploaded,
        None => {
            log_activity(
                &state.db,
                Some(user.id),
                "upload",
                "error",
                "File is required.",
            )
            .await;
            return Err(ApiError::bad_request("File is required."));
        }
    };

    if size == 0 {
        let _ = tokio::fs::remove_file(&full_path).await;
        log_activity(
            &state.db,
            Some(user.id),
            "upload",
            "error",
            "File is required.",
        )
        .await;
        return Err(ApiError::bad_request("File is required."));
    }

    let public_id = uuid::Uuid::new_v4().simple().to_string();
    let uploaded_at = chrono::Utc::now();

    let insert = sqlx::query_as::<_, FileRow>(
        r#"INSERT INTO "Files"
              ("UserId", "FolderId", "PublicId", "Filename", "StoredName", "FileType", "Size", "UploadedAt", "DeletedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)
           RETURNING "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                     "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt""#,
    )
    .bind(user.id)
    .bind(folder_id)
    .bind(&public_id)
    .bind(&original_name)
    .bind(&stored_name)
    .bind(&content_type)
    .bind(size)
    .bind(uploaded_at)
    .fetch_one(&state.db)
    .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "upload",
        "success",
        &format!("Uploaded {}", insert.filename),
    )
    .await;

    let mut file = insert;

    if state.thumb.is_model_file(&file.filename) {
        let model_path = full_path.to_string_lossy().to_string();
        let thumb_result = {
            let file_for_render = file.clone();
            let service = state.thumb.clone();
            let user_id = user.id;
            tokio::task::spawn_blocking(move || {
                service.try_generate_model_thumbnail(&model_path, &file_for_render, user_id)
            })
            .await
            .map_err(|e| ApiError::internal(e.to_string()))?
        };

        match thumb_result {
            Some(thumb_name) => {
                sqlx::query(r#"UPDATE "Files" SET "ThumbnailName" = $1 WHERE "Id" = $2"#)
                    .bind(&thumb_name)
                    .bind(file.id)
                    .execute(&state.db)
                    .await?;
                file.thumbnail_name = Some(thumb_name);
            }
            None => {
                let _ = sqlx::query(r#"DELETE FROM "Files" WHERE "Id" = $1"#)
                    .bind(file.id)
                    .execute(&state.db)
                    .await;
                let _ = tokio::fs::remove_file(&full_path).await;
                return Err(ApiError::internal("Gagal render thumbnail 3D."));
            }
        }
    }

    Ok((StatusCode::OK, Json(FileDetailDto::from_row(&file))).into_response())
}

async fn view_thumbnail(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Response> {
    let file = find_file(&state.db, &public_id, user.id)
        .await?
        .ok_or_else(ApiError::not_found)?;

    let mut file = file;
    if file
        .thumbnail_name
        .as_deref()
        .map(|s| s.trim().is_empty())
        .unwrap_or(true)
    {
        if let Some((name, _)) = state
            .thumb
            .try_get_thumbnail_output_path(user.id, &file.public_id)
        {
            sqlx::query(r#"UPDATE "Files" SET "ThumbnailName" = $1 WHERE "Id" = $2"#)
                .bind(&name)
                .bind(file.id)
                .execute(&state.db)
                .await?;
            file.thumbnail_name = Some(name);
        }
    }

    let existing = file
        .thumbnail_name
        .as_ref()
        .and_then(|_| state.thumb.try_build_thumbnail_path(&file))
        .filter(|path| path.is_file());

    if let Some(thumb_path) = existing {
        let content_type = match thumb_path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .as_deref()
        {
            Some("jpg") | Some("jpeg") => "image/jpeg",
            _ => "image/png",
        };
        let headers = HeaderMap::new();
        return serve_file_range(&thumb_path, content_type, None, &headers).await;
    }

    // Fall back: kick off a background render for model files and return a
    // placeholder cube immediately.
    if state.thumb.is_model_file(&file.filename) {
        if let Some(full_path) = storage::file_path(
            &state.config,
            file.user_id,
            file.folder_id,
            &file.stored_name,
        ) {
            state.thumb.ensure_thumbnail_in_background(
                full_path.to_string_lossy().to_string(),
                file.clone(),
                user.id,
            );
        }
    }

    let fallback = state.thumb.render_fallback_thumbnail();
    let png = tokio::task::spawn_blocking(move || encode_png(&fallback))
        .await
        .map_err(|e| ApiError::internal(e.to_string()))??;
    Ok(crate::routes::bytes_response("image/png", png))
}

async fn view_file(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Response> {
    let file = find_file(&state.db, &public_id, user.id)
        .await?
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

    serve_file_range(&full_path, &file.file_type, None, &headers).await
}

async fn download_file(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
    headers: HeaderMap,
) -> ApiResult<Response> {
    let file = find_file(&state.db, &public_id, user.id)
        .await?
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

    serve_file_range(&full_path, &file.file_type, Some(&file.filename), &headers).await
}

async fn storage_usage(
    State(state): State<AppState>,
    user: AuthUser,
) -> ApiResult<Json<StorageUsageDto>> {
    let total = sqlx::query_scalar::<_, Option<i64>>(
        r#"SELECT COALESCE(SUM("Size"), 0)::bigint
           FROM "Files" WHERE "UserId" = $1 AND "DeletedAt" IS NULL"#,
    )
    .bind(user.id)
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);
    Ok(Json(StorageUsageDto { total_bytes: total }))
}

async fn rename_file(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
    Json(request): Json<RenameFileRequest>,
) -> ApiResult<Json<FileDetailDto>> {
    if request.name.trim().is_empty() {
        return Err(ApiError::bad_request("File name is required."));
    }

    let file = find_file(&state.db, &public_id, user.id)
        .await?
        .ok_or_else(ApiError::not_found)?;

    let new_name = request.name.trim().to_string();
    sqlx::query(r#"UPDATE "Files" SET "Filename" = $1 WHERE "Id" = $2"#)
        .bind(&new_name)
        .bind(file.id)
        .execute(&state.db)
        .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "rename-file",
        "success",
        &format!("Renamed {}", file.public_id),
    )
    .await;

    let mut updated = file;
    updated.filename = new_name;
    Ok(Json(FileDetailDto::from_row(&updated)))
}

async fn delete_file(
    State(state): State<AppState>,
    user: AuthUser,
    Path(public_id): Path<String>,
) -> ApiResult<Response> {
    let file = find_file(&state.db, &public_id, user.id)
        .await?
        .ok_or_else(ApiError::not_found)?;

    let next_thumbnail = state.thumb.try_move_thumbnail_to_trash(&file, user.id);
    sqlx::query(r#"UPDATE "Files" SET "DeletedAt" = $1, "ThumbnailName" = $2 WHERE "Id" = $3"#)
        .bind(chrono::Utc::now())
        .bind(next_thumbnail.or(file.thumbnail_name.clone()))
        .bind(file.id)
        .execute(&state.db)
        .await?;

    log_activity(
        &state.db,
        Some(user.id),
        "delete-file",
        "success",
        &format!("Deleted {}", file.filename),
    )
    .await;

    Ok(StatusCode::NO_CONTENT.into_response())
}

fn encode_png(image: &crate::treed::scene::TextureImage) -> Result<Vec<u8>, ApiError> {
    let buffer = image::RgbaImage::from_raw(image.width, image.height, image.pixels.clone())
        .ok_or_else(|| ApiError::internal("invalid image buffer"))?;
    let mut bytes = Vec::new();
    buffer
        .write_to(
            &mut std::io::Cursor::new(&mut bytes),
            image::ImageFormat::Png,
        )
        .map_err(|e| ApiError::internal(e.to_string()))?;
    Ok(bytes)
}
