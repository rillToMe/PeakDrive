use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;

use crate::dto::{
    HealthBasicResponse, HealthDatabaseStatus, HealthFullResponse, HealthStorageStatus,
};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(basic))
        .route("/health/full", get(full))
}

async fn basic() -> Json<HealthBasicResponse> {
    Json(HealthBasicResponse {
        status: "ok".to_string(),
        service: "ditDriveAPI".to_string(),
        time: Utc::now(),
    })
}

async fn full(State(state): State<AppState>) -> Json<HealthFullResponse> {
    let database = check_database(&state).await;
    let storage = check_storage(&state);
    let api = true;
    let status = if api && database.connected && storage.exists && storage.writable {
        "ok"
    } else {
        "fail"
    };
    Json(HealthFullResponse {
        status: status.to_string(),
        api,
        database,
        storage,
    })
}

async fn check_database(state: &AppState) -> HealthDatabaseStatus {
    let start = std::time::Instant::now();
    match sqlx::query("SELECT 1").execute(&state.db).await {
        Ok(_) => HealthDatabaseStatus {
            connected: true,
            provider: "Neon PostgreSQL".to_string(),
            latency_ms: start.elapsed().as_millis() as i64,
        },
        Err(_) => HealthDatabaseStatus {
            connected: false,
            provider: "Neon PostgreSQL".to_string(),
            latency_ms: -1,
        },
    }
}

fn check_storage(state: &AppState) -> HealthStorageStatus {
    let root = &state.config.storage_root;
    // The original backend reported the configured (relative) root, e.g. "storage/".
    let relative = format!(
        "{}/",
        state.config.storage_root_rel.trim_end_matches(['/', '\\'])
    );

    let mut exists = root.is_dir();
    if !exists {
        exists = std::fs::create_dir_all(root).is_ok() && root.is_dir();
    }

    let mut writable = false;
    if exists {
        let temp = root.join(format!("health_{}.tmp", uuid::Uuid::new_v4().simple()));
        if std::fs::write(&temp, "ok").is_ok() {
            let _ = std::fs::remove_file(&temp);
            writable = true;
        }
    }

    HealthStorageStatus {
        exists,
        writable,
        path: relative,
    }
}
