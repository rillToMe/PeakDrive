use std::net::SocketAddr;

use peakdrive_api::{build_router, config::Config, init_state, spawn_trash_cleanup};

/// Load `.env` from the current working directory before reading config.
///
/// `dotenvy` rejects values containing unquoted `;` (as found in Npgsql-style
/// connection strings), which would abort loading of the *entire* file. When it
/// fails we fall back to a tolerant line parser so a legacy `.env` still works.
fn load_env() {
    match dotenvy::dotenv() {
        Ok(_) => {}
        Err(dotenvy::Error::Io(_)) => {}
        Err(err) => {
            tracing::warn!("dotenvy could not parse .env ({err}); using tolerant fallback");
            load_env_fallback(".env");
        }
    }
}

fn load_env_fallback(path: &str) {
    let Ok(contents) = std::fs::read_to_string(path) else {
        return;
    };
    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let mut value = value.trim();
        // Strip surrounding quotes when present.
        if value.len() >= 2
            && ((value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\'')))
        {
            value = &value[1..value.len() - 1];
        }
        // Do not clobber variables already provided by the real environment.
        if !key.is_empty() && std::env::var_os(key).is_none() {
            std::env::set_var(key, value);
        }
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,peakdrive_api=debug".into()),
        )
        .init();

    load_env();

    let config = match Config::from_env() {
        Ok(config) => config,
        Err(err) => {
            eprintln!("configuration error: {err}");
            std::process::exit(1);
        }
    };

    let bind_addr = config.bind_addr.clone();

    let state = match init_state(config).await {
        Ok(state) => state,
        Err(err) => {
            eprintln!("startup error: {err}");
            std::process::exit(1);
        }
    };

    // Ensure the storage root exists before serving.
    if let Err(err) = std::fs::create_dir_all(&state.config.storage_root) {
        eprintln!("failed to create storage root: {err}");
        std::process::exit(1);
    }

    spawn_trash_cleanup(state.clone());

    let app = build_router(state);

    let addr: SocketAddr = match bind_addr.parse() {
        Ok(addr) => addr,
        Err(err) => {
            eprintln!("invalid bind address {bind_addr}: {err}");
            std::process::exit(1);
        }
    };

    tracing::info!("PeakDrive API listening on http://{addr}");

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(listener) => listener,
        Err(err) => {
            eprintln!("failed to bind {addr}: {err}");
            std::process::exit(1);
        }
    };

    if let Err(err) = axum::serve(listener, app).await {
        eprintln!("server error: {err}");
        std::process::exit(1);
    }
}
