use std::sync::Arc;

use sqlx::PgPool;

use crate::auth::jwt::JwtKeys;
use crate::config::Config;
use crate::treed::service::ThumbnailService;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
    pub jwt: Arc<JwtKeys>,
    pub thumb: ThumbnailService,
}
