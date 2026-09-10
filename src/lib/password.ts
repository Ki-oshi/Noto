import { invoke } from "@tauri-apps/api/core"
import Database from "@tauri-apps/plugin-sql"

export interface PasswordFolder {
  id: string
  workspace_id: string | null
  name: string
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface PasswordEntry {
  id: string
  workspace_id: string | null
  folder_id: string | null
  title: string
  username: string | null
  website_url: string | null
  secret_data: string // base64 ciphertext — opaque until decrypted
  secret_nonce: string // base64
  encryption_version: number
  is_favorite: number
  metadata: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface DecryptedSecret {
  password: string
  notes: string
}

export interface EntryMetaEdits {
  title: string
  username: string | null
  website_url: string | null
  folder_id: string | null
}

interface VaultConfigRow {
  id: number
  kdf_algorithm: string
  kdf_salt: string
  kdf_memory_kib: number
  kdf_iterations: number
  kdf_parallelism: number
  verifier: string
  verifier_nonce: string
  encryption_version: number
  created_at: string
  updated_at: string
}

// Mirrors vault.rs's VaultSetupResult / EncryptedPayload exactly —
// neither Rust struct uses #[serde(rename_all = "camelCase")], so the
// field names crossing the IPC boundary stay snake_case.
interface VaultSetupResult {
  kdf_salt: string
  kdf_memory_kib: number
  kdf_iterations: number
  kdf_parallelism: number
  verifier: string
  verifier_nonce: string
}

interface EncryptedPayload {
  ciphertext: string
  nonce: string
}

let dbPromise: ReturnType<typeof Database.load> | null = null

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:noto.db")
  }

  return dbPromise
}

function generateId() {
  return crypto.randomUUID()
}

// ---------- Vault lifecycle ----------
//
// All actual cryptography happens in src-tauri/src/vault.rs. This
// file never sees the master password's derived keys — it only ever
// passes the password itself through to Rust for setup/unlock, and
// otherwise moves opaque ciphertext blobs between SQLite and Rust.

export async function getVaultConfig(): Promise<VaultConfigRow | null> {
  const db = await getDatabase()

  const rows = await db.select<VaultConfigRow[]>(
    `SELECT * FROM vault_config WHERE id = 1 LIMIT 1`,
  )

  return rows[0] ?? null
}

export async function isVaultConfigured(): Promise<boolean> {
  return (await getVaultConfig()) !== null
}

export async function isVaultUnlocked(): Promise<boolean> {
  return invoke<boolean>("vault_is_unlocked")
}

/**
 * First-time setup: derives keys from the given master password in
 * Rust, writes the resulting (non-secret) KDF parameters and verifier
 * into vault_config, then unlocks the vault so entries can be added
 * immediately.
 */
export async function setupVault(password: string): Promise<void> {
  const setup = await invoke<VaultSetupResult>("vault_setup", { password })

  const db = await getDatabase()

  await db.execute(
    `
    INSERT INTO vault_config (
      id, kdf_algorithm, kdf_salt, kdf_memory_kib, kdf_iterations,
      kdf_parallelism, verifier, verifier_nonce
    )
    VALUES (1, 'argon2id', $1, $2, $3, $4, $5, $6)
    `,
    [
      setup.kdf_salt,
      setup.kdf_memory_kib,
      setup.kdf_iterations,
      setup.kdf_parallelism,
      setup.verifier,
      setup.verifier_nonce,
    ],
  )

  await unlockVault(password)
}

/**
 * Attempts to unlock the vault with the given master password. Throws
 * (with the message from vault.rs) if the vault isn't set up yet or
 * the password is wrong.
 */
export async function unlockVault(password: string): Promise<void> {
  const config = await getVaultConfig()

  if (!config) {
    throw new Error("Vault has not been set up yet.")
  }

  await invoke("vault_unlock", {
    password,
    config: {
      kdf_salt: config.kdf_salt,
      verifier: config.verifier,
      verifier_nonce: config.verifier_nonce,
    },
  })
}

export async function lockVault(): Promise<void> {
  await invoke("vault_lock")
}

// ---------- Folders ----------
//
// Folder names are not secrets, so these are plain SQL like every
// other module — no Rust round-trip needed.

export async function getFolders(): Promise<PasswordFolder[]> {
  const db = await getDatabase()

  return db.select<PasswordFolder[]>(
    `SELECT * FROM password_folders ORDER BY name ASC`,
  )
}

export async function createFolder(
  name: string,
  parent_id: string | null = null,
): Promise<PasswordFolder> {
  const db = await getDatabase()
  const id = generateId()

  await db.execute(
    `
    INSERT INTO password_folders (id, workspace_id, name, parent_id)
    VALUES ($1, 'default', $2, $3)
    `,
    [id, name, parent_id],
  )

  const rows = await db.select<PasswordFolder[]>(
    `SELECT * FROM password_folders WHERE id = $1 LIMIT 1`,
    [id],
  )

  const folder = rows[0]

  if (!folder) {
    throw new Error("Failed to create folder")
  }

  return folder
}

export async function deleteFolder(id: string): Promise<void> {
  const db = await getDatabase()

  // No deleted_at column on password_folders, so this is a hard
  // delete. password_entries.folder_id is ON DELETE SET NULL, but
  // that only fires if `PRAGMA foreign_keys = ON` is set on the
  // connection — otherwise entries keep a dangling folder_id, which
  // the UI should treat the same as "no folder".
  await db.execute(`DELETE FROM password_folders WHERE id = $1`, [id])
}

// ---------- Entries: metadata ----------
//
// title/username/website_url/folder_id are not secrets and are read
// directly with SQL, same as everywhere else. Only secret_data /
// secret_nonce ever pass through Rust.

