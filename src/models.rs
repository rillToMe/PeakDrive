use chrono::{DateTime, Utc};

/// Role enum matching `ditDriveAPI.Data.UserRole`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UserRole {
    MasterAdmin = 0,
    Admin = 1,
    User = 2,
}

impl UserRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            UserRole::MasterAdmin => "MasterAdmin",
            UserRole::Admin => "Admin",
            UserRole::User => "User",
        }
    }

    pub fn from_name(value: &str) -> Self {
        match value {
            "MasterAdmin" => UserRole::MasterAdmin,
            "Admin" => UserRole::Admin,
            _ => UserRole::User,
        }
    }

    pub fn from_i32(value: i32) -> Self {
        match value {
            0 => UserRole::MasterAdmin,
            1 => UserRole::Admin,
            _ => UserRole::User,
        }
    }

    pub fn is_admin(&self) -> bool {
        matches!(self, UserRole::Admin | UserRole::MasterAdmin)
    }

    pub fn is_master(&self) -> bool {
        matches!(self, UserRole::MasterAdmin)
    }
}

#[derive(Debug, sqlx::FromRow)]
#[sqlx(rename_all = "PascalCase")]
pub struct UserRow {
    pub id: i32,
    pub email: String,
    pub password_hash: String,
    pub role: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[sqlx(rename_all = "PascalCase")]
pub struct FolderRow {
    pub id: i32,
    pub user_id: i32,
    pub public_id: String,
    pub name: String,
    pub parent_id: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[sqlx(rename_all = "PascalCase")]
pub struct FileRow {
    pub id: i32,
    pub user_id: i32,
    pub folder_id: Option<i32>,
    pub public_id: String,
    pub filename: String,
    pub stored_name: String,
    pub thumbnail_name: Option<String>,
    pub file_type: String,
    pub size: i64,
    pub uploaded_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[sqlx(rename_all = "PascalCase")]
pub struct ShareRow {
    pub id: i32,
    pub file_id: Option<i32>,
    pub folder_id: Option<i32>,
    pub token: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, sqlx::FromRow)]
#[sqlx(rename_all = "PascalCase")]
pub struct SavedItemRow {
    pub id: i32,
    pub user_id: i32,
    pub target_type: String,
    pub target_id: i32,
    pub saved_at: DateTime<Utc>,
}
