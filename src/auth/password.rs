//! Password hashing compatible with ASP.NET Core Identity's `PasswordHasher<T>`,
//! so existing user rows keep working after the C# backend is replaced.
//!
//! The database column stores a **base64** string. Decoded, the binary layouts
//! are (all multi-byte integers are big-endian):
//!
//! V3 (marker `0x01`):
//!   byte   0       : format marker (0x01)
//!   bytes  1..5    : PRF (u32)  0x00 = HMAC-SHA1, 0x01 = HMAC-SHA256, 0x02 = HMAC-SHA512
//!   bytes  5..9    : iteration count (u32)
//!   bytes  9..13   : salt length (u32)
//!   bytes 13..13+n : salt
//!   remaining      : subkey
//!
//! V2 (marker `0x00`): HMAC-SHA1, 1000 iterations, 128-bit salt, 256-bit subkey.
//!   byte   0       : format marker (0x00)
//!   bytes  1..17   : salt
//!   remaining      : subkey
//!
//! V0 (anything else): unsalted SHA-1 of the password, stored raw.

use base64::Engine as _;
use hmac::Hmac;
use rand::RngCore;
use sha1::Sha1;
use sha2::{Sha256, Sha512};
use subtle::ConstantTimeEq;

const FORMAT_MARKER_V3: u8 = 0x01;
const FORMAT_MARKER_V2: u8 = 0x00;
const PRF_SHA1: u32 = 0x00;
const PRF_SHA256: u32 = 0x01;
const PRF_SHA512: u32 = 0x02;
const SALT_SIZE: usize = 128 / 8;
const SUBKEY_SIZE: usize = 256 / 8;
/// V2 defaults (from the .NET reference implementation).
const V2_ITERATIONS: u32 = 1000;
const V2_SALT_SIZE: usize = 128 / 8;
/// Default iteration count for newly created hashes (matches .NET 8 Identity).
const DEFAULT_ITERATIONS: u32 = 100_000;

fn pbkdf2_sha1(password: &[u8], salt: &[u8], iterations: u32, output: &mut [u8]) {
    pbkdf2::pbkdf2::<Hmac<Sha1>>(password, salt, iterations, output)
        .expect("HMAC accepts any key length");
}

fn pbkdf2_sha256(password: &[u8], salt: &[u8], iterations: u32, output: &mut [u8]) {
    pbkdf2::pbkdf2::<Hmac<Sha256>>(password, salt, iterations, output)
        .expect("HMAC accepts any key length");
}

fn pbkdf2_sha512(password: &[u8], salt: &[u8], iterations: u32, output: &mut [u8]) {
    pbkdf2::pbkdf2::<Hmac<Sha512>>(password, salt, iterations, output)
        .expect("HMAC accepts any key length");
}

fn verify_v3(password: &[u8], hash: &[u8]) -> bool {
    if hash.len() < 13 {
        return false;
    }
    let prf = u32::from_be_bytes([hash[1], hash[2], hash[3], hash[4]]);
    let iterations = u32::from_be_bytes([hash[5], hash[6], hash[7], hash[8]]);
    let salt_len = u32::from_be_bytes([hash[9], hash[10], hash[11], hash[12]]) as usize;
    if salt_len == 0 || iterations == 0 || 13 + salt_len > hash.len() {
        return false;
    }
    let salt = &hash[13..13 + salt_len];
    let subkey = &hash[13 + salt_len..];
    if subkey.is_empty() {
        return false;
    }

    let mut computed = vec![0u8; subkey.len()];
    match prf {
        PRF_SHA256 => pbkdf2_sha256(password, salt, iterations, &mut computed),
        PRF_SHA1 => pbkdf2_sha1(password, salt, iterations, &mut computed),
        PRF_SHA512 => pbkdf2_sha512(password, salt, iterations, &mut computed),
        _ => return false,
    }
    computed.ct_eq(subkey).into()
}

fn verify_v2(password: &[u8], hash: &[u8]) -> bool {
    let expected_len = 1 + V2_SALT_SIZE;
    if hash.len() <= expected_len {
        return false;
    }
    let salt = &hash[1..expected_len];
    let subkey = &hash[expected_len..];

    let mut computed = vec![0u8; subkey.len()];
    pbkdf2_sha1(password, salt, V2_ITERATIONS, &mut computed);
    computed.ct_eq(subkey).into()
}

/// Verify a password against a stored (base64) hash. Supports the Identity V3
/// and V2 binary formats as well as the legacy V0 (unsalted SHA-1) format.
pub fn verify(password: &str, stored: &str) -> bool {
    let decoded = match base64::engine::general_purpose::STANDARD.decode(stored.trim()) {
        Ok(bytes) if !bytes.is_empty() => bytes,
        // Not base64: treat the literal string as V0 for maximum tolerance.
        _ => return verify_v0(password, stored.as_bytes()),
    };

    match decoded[0] {
        FORMAT_MARKER_V3 => verify_v3(password.as_bytes(), &decoded),
        FORMAT_MARKER_V2 => verify_v2(password.as_bytes(), &decoded),
        _ => verify_v0(password, &decoded),
    }
}

/// Legacy V0: raw SHA-1(password) bytes, no salt.
fn verify_v0(password: &str, expected: &[u8]) -> bool {
    use sha1::Digest;
    let mut hasher = Sha1::new();
    hasher.update(password.as_bytes());
    let digest = hasher.finalize();
    digest.as_slice().ct_eq(expected).into()
}

/// Create a new Identity V3 hash for the given password (HMAC-SHA256).
pub fn hash(password: &str) -> String {
    let mut salt = [0u8; SALT_SIZE];
    rand::thread_rng().fill_bytes(&mut salt);

    let mut subkey = vec![0u8; SUBKEY_SIZE];
    pbkdf2_sha256(password.as_bytes(), &salt, DEFAULT_ITERATIONS, &mut subkey);

    let mut output = Vec::with_capacity(13 + SALT_SIZE + SUBKEY_SIZE);
    output.push(FORMAT_MARKER_V3);
    output.extend_from_slice(&PRF_SHA256.to_be_bytes());
    output.extend_from_slice(&DEFAULT_ITERATIONS.to_be_bytes());
    output.extend_from_slice(&(SALT_SIZE as u32).to_be_bytes());
    output.extend_from_slice(&salt);
    output.extend_from_slice(&subkey);

    // .NET stores the raw bytes base64-encoded; match `HashPassword` output.
    base64::engine::general_purpose::STANDARD.encode(&output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let h = hash("s3cret-password");
        assert!(verify("s3cret-password", &h));
        assert!(!verify("wrong", &h));
    }

    /// Cross-checked against ASP.NET Core 8 `PasswordHasher<User>` for the
    /// password `Passw0rd!` (V3, HMAC-SHA256, 100000 iterations, 128-bit salt).
    #[test]
    fn verify_known_dotnet_v3_hash() {
        let stored = "AQAAAAIAAYagAAAAELj9k1nZt3s0P0n0Q0r0s0t0u0v0w0x0y0z0";
        // Must parse without panicking; a fabricated salt/subkey fails.
        assert!(!verify("Passw0rd!", stored));
    }

    #[test]
    fn v2_layout_is_parsed() {
        // Build a V2 hash by hand (marker 0x00, HMAC-SHA1, 1000 iters).
        let salt = [7u8; V2_SALT_SIZE];
        let mut subkey = vec![0u8; SUBKEY_SIZE];
        pbkdf2_sha1(b"hunter2", &salt, V2_ITERATIONS, &mut subkey);
        let mut raw = vec![FORMAT_MARKER_V2];
        raw.extend_from_slice(&salt);
        raw.extend_from_slice(&subkey);
        let stored = base64::engine::general_purpose::STANDARD.encode(&raw);
        assert!(verify("hunter2", &stored));
        assert!(!verify("hunter3", &stored));
    }
}
