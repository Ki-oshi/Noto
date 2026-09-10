use std::sync::Mutex;

use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305, Key, Nonce,
};
use hkdf::Hkdf;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use zeroize::Zeroize;

// Recommended Argon2id parameters (OWASP Password Storage Cheat Sheet's
// single-threaded profile): 19 MiB memory, 2 iterations, 1 thread.
// Stored per-vault in vault_config so they can be upgraded later
// without breaking existing vaults.
const KDF_MEMORY_KIB: u32 = 19_456;
const KDF_ITERATIONS: u32 = 2;
const KDF_PARALLELISM: u32 = 1;
const SALT_LEN: usize = 16;
const KEY_LEN: usize = 32;

// A fixed, known plaintext encrypted with the verification key at
// vault setup time. On unlock, we re-derive keys from the entered
// password and try to decrypt the stored verifier: success (the AEAD
// auth tag matches) means the password was correct — without the
// password, or any derived key, ever being written to disk.
const VERIFIER_PLAINTEXT: &[u8] = b"noto-vault-verifier-v1";

/// Holds the vault's encryption key for the current unlocked session.
/// Never exposed to the frontend. Cleared and zeroized on lock, on a
/// failed unlock attempt, and when the app state is dropped.
#[derive(Default)]
pub struct VaultState(pub Mutex<Option<SessionKey>>);

pub struct SessionKey([u8; KEY_LEN]);

impl Drop for SessionKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

#[derive(Debug, thiserror::Error)]
pub enum VaultError {
    #[error("the vault is locked")]
    Locked,
    #[error("incorrect master password")]
    IncorrectPassword,
    #[error("crypto operation failed")]
    CryptoFailure,
    #[error("invalid input: {0}")]
    InvalidInput(String),
}

// Tauri serializes command errors back to the frontend as JSON; a
// plain string is all the UI needs (it never needs to branch on error
// variants, just show a message).
impl Serialize for VaultError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

fn derive_keys(password: &str, salt: &[u8]) -> Result<([u8; KEY_LEN], [u8; KEY_LEN]), VaultError> {
    let params = Params::new(KDF_MEMORY_KIB, KDF_ITERATIONS, KDF_PARALLELISM, Some(KEY_LEN))
        .map_err(|_| VaultError::CryptoFailure)?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut master_key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut master_key)
        .map_err(|_| VaultError::CryptoFailure)?;

    // Split the master key into two independent subkeys via HKDF, so
    // the verifier check (which only needs the verification subkey)
    // never has access to material usable to decrypt real secrets.
    let hk = Hkdf::<Sha256>::new(None, &master_key);
    master_key.zeroize();

    let mut verification_key = [0u8; KEY_LEN];
    hk.expand(b"noto-vault-verification", &mut verification_key)
        .map_err(|_| VaultError::CryptoFailure)?;

    let mut encryption_key = [0u8; KEY_LEN];
    hk.expand(b"noto-vault-encryption", &mut encryption_key)
        .map_err(|_| VaultError::CryptoFailure)?;

    Ok((verification_key, encryption_key))
}

fn encrypt_with_key(key: &[u8; KEY_LEN], plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), VaultError> {
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| VaultError::CryptoFailure)?;
    Ok((ciphertext, nonce.to_vec()))
}

fn decrypt_with_key(
    key: &[u8; KEY_LEN],
    ciphertext: &[u8],
    nonce: &[u8],
) -> Result<Vec<u8>, VaultError> {
    if nonce.len() != 12 {
        return Err(VaultError::InvalidInput("invalid nonce length".into()));
    }
    let cipher = ChaCha20Poly1305::new(Key::from_slice(key));
    let nonce = Nonce::from_slice(nonce);
    cipher
        .decrypt(nonce, ciphertext)
        // A failed AEAD decrypt (wrong key/tampered data) is
        // indistinguishable from "wrong password" here, which is
        // exactly what we want for the verifier check.
        .map_err(|_| VaultError::IncorrectPassword)
}

// ---------- Types crossing the JS <-> Rust boundary ----------
//
// BLOB columns (kdf_salt, verifier, verifier_nonce, secret_data,
// secret_nonce) are represented as base64 strings here, since Tauri's
// IPC serializes command payloads as JSON. The frontend stores these
// strings directly into the corresponding SQLite BLOB-affinity
// columns via the SQL plugin; SQLite accepts them as-is.

#[derive(Serialize)]
pub struct VaultSetupResult {
    pub kdf_salt: String,
    pub kdf_memory_kib: u32,
    pub kdf_iterations: u32,
    pub kdf_parallelism: u32,
    pub verifier: String,
    pub verifier_nonce: String,
}

#[derive(Deserialize)]
pub struct VaultConfigInput {
    pub kdf_salt: String,
    pub verifier: String,
    pub verifier_nonce: String,
}

#[derive(Serialize)]
pub struct EncryptedPayload {
    pub ciphertext: String,
    pub nonce: String,
}

// ---------- Tauri commands ----------

/// Creates a brand-new vault: generates a random salt, derives keys
/// from the given master password, and encrypts the verifier. Does
/// NOT unlock the vault — the frontend should write the returned
/// fields into vault_config, then call vault_unlock.
#[tauri::command]
pub fn vault_setup(password: String) -> Result<VaultSetupResult, VaultError> {
    if password.len() < 8 {
        return Err(VaultError::InvalidInput(
            "Master password must be at least 8 characters.".into(),
        ));
    }

    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);

    let (verification_key, mut encryption_key) = derive_keys(&password, &salt)?;
    encryption_key.zeroize();

    let (ciphertext, nonce) = encrypt_with_key(&verification_key, VERIFIER_PLAINTEXT)?;

    Ok(VaultSetupResult {
        kdf_salt: BASE64.encode(salt),
        kdf_memory_kib: KDF_MEMORY_KIB,
        kdf_iterations: KDF_ITERATIONS,
        kdf_parallelism: KDF_PARALLELISM,
        verifier: BASE64.encode(ciphertext),
        verifier_nonce: BASE64.encode(nonce),
    })
}

/// Attempts to unlock the vault with the given master password against
/// a previously stored vault_config row. On success, holds the
/// encryption subkey in memory for this session (never returned to
/// the frontend). On failure, returns VaultError::IncorrectPassword
/// and the vault stays locked.
#[tauri::command]
pub fn vault_unlock(
    password: String,
    config: VaultConfigInput,
    state: tauri::State<VaultState>,
) -> Result<(), VaultError> {
    let salt = BASE64
        .decode(&config.kdf_salt)
        .map_err(|_| VaultError::InvalidInput("invalid salt".into()))?;
    let verifier = BASE64
        .decode(&config.verifier)
        .map_err(|_| VaultError::InvalidInput("invalid verifier".into()))?;
    let verifier_nonce = BASE64
        .decode(&config.verifier_nonce)
        .map_err(|_| VaultError::InvalidInput("invalid verifier nonce".into()))?;

    let (verification_key, encryption_key) = derive_keys(&password, &salt)?;

    // Decrypting the verifier IS the password check: a wrong password
    // derives a wrong verification_key, which fails the AEAD auth tag.
    decrypt_with_key(&verification_key, &verifier, &verifier_nonce)?;

    let mut guard = state.0.lock().map_err(|_| VaultError::CryptoFailure)?;
    *guard = Some(SessionKey(encryption_key));

    Ok(())
}

/// Clears the in-memory session key. The vault must be unlocked again
/// with the master password before any entry can be decrypted.
#[tauri::command]
pub fn vault_lock(state: tauri::State<VaultState>) -> Result<(), VaultError> {
    let mut guard = state.0.lock().map_err(|_| VaultError::CryptoFailure)?;
    *guard = None;
    Ok(())
}

#[tauri::command]
pub fn vault_is_unlocked(state: tauri::State<VaultState>) -> Result<bool, VaultError> {
    let guard = state.0.lock().map_err(|_| VaultError::CryptoFailure)?;
    Ok(guard.is_some())
}

/// Encrypts a password entry's secret JSON payload (e.g.
/// `{"password":"...","notes":"..."}`) using the current session's key.
/// Fails with VaultError::Locked if the vault hasn't been unlocked.
#[tauri::command]
pub fn vault_encrypt_secret(
    plaintext: String,
    state: tauri::State<VaultState>,
) -> Result<EncryptedPayload, VaultError> {
    let guard = state.0.lock().map_err(|_| VaultError::CryptoFailure)?;
    let key = guard.as_ref().ok_or(VaultError::Locked)?;

    let (ciphertext, nonce) = encrypt_with_key(&key.0, plaintext.as_bytes())?;

    Ok(EncryptedPayload {
        ciphertext: BASE64.encode(ciphertext),
        nonce: BASE64.encode(nonce),
    })
}

/// Decrypts a password entry's secret JSON payload using the current
/// session's key. Fails with VaultError::Locked if the vault hasn't
/// been unlocked this session.
#[tauri::command]
pub fn vault_decrypt_secret(
    ciphertext: String,
    nonce: String,
    state: tauri::State<VaultState>,
) -> Result<String, VaultError> {
    let guard = state.0.lock().map_err(|_| VaultError::CryptoFailure)?;
    let key = guard.as_ref().ok_or(VaultError::Locked)?;

    let ciphertext = BASE64
        .decode(&ciphertext)
        .map_err(|_| VaultError::InvalidInput("invalid ciphertext".into()))?;
    let nonce = BASE64
        .decode(&nonce)
        .map_err(|_| VaultError::InvalidInput("invalid nonce".into()))?;

    let plaintext = decrypt_with_key(&key.0, &ciphertext, &nonce)?;

    String::from_utf8(plaintext).map_err(|_| VaultError::CryptoFailure)
}