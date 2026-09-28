pub mod auth;
pub mod config;
pub mod dto;
pub mod error;
pub mod models;
pub mod routes;
pub mod services;
pub mod state;
pub mod storage;
pub mod treed;

use std::sync::Arc;

use axum::extract::DefaultBodyLimit;
use axum::Router;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{Any, CorsLayer};

use crate::auth::JwtKeys;
use crate::config::Config;
use crate::state::AppState;
use crate::treed::ThumbnailService;

/// Maximum request body size (uploads). Matches the 5 GB limit configured on
/// the original ASP.NET Core backend.
const MAX_BODY_BYTES: usize = 5 * 1024 * 1024 * 1024;

/// Build the application router. Exposed so integration tests can mount it.
pub fn build_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .merge(routes::health::router())
        .merge(routes::auth::router())
        .merge(routes::folders::router())
        .merge(routes::files::router())
        .merge(routes::trash::router())
        .merge(routes::saved::router())
        .merge(routes::share::router())
        .merge(routes::admin::router())
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(cors)
        .with_state(state)
}

/// Connect to the database, run migrations, and seed the master admin.
pub async fn init_state(config: Config) -> Result<AppState, Box<dyn std::error::Error>> {
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    // Seed the master admin if no users exist.
    let user_count: i64 = sqlx::query_scalar(r#"SELECT COUNT(*) FROM "Users""#)
        .fetch_one(&pool)
        .await?;
    if user_count == 0 {
        match (&config.seed_master_email, &config.seed_master_password) {
            (Some(email), Some(password)) => {
                let hash = auth::password::hash(password);
                sqlx::query(
                    r#"INSERT INTO "Users" ("Email", "PasswordHash", "Role", "CreatedAt")
                       VALUES ($1, $2, $3, $4)"#,
                )
                .bind(email)
                .bind(hash)
                .bind(models::UserRole::MasterAdmin as i32)
                .bind(chrono::Utc::now())
                .execute(&pool)
                .await?;
                tracing::info!("seeded master admin {email}");
            }
            _ => {
                tracing::warn!(
                    "MasterAdmin seed skipped: Seed__MasterEmail or Seed__MasterPassword not set."
                );
            }
        }
    }

    let config = Arc::new(config);
    let jwt = Arc::new(JwtKeys::new(
        &config.jwt_key,
        &config.jwt_issuer,
        &config.jwt_audience,
        config.jwt_expire_minutes,
    ));
    let thumb = ThumbnailService::new(config.clone());

    Ok(AppState {
        db: pool,
        config,
        jwt,
        thumb,
    })
}

/// Spawn the daily trash-cleanup task when a positive retention window is set.
pub fn spawn_trash_cleanup(state: AppState) {
    let retention_days = state.config.trash_retention_days;
    if retention_days <= 0 {
        return;
    }
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(24 * 60 * 60));
        // Skip the immediate first tick; the original ran cleanup on startup too.
        loop {
            interval.tick().await;
            let cutoff = chrono::Utc::now() - chrono::Duration::days(retention_days);
            if let Err(err) = routes::trash::cleanup_trash(&state, cutoff).await {
                tracing::error!("trash cleanup failed: {err}");
            }
        }
    });
}
