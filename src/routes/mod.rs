pub mod admin;
pub mod auth;
pub mod files;
pub mod folders;
pub mod health;
pub mod saved;
pub mod share;
pub mod trash;

use std::io::SeekFrom;
use std::path::Path;

use axum::body::Body;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tokio_util::io::ReaderStream;

use crate::error::ApiError;

/// Serve a file from disk with HTTP range support (needed for `<video>` /
/// `<audio>` seeking), mirroring ASP.NET Core's `enableRangeProcessing: true`.
pub async fn serve_file_range(
    path: &Path,
    content_type: &str,
    download_name: Option<&str>,
    headers: &HeaderMap,
) -> Result<Response, ApiError> {
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|_| ApiError::not_found())?;
    let total = file
        .metadata()
        .await
        .map_err(|_| ApiError::not_found())?
        .len();

    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| parse_range(v, total));

    let mut builder = Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(header::ACCEPT_RANGES, "bytes");
    if let Some(name) = download_name {
        if let Ok(value) =
            HeaderValue::from_str(&format!("attachment; filename=\"{}\"", sanitize(name)))
        {
            builder = builder.header(header::CONTENT_DISPOSITION, value);
        }
    }

    let response = match range {
        Some((start, end)) => {
            let length = end - start + 1;
            file.seek(SeekFrom::Start(start))
                .await
                .map_err(ApiError::from)?;
            let stream = ReaderStream::new(file.take(length));
            builder
                .status(StatusCode::PARTIAL_CONTENT)
                .header(
                    header::CONTENT_RANGE,
                    format!("bytes {start}-{end}/{total}"),
                )
                .header(header::CONTENT_LENGTH, length.to_string())
                .body(Body::from_stream(stream))
                .map_err(|e| ApiError::internal(e.to_string()))?
        }
        None => {
            let stream = ReaderStream::new(file);
            builder
                .status(StatusCode::OK)
                .header(header::CONTENT_LENGTH, total.to_string())
                .body(Body::from_stream(stream))
                .map_err(|e| ApiError::internal(e.to_string()))?
        }
    };

    Ok(response)
}

fn sanitize(name: &str) -> String {
    name.replace('"', "").replace(['\r', '\n'], "")
}

/// Parse a single-range `bytes=start-end` header. Returns `(start, end)`.
fn parse_range(value: &str, total: u64) -> Option<(u64, u64)> {
    let spec = value.strip_prefix("bytes=")?;
    let (start_str, end_str) = spec.split_once('-')?;
    if total == 0 {
        return None;
    }

    let (start, end) = if start_str.is_empty() {
        // Suffix range: `-N` → last N bytes.
        let suffix: u64 = end_str.parse().ok()?;
        if suffix == 0 {
            return None;
        }
        (total.saturating_sub(suffix), total - 1)
    } else {
        let start: u64 = start_str.parse().ok()?;
        let end = if end_str.is_empty() {
            total - 1
        } else {
            end_str.parse::<u64>().ok()?.min(total - 1)
        };
        (start, end)
    };

    if start > end || start >= total {
        return None;
    }
    Some((start, end))
}

/// Build a binary response body from an in-memory buffer.
pub fn bytes_response(content_type: &str, bytes: Vec<u8>) -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .body(Body::from(bytes))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// Look up a user's file by public id (active, non-deleted).
pub async fn find_file(
    db: &sqlx::PgPool,
    public_id: &str,
    user_id: i32,
) -> Result<Option<crate::models::FileRow>, ApiError> {
    let row = sqlx::query_as::<_, crate::models::FileRow>(
        r#"SELECT "Id", "UserId", "FolderId", "PublicId", "Filename", "StoredName",
                  "ThumbnailName", "FileType", "Size", "UploadedAt", "DeletedAt"
           FROM "Files"
           WHERE "PublicId" = $1 AND "UserId" = $2 AND "DeletedAt" IS NULL"#,
    )
    .bind(public_id)
    .bind(user_id)
    .fetch_optional(db)
    .await?;
    Ok(row)
}
