use axum::extract::{Path, Query, State};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use serde::Deserialize;

use crate::auth::password;
use crate::auth::{AdminUser, AuthUser, MasterAdminUser};
use crate::dto::{ActivityLogDto, CreateUserRequest, ResetPasswordRequest, UserSummary};
use crate::error::{ApiError, ApiResult};
use crate::models::UserRole;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/admin/create-user", post(create_user))
        .route("/api/admin/create-admin", post(create_admin))
        .route("/api/admin/list-users", get(list_users))
        .route("/api/admin/activity-logs", get(activity_logs))
        .route("/api/admin/reset-password", post(reset_password))
        .route("/api/admin/delete-user/{id}", delete(delete_user))
}

async fn create_user(
    state: State<AppState>,
    _admin: AdminUser,
    body: Json<CreateUserRequest>,
) -> ApiResult<Json<UserSummary>> {
    create_account(state, body, UserRole::User).await
}

async fn create_admin(
    state: State<AppState>,
    _admin: MasterAdminUser,
    body: Json<CreateUserRequest>,
) -> ApiResult<Json<UserSummary>> {
    create_account(state, body, UserRole::Admin).await
}

async fn create_account(
    State(state): State<AppState>,
    Json(request): Json<CreateUserRequest>,
    role: UserRole,
) -> ApiResult<Json<UserSummary>> {
    if request.email.trim().is_empty() || request.password.trim().is_empty() {
        return Err(ApiError::bad_request("Email and password are required."));
    }

    let existing =
        sqlx::query_scalar::<_, bool>(r#"SELECT EXISTS(SELECT 1 FROM "Users" WHERE "Email" = $1)"#)
            .bind(&request.email)
            .fetch_one(&state.db)
            .await?;
    if existing {
        return Err(ApiError::conflict("Email already exists."));
    }

    let created_at = chrono::Utc::now();
    let hash = password::hash(&request.password);

    let id = sqlx::query_scalar::<_, i32>(
        r#"INSERT INTO "Users" ("Email", "PasswordHash", "Role", "CreatedAt")
           VALUES ($1, $2, $3, $4) RETURNING "Id""#,
    )
    .bind(&request.email)
    .bind(&hash)
    .bind(role as i32)
    .bind(created_at)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(UserSummary {
        id,
        email: request.email,
        role: role.as_str().to_string(),
        created_at,
    }))
}

async fn list_users(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> ApiResult<Json<Vec<UserSummary>>> {
    let users = sqlx::query_as::<_, crate::models::UserRow>(
        r#"SELECT "Id", "Email", "PasswordHash", "Role", "CreatedAt"
           FROM "Users" ORDER BY "Id""#,
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        users
            .into_iter()
            .map(|u| UserSummary {
                id: u.id,
                email: u.email,
                role: UserRole::from_i32(u.role).as_str().to_string(),
                created_at: u.created_at,
            })
            .collect(),
    ))
}

#[derive(Debug, Deserialize)]
struct TakeQuery {
    take: Option<i64>,
}

async fn activity_logs(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<TakeQuery>,
) -> ApiResult<Json<Vec<ActivityLogDto>>> {
    let mut limit = query.take.unwrap_or(200);
    if limit <= 0 {
        limit = 200;
    }
    if limit > 1000 {
        limit = 1000;
    }

    let rows = sqlx::query_as::<_, ActivityLogRow>(
        r#"SELECT l."Id", l."UserId", u."Email" AS "UserEmail", l."Action",
                  l."Status", l."Message", l."CreatedAt"
           FROM "ActivityLogs" l
           LEFT JOIN "Users" u ON u."Id" = l."UserId"
           ORDER BY l."CreatedAt" DESC
           LIMIT $1"#,
    )
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(
        rows.into_iter()
            .map(|row| ActivityLogDto {
                id: row.id,
                user_id: row.user_id,
                user_email: row.user_email,
                action: row.action,
                status: row.status,
                message: row.message,
                created_at: row.created_at,
            })
            .collect(),
    ))
}

#[derive(Debug, sqlx::FromRow)]
struct ActivityLogRow {
    #[sqlx(rename = "Id")]
    id: i32,
    #[sqlx(rename = "UserId")]
    user_id: Option<i32>,
    #[sqlx(rename = "UserEmail")]
    user_email: Option<String>,
    #[sqlx(rename = "Action")]
    action: String,
    #[sqlx(rename = "Status")]
    status: String,
    #[sqlx(rename = "Message")]
    message: String,
    #[sqlx(rename = "CreatedAt")]
    created_at: chrono::DateTime<chrono::Utc>,
}

async fn reset_password(
    State(state): State<AppState>,
    admin: AdminUser,
    Json(request): Json<ResetPasswordRequest>,
) -> ApiResult<Response> {
    if request.user_id <= 0 || request.new_password.trim().is_empty() {
        return Err(ApiError::bad_request(
            "UserId and new password are required.",
        ));
    }

    let user = sqlx::query_as::<_, crate::models::UserRow>(
        r#"SELECT "Id", "Email", "PasswordHash", "Role", "CreatedAt"
           FROM "Users" WHERE "Id" = $1"#,
    )
    .bind(request.user_id)
    .fetch_optional(&state.db)
    .await?;
    let user = user.ok_or_else(ApiError::not_found)?;

    let target_role = UserRole::from_i32(user.role);
    if target_role == UserRole::Admin && !admin.0.is_master() {
        return Err(ApiError::forbidden());
    }
    if target_role == UserRole::MasterAdmin {
        return Err(ApiError::forbidden());
    }

    let hash = password::hash(&request.new_password);
    sqlx::query(r#"UPDATE "Users" SET "PasswordHash" = $1 WHERE "Id" = $2"#)
        .bind(&hash)
        .bind(user.id)
        .execute(&state.db)
        .await?;

    Ok(axum::http::StatusCode::OK.into_response())
}

async fn delete_user(
    State(state): State<AppState>,
    admin: AdminUser,
    Path(id): Path<i32>,
) -> ApiResult<Response> {
    let user = sqlx::query_as::<_, crate::models::UserRow>(
        r#"SELECT "Id", "Email", "PasswordHash", "Role", "CreatedAt"
           FROM "Users" WHERE "Id" = $1"#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?;
    let user = user.ok_or_else(ApiError::not_found)?;

    let target_role = UserRole::from_i32(user.role);
    if target_role == UserRole::Admin && !admin.0.is_master() {
        return Err(ApiError::forbidden());
    }
    if target_role == UserRole::MasterAdmin {
        return Err(ApiError::forbidden());
    }

    sqlx::query(r#"DELETE FROM "Users" WHERE "Id" = $1"#)
        .bind(user.id)
        .execute(&state.db)
        .await?;

    Ok(axum::http::StatusCode::OK.into_response())
}

#[allow(dead_code)]
fn _auth_used(_u: AuthUser) {}
