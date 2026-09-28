use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

/// Error type returned from handlers. Serialises to a plain-text body (or an
/// empty body) to match the original ASP.NET Core controller behaviour, which
/// the frontend reads via `response.text()`.
#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "")
    }

    pub fn forbidden() -> Self {
        Self::new(StatusCode::FORBIDDEN, "")
    }

    pub fn not_found() -> Self {
        Self::new(StatusCode::NOT_FOUND, "")
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(StatusCode::CONFLICT, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{} {}", self.status.as_u16(), self.message)
    }
}

impl std::error::Error for ApiError {}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        if self.message.is_empty() {
            self.status.into_response()
        } else {
            (self.status, self.message).into_response()
        }
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        tracing::error!("database error: {err}");
        ApiError::internal("Database error.")
    }
}

impl From<std::io::Error> for ApiError {
    fn from(err: std::io::Error) -> Self {
        tracing::error!("io error: {err}");
        ApiError::internal("IO error.")
    }
}

impl From<sqlx::migrate::MigrateError> for ApiError {
    fn from(err: sqlx::migrate::MigrateError) -> Self {
        tracing::error!("migration error: {err}");
        ApiError::internal("Migration error.")
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
