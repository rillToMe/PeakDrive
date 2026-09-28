//! Request/response DTOs. Field names use camelCase to match ASP.NET Core's
//! default JSON naming policy, which is what the frontend expects.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use crate::models::{FileRow, FolderRow};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginUser {
    pub id: i32,
    pub email: String,
    pub role: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: LoginUser,
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFolderRequest {
    pub name: String,
    pub parent_public_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameFolderRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderDto {
    pub public_id: String,
    pub name: String,
    pub parent_public_id: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl FolderDto {
    pub fn from_row(folder: &FolderRow, parent_public_id: Option<String>) -> Self {
        Self {
            public_id: folder.public_id.clone(),
            name: folder.name.clone(),
            parent_public_id,
            created_at: folder.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDto {
    pub public_id: String,
    pub filename: String,
    pub file_type: String,
    pub size: i64,
    pub uploaded_at: DateTime<Utc>,
    pub thumbnail_name: Option<String>,
}

impl FileDto {
    pub fn from_row(file: &FileRow) -> Self {
        Self {
            public_id: file.public_id.clone(),
            filename: file.filename.clone(),
            file_type: file.file_type.clone(),
            size: file.size,
            uploaded_at: file.uploaded_at,
            thumbnail_name: file.thumbnail_name.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderListing {
    pub folder: Option<FolderDto>,
    pub folders: Vec<FolderDto>,
    pub files: Vec<FileDto>,
}

#[derive(Debug, Serialize)]
pub struct ExistsResponse {
    pub exists: bool,
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameFileRequest {
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDetailDto {
    pub public_id: String,
    pub filename: String,
    pub file_type: String,
    pub size: i64,
    pub uploaded_at: DateTime<Utc>,
    pub thumbnail_name: Option<String>,
}

impl FileDetailDto {
    pub fn from_row(file: &FileRow) -> Self {
        Self {
            public_id: file.public_id.clone(),
            filename: file.filename.clone(),
            file_type: file.file_type.clone(),
            size: file.size,
            uploaded_at: file.uploaded_at,
            thumbnail_name: file.thumbnail_name.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageUsageDto {
    pub total_bytes: i64,
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashFileDto {
    pub public_id: String,
    pub filename: String,
    pub file_type: String,
    pub size: i64,
    pub uploaded_at: DateTime<Utc>,
    pub folder_public_id: Option<String>,
    pub deleted_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashFolderDto {
    pub public_id: String,
    pub name: String,
    pub parent_public_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub deleted_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashListing {
    pub folders: Vec<TrashFolderDto>,
    pub files: Vec<TrashFileDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanTrashResponse {
    pub cleaned_at: DateTime<Utc>,
    pub removed_folders: i64,
    pub removed_files: i64,
}

// ---------------------------------------------------------------------------
// Saved
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRequest {
    pub target_type: String,
    pub public_id: String,
}

#[derive(Debug, Serialize)]
pub struct SavedStatusResponse {
    pub saved: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedFileDto {
    pub public_id: String,
    pub filename: String,
    pub file_type: String,
    pub size: i64,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedFolderDto {
    pub public_id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedItemDto {
    pub id: i32,
    pub target_type: String,
    pub target_id: i32,
    pub saved_at: DateTime<Utc>,
    pub available: bool,
    pub file: Option<SavedFileDto>,
    pub folder: Option<SavedFolderDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedListResponse {
    pub items: Vec<SavedItemDto>,
    pub total: i64,
}

// ---------------------------------------------------------------------------
// Share
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareResponse {
    pub token: String,
    pub url: String,
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetPasswordRequest {
    pub user_id: i32,
    pub new_password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSummary {
    pub id: i32,
    pub email: String,
    pub role: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityLogDto {
    pub id: i32,
    pub user_id: Option<i32>,
    pub user_email: Option<String>,
    pub action: String,
    pub status: String,
    pub message: String,
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthBasicResponse {
    pub status: String,
    pub service: String,
    pub time: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthDatabaseStatus {
    pub connected: bool,
    pub provider: String,
    pub latency_ms: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthStorageStatus {
    pub exists: bool,
    pub writable: bool,
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthFullResponse {
    pub status: String,
    pub api: bool,
    pub database: HealthDatabaseStatus,
    pub storage: HealthStorageStatus,
}
