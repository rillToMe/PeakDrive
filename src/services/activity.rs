use chrono::Utc;
use sqlx::PgPool;

/// Append an activity log entry. Mirrors the C# `LogActivity` helper, which
/// swallows all errors so logging never breaks the request path.
pub async fn log_activity(
    db: &PgPool,
    user_id: Option<i32>,
    action: &str,
    status: &str,
    message: &str,
) {
    let result = sqlx::query(
        r#"INSERT INTO "ActivityLogs" ("UserId", "Action", "Status", "Message", "CreatedAt")
           VALUES ($1, $2, $3, $4, $5)"#,
    )
    .bind(user_id)
    .bind(action)
    .bind(status)
    .bind(message)
    .bind(Utc::now())
    .execute(db)
    .await;

    if let Err(err) = result {
        tracing::warn!("failed to write activity log: {err}");
    }
}
