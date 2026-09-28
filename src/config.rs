use std::path::PathBuf;

/// Application configuration, loaded from environment variables (populated from
/// `.env` at startup). Mirrors the `appsettings.json` + `.env` keys used by the
/// original ASP.NET Core backend.
#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub jwt_key: String,
    pub jwt_issuer: String,
    pub jwt_audience: String,
    pub jwt_expire_minutes: i64,
    pub content_root: PathBuf,
    pub storage_root: PathBuf,
    /// The configured (possibly relative) storage root, as reported by the
    /// health endpoint for parity with the original backend.
    pub storage_root_rel: String,
    pub share_base_url: String,
    pub seed_master_email: Option<String>,
    pub seed_master_password: Option<String>,
    pub trash_retention_days: i64,
    pub bind_addr: String,
}

fn env_opt(key: &str) -> Option<String> {
    std::env::var(key).ok().filter(|v| !v.trim().is_empty())
}

fn env_or(key: &str, default: &str) -> String {
    env_opt(key).unwrap_or_else(|| default.to_string())
}

/// Accept either a `postgres://` URL (sqlx native) or the Npgsql key/value form
/// used by the original ASP.NET Core `.env` (`Host=..;Port=..;Database=..;`).
fn normalize_database_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim().trim_matches('"');
    if trimmed.starts_with("postgres://") || trimmed.starts_with("postgresql://") {
        return Ok(trimmed.to_string());
    }

    // Parse `Key=Value;Key=Value` pairs (case-insensitive keys).
    let mut host = None;
    let mut port = None;
    let mut database = None;
    let mut username = None;
    let mut password = None;
    let mut sslmode = None;

    for part in trimmed.split(';') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let Some((key, value)) = part.split_once('=') else {
            continue;
        };
        let key = key.trim().to_ascii_lowercase().replace(' ', "");
        let value = value.trim();
        match key.as_str() {
            "host" | "server" | "datasource" => host = Some(value.to_string()),
            "port" => port = Some(value.to_string()),
            "database" | "initialcatalog" => database = Some(value.to_string()),
            "username" | "userid" | "user" => username = Some(value.to_string()),
            "password" | "pwd" => password = Some(value.to_string()),
            "sslmode" => sslmode = Some(value.to_ascii_lowercase()),
            _ => {}
        }
    }

    let host = host.ok_or_else(|| "connection string is missing Host".to_string())?;
    let database = database.unwrap_or_else(|| "postgres".to_string());
    let username = username.unwrap_or_else(|| "postgres".to_string());

    let mut url = String::from("postgres://");
    url.push_str(&urlencode(&username));
    if let Some(password) = password {
        url.push(':');
        url.push_str(&urlencode(&password));
    }
    url.push('@');
    url.push_str(&host);
    if let Some(port) = port {
        url.push(':');
        url.push_str(&port);
    }
    url.push('/');
    url.push_str(&database);

    // Map Npgsql SSL modes onto sqlx's `sslmode` parameter.
    if let Some(mode) = sslmode {
        let mapped = match mode.as_str() {
            "disable" => Some("disable"),
            "allow" | "prefer" => Some("prefer"),
            "require" => Some("require"),
            "verifyca" | "verifyfull" | "verify-full" => Some("verify-full"),
            _ => None,
        };
        if let Some(mapped) = mapped {
            url.push_str(&format!("?sslmode={mapped}"));
        }
    }

    Ok(url)
}

/// Percent-encode the characters that are unsafe inside URL userinfo.
fn urlencode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// Tolerate a stray `"BaseUrl":` prefix that appeared in the legacy `.env`
/// (the value there was `"BaseUrl":https://…/s/`).
fn normalize_share_base(raw: &str) -> String {
    let trimmed = raw.trim();
    // Strip the stray prefix first, while its leading quote is still present.
    let stripped = trimmed
        .strip_prefix("\"BaseUrl\":")
        .or_else(|| trimmed.strip_prefix("BaseUrl:"))
        .unwrap_or(trimmed);
    stripped
        .trim()
        .trim_matches('"')
        .trim_end_matches('/')
        .to_string()
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let content_root =
            std::env::current_dir().map_err(|e| format!("failed to resolve current dir: {e}"))?;

        let database_url = normalize_database_url(
            &env_opt("ConnectionStrings__Default")
                .ok_or_else(|| "ConnectionStrings__Default is missing.".to_string())?,
        )?;

        let jwt_key = env_opt("Jwt__Key").ok_or_else(|| {
            "JWT key is missing. Set Jwt:Key in configuration or environment variables.".to_string()
        })?;

        let storage_rel = env_or("Storage__RootPath", "storage");
        let storage_path = PathBuf::from(&storage_rel);
        let storage_root = if storage_path.is_absolute() {
            storage_path
        } else {
            content_root.join(storage_path)
        };

        let jwt_expire_minutes = env_opt("Jwt__ExpireMinutes")
            .and_then(|v| v.parse().ok())
            .unwrap_or(720);
        let trash_retention_days = env_opt("Trash__RetentionDays")
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let bind_addr = env_opt("BIND_ADDR")
            .or_else(|| env_opt("Server__Bind"))
            .unwrap_or_else(|| "0.0.0.0:5133".to_string());

        Ok(Self {
            database_url,
            jwt_key,
            jwt_issuer: env_or("Jwt__Issuer", "PeakDrive"),
            jwt_audience: env_or("Jwt__Audience", "PeakDriveUsers"),
            jwt_expire_minutes,
            content_root,
            storage_root,
            storage_root_rel: storage_rel,
            share_base_url: normalize_share_base(&env_or(
                "Share__BaseUrl",
                "https://drive.aetherstudio.web.id",
            )),
            seed_master_email: env_opt("Seed__MasterEmail"),
            seed_master_password: env_opt("Seed__MasterPassword"),
            trash_retention_days,
            bind_addr,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn npgsql_string_is_converted() {
        let raw = "Host=ep-x-pooler.aws.neon.tech;Port=5432;Database=neondb;\
                   Username=neondb_owner;Password=npg_AbC; SSL Mode=VerifyFull;;Trust Server Certificate=true";
        let url = normalize_database_url(raw).unwrap();
        assert!(url
            .starts_with("postgres://neondb_owner:npg_AbC@ep-x-pooler.aws.neon.tech:5432/neondb"));
        assert!(url.contains("sslmode=verify-full"));
    }

    #[test]
    fn postgres_url_is_passed_through() {
        let url = normalize_database_url("postgres://u:p@host:5432/db").unwrap();
        assert_eq!(url, "postgres://u:p@host:5432/db");
    }

    #[test]
    fn share_base_strips_stray_prefix() {
        assert_eq!(
            normalize_share_base("\"BaseUrl\":https://drive.example.com/s/"),
            "https://drive.example.com/s"
        );
        assert_eq!(
            normalize_share_base("https://drive.example.com/"),
            "https://drive.example.com"
        );
    }
}
