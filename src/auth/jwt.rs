use chrono::Utc;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;
use crate::models::UserRole;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub iat: i64,
    pub exp: i64,
    pub iss: String,
    pub aud: String,
}

/// Holds the signing/validation material for JWT issuance.
pub struct JwtKeys {
    encoding: EncodingKey,
    decoding: DecodingKey,
    validation: Validation,
    issuer: String,
    audience: String,
    expire_minutes: i64,
}

impl JwtKeys {
    pub fn new(key: &str, issuer: &str, audience: &str, expire_minutes: i64) -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.set_issuer(&[issuer]);
        validation.set_audience(&[audience]);
        validation.leeway = 5;
        Self {
            encoding: EncodingKey::from_secret(key.as_bytes()),
            decoding: DecodingKey::from_secret(key.as_bytes()),
            validation,
            issuer: issuer.to_string(),
            audience: audience.to_string(),
            expire_minutes,
        }
    }

    pub fn issue(&self, user_id: i32, email: &str, role: UserRole) -> Result<String, ApiError> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id.to_string(),
            email: email.to_string(),
            role: role.as_str().to_string(),
            iat: now.timestamp(),
            exp: (now + chrono::Duration::minutes(self.expire_minutes)).timestamp(),
            iss: self.issuer.clone(),
            aud: self.audience.clone(),
        };
        encode(&Header::default(), &claims, &self.encoding)
            .map_err(|err| ApiError::internal(format!("failed to sign token: {err}")))
    }

    pub fn verify(&self, token: &str) -> Result<Claims, ApiError> {
        decode::<Claims>(token, &self.decoding, &self.validation)
            .map(|data| data.claims)
            .map_err(|_| ApiError::unauthorized())
    }
}