export async function getEntries(): Promise<PasswordEntry[]> {
  const db = await getDatabase()

  return db.select<PasswordEntry[]>(
    `
    SELECT *
    FROM password_entries
    WHERE deleted_at IS NULL
    ORDER BY title ASC
    `,
  )
}

export async function getEntry(id: string): Promise<PasswordEntry | null> {
  const db = await getDatabase()

  const rows = await db.select<PasswordEntry[]>(
    `
    SELECT *
    FROM password_entries
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [id],
  )

  return rows[0] ?? null
}

/**
 * Creates a new entry. The vault must be unlocked — vault_encrypt_secret
 * throws "the vault is locked" otherwise, and nothing is written.
 */
export async function createEntry(
  meta: EntryMetaEdits,
  secret: DecryptedSecret,
): Promise<PasswordEntry> {
  const payload = await invoke<EncryptedPayload>("vault_encrypt_secret", {
    plaintext: JSON.stringify(secret),
  })

  const db = await getDatabase()
  const id = generateId()

  await db.execute(
    `
    INSERT INTO password_entries (
      id, workspace_id, folder_id, title, username, website_url,
      secret_data, secret_nonce
    )
    VALUES (
      $1, 'default', $2, $3, $4, $5, $6, $7
    )
    `,
    [
      id,
      meta.folder_id,
      meta.title,
      meta.username,
      meta.website_url,
      payload.ciphertext,
      payload.nonce,
    ],
  )

  const entry = await getEntry(id)

  if (!entry) {
    throw new Error("Failed to create entry")
  }

  return entry
}

/**
 * Updates an entry's non-secret metadata and, optionally, its secret.
 * Pass `secret: null` to leave the stored password/notes untouched —
 * most edits are just renaming or moving folders, and re-encrypting
 * needs the vault unlocked, so it's opt-in rather than automatic.
 */
export async function updateEntry(
  id: string,
  meta: EntryMetaEdits,
  secret: DecryptedSecret | null,
): Promise<PasswordEntry | null> {
  const db = await getDatabase()

  if (secret) {
    const payload = await invoke<EncryptedPayload>("vault_encrypt_secret", {
      plaintext: JSON.stringify(secret),
    })

    await db.execute(
      `
      UPDATE password_entries
      SET
        title = $1,
        username = $2,
        website_url = $3,
        folder_id = $4,
        secret_data = $5,
        secret_nonce = $6
      WHERE id = $7
      `,
      [
        meta.title,
        meta.username,
        meta.website_url,
        meta.folder_id,
        payload.ciphertext,
        payload.nonce,
        id,
      ],
    )
  } else {
    await db.execute(
      `
      UPDATE password_entries
      SET
        title = $1,
        username = $2,
        website_url = $3,
        folder_id = $4
      WHERE id = $5
      `,
      [meta.title, meta.username, meta.website_url, meta.folder_id, id],
    )
  }

  return getEntry(id)
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDatabase()

  await db.execute(
    `
    UPDATE password_entries
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [id],
  )
}

export async function toggleEntryFavorite(
  id: string,
  favorite: boolean,
): Promise<void> {
  const db = await getDatabase()

  await db.execute(
    `UPDATE password_entries SET is_favorite = $1 WHERE id = $2`,
    [favorite ? 1 : 0, id],
  )
}

/**
 * Decrypts an entry's secret (password + notes) for display. The
 * vault must be unlocked — throws "the vault is locked" otherwise.
 * Call this on demand (e.g. when the user reveals a password), not
 * eagerly for a whole list — there's no reason to decrypt entries the
 * user isn't currently looking at.
 */
export async function decryptEntrySecret(
  entry: PasswordEntry,
): Promise<DecryptedSecret> {
  const plaintext = await invoke<string>("vault_decrypt_secret", {
    ciphertext: entry.secret_data,
    nonce: entry.secret_nonce,
  })

  const parsed = JSON.parse(plaintext) as Partial<DecryptedSecret>

  return {
    password: parsed.password ?? "",
    notes: parsed.notes ?? "",
  }
}

// ---------- Password generator ----------
//
// Pure client-side, no Rust round-trip needed: generating a random
// password doesn't touch the vault or any stored secret, it only
// needs a cryptographically secure source of randomness, which the
// browser already provides.

export interface PasswordGeneratorOptions {
  length: number
  useLowercase: boolean
  useUppercase: boolean
  useNumbers: boolean
  useSymbols: boolean
  excludeAmbiguous: boolean
}

const LOWERCASE = "abcdefghijklmnopqrstuvwxyz"
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const NUMBERS = "0123456789"
const SYMBOLS = "!@#$%^&*()-_=+[]{}?"
// Characters that are easy to misread (l/1/I, O/0) — filtered out
// when excludeAmbiguous is set.
const AMBIGUOUS = "lI1O0"

export function generatePassword(options: PasswordGeneratorOptions): string {
  let pool = ""
  if (options.useLowercase) pool += LOWERCASE
  if (options.useUppercase) pool += UPPERCASE
  if (options.useNumbers) pool += NUMBERS
  if (options.useSymbols) pool += SYMBOLS

  if (options.excludeAmbiguous) {
    pool = pool
      .split("")
      .filter((char) => !AMBIGUOUS.includes(char))
      .join("")
  }

  if (!pool) {
    throw new Error("Choose at least one character type.")
  }

  const length = Math.max(4, Math.min(128, options.length))

  // crypto.getRandomValues is a CSPRNG (OS-backed) — never use
  // Math.random for anything security-sensitive.
  const randomValues = new Uint32Array(length)
  crypto.getRandomValues(randomValues)

  let result = ""
  for (let i = 0; i < length; i++) {
    result += pool[randomValues[i] % pool.length]
  }

  return result
}