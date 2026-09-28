//! Storage path helpers, mirroring the path-safety logic in the C# controllers
//! and `ThumbnailStorage` (all reads/writes are confined to the storage root).

use std::path::{Path, PathBuf};

use crate::config::Config;

/// The storage root (`Storage:RootPath`, resolved against the content root).
pub fn storage_root(config: &Config) -> PathBuf {
    config.storage_root.clone()
}

/// `<root>/thumbnails`.
pub fn thumbnail_root(config: &Config) -> PathBuf {
    storage_root(config).join("thumbnails")
}

fn folder_segment(folder_id: Option<i32>) -> String {
    match folder_id {
        Some(id) => format!("folder_{id}"),
        None => "folder_root".to_string(),
    }
}

/// `true` when `full` is contained within `root` (case-insensitive, matching the
/// Windows-oriented C# `IsWithinRoot`).
pub fn is_within_root(full: &Path, root: &Path) -> bool {
    let full = normalize(full);
    let root = normalize(root);
    let root_str = root.to_string_lossy().to_lowercase();
    let full_str = full.to_string_lossy().to_lowercase();
    if root_str == full_str {
        return true;
    }
    let root_prefix = if root_str.ends_with(std::path::MAIN_SEPARATOR) {
        root_str
    } else {
        format!("{root_str}{}", std::path::MAIN_SEPARATOR)
    };
    full_str.starts_with(&root_prefix)
}

fn normalize(path: &Path) -> PathBuf {
    // Best-effort lexical normalisation without touching the filesystem.
    let mut result = PathBuf::new();
    for component in path.components() {
        use std::path::Component::*;
        match component {
            Prefix(p) => result.push(p.as_os_str()),
            RootDir => result.push(std::path::MAIN_SEPARATOR.to_string()),
            CurDir => {}
            ParentDir => {
                result.pop();
            }
            Normal(part) => result.push(part),
        }
    }
    result
}

/// Directory that holds a user's files for a given folder
/// (`<root>/user_{id}/folder_{folderId|root}`).
pub fn user_folder_dir(config: &Config, user_id: i32, folder_id: Option<i32>) -> PathBuf {
    storage_root(config)
        .join(format!("user_{user_id}"))
        .join(folder_segment(folder_id))
}

/// Absolute path of a stored file, validated to stay within the storage root.
pub fn file_path(
    config: &Config,
    user_id: i32,
    folder_id: Option<i32>,
    stored_name: &str,
) -> Option<PathBuf> {
    let root = storage_root(config);
    let candidate = user_folder_dir(config, user_id, folder_id).join(stored_name);
    if is_within_root(&candidate, &root) {
        Some(candidate)
    } else {
        None
    }
}

/// Absolute path of a thumbnail given its stored relative name. Backslashes are
/// normalised to `/` first: the C# original stored `Path.Combine` output, which
/// used `\` on Windows, but the same rows may be read on a POSIX host.
pub fn thumbnail_path(config: &Config, thumbnail_name: &str) -> Option<PathBuf> {
    let root = thumbnail_root(config);
    let relative = thumbnail_name.replace('\\', "/");
    let candidate = root.join(relative);
    if is_within_root(&candidate, &root) {
        Some(candidate)
    } else {
        None
    }
}

/// Output path for a freshly generated thumbnail
/// (`<thumbnailRoot>/user_{id}/{publicId}.png`).
pub fn thumbnail_output_path(
    config: &Config,
    user_id: i32,
    public_id: &str,
) -> Option<(String, PathBuf)> {
    let name = format!("user_{user_id}/{public_id}.png");
    let path = thumbnail_path(config, &name)?;
    Some((name, path))
}

/// Relative trash path for a thumbnail (`user_{id}/trash/<file>`), or `None`
/// when the current name is not under the user's directory.
pub fn thumbnail_trash_name(thumbnail_name: &str, user_id: i32) -> Option<String> {
    let relative = thumbnail_name.replace('\\', "/");
    let prefix = format!("user_{user_id}/");
    if !relative.to_lowercase().starts_with(&prefix.to_lowercase()) {
        return None;
    }
    let file_name = relative.rsplit('/').next()?;
    Some(format!("user_{user_id}/trash/{file_name}"))
}

/// Relative restore path for a thumbnail (`user_{id}/<file>`), or `None` when
/// the current name is not in the user's trash directory.
pub fn thumbnail_restore_name(thumbnail_name: &str, user_id: i32) -> Option<String> {
    let relative = thumbnail_name.replace('\\', "/");
    let prefix = format!("user_{user_id}/trash/");
    if !relative.to_lowercase().starts_with(&prefix.to_lowercase()) {
        return None;
    }
    let file_name = relative.rsplit('/').next()?;
    Some(format!("user_{user_id}/{file_name}"))
}

pub fn ensure_parent_dir(path: &Path) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    Ok(())
}
