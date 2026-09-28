use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};

use crate::auth::password;
use crate::dto::{LoginRequest, LoginResponse, LoginUser};
use crate::error::ApiError;
use crate::models::{UserRole, UserRow};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/api/auth/login", post(login))
}

async fn login(
    State(state): State<AppState>,
    Json(request): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, ApiError> {
    let user = sqlx::query_as::<_, UserRow>(
        r#"SELECT "Id", "Email", "PasswordHash", "Role", "CreatedAt"
           FROM "Users" WHERE "Email" = $1"#,
    )
    .bind(&request.email)
    .fetch_optional(&state.db)
    .await?;

    let user = match user {
        Some(user) => user,
        None => return Err(ApiError::unauthorized()),
    };

    if !password::verify(&request.password, &user.password_hash) {
        return Err(ApiError::unauthorized());
    }

    let role = UserRole::from_i32(user.role);
    let token = state.jwt.issue(user.id, &user.email, role)?;

    Ok(Json(LoginResponse {
        token,
        user: LoginUser {
            id: user.id,
            email: user.email,
            role: role.as_str().to_string(),
        },
    }))
}
