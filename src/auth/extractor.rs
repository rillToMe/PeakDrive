use axum::extract::FromRequestParts;
use axum::http::request::Parts;

use crate::error::ApiError;
use crate::models::UserRole;
use crate::state::AppState;

/// Authenticated caller derived from the `Authorization: Bearer <jwt>` header.
/// Extraction fails with `401` when the header is missing or the token invalid,
/// matching `[Authorize]` on the ASP.NET controllers.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: i32,
    pub email: String,
    pub role: UserRole,
}

impl AuthUser {
    pub fn is_admin(&self) -> bool {
        self.role.is_admin()
    }

    pub fn is_master(&self) -> bool {
        self.role.is_master()
    }
}

fn bearer_token(parts: &Parts) -> Result<String, ApiError> {
    let header = parts
        .headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(ApiError::unauthorized)?;
    let token = header
        .strip_prefix("Bearer ")
        .or_else(|| header.strip_prefix("bearer "))
        .ok_or_else(ApiError::unauthorized)?;
    if token.is_empty() {
        return Err(ApiError::unauthorized());
    }
    Ok(token.to_string())
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let token = bearer_token(parts)?;
        let claims = state.jwt.verify(&token)?;
        let id = claims
            .sub
            .parse::<i32>()
            .map_err(|_| ApiError::unauthorized())?;
        Ok(AuthUser {
            id,
            email: claims.email,
            role: UserRole::from_name(&claims.role),
        })
    }
}

/// Like [`AuthUser`] but rejects non-admin callers with `403`, mirroring the
/// `AdminOnly` authorization policy.
#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

impl FromRequestParts<AppState> for AdminUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        if !user.is_admin() {
            return Err(ApiError::forbidden());
        }
        Ok(AdminUser(user))
    }
}

/// Like [`AuthUser`] but requires the `MasterAdmin` role, mirroring the
/// `MasterAdminOnly` authorization policy.
#[derive(Debug, Clone)]
pub struct MasterAdminUser(pub AuthUser);

impl FromRequestParts<AppState> for MasterAdminUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        if !user.is_master() {
            return Err(ApiError::forbidden());
        }
        Ok(MasterAdminUser(user))
    }
}
