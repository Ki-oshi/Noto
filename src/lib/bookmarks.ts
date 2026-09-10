import Database from "@tauri-apps/plugin-sql"

export interface BookmarkFolder {
  id: string
  workspace_id: string | null
  name: string
  parent_id: string | null
  color: string | null
  icon: string | null
  metadata: string
  created_at: string
  updated_at: string
}

export interface Bookmark {
  id: string
  workspace_id: string | null
  title: string
  url: string
  description: string
  favicon_url: string | null
  folder_id: string | null
  is_favorite: number
  metadata: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface BookmarkEdits {
  title: string
  url: string
  description: string
  folder_id: string | null
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

// Derives a favicon URL from the bookmark's own URL — no API key, no
// network call from this file (the request happens naturally when an
// <img src=...> using this URL renders). Falls back to null for
// malformed URLs rather than throwing, since a bad favicon is
// cosmetic, not a reason to block saving the bookmark.
function deriveFaviconUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url)
    return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`
  } catch {
    return null
  }
}

// ---------- Folders ----------

export async function getFolders(): Promise<BookmarkFolder[]> {
  const db = await getDatabase()

  return db.select<BookmarkFolder[]>(
    `SELECT * FROM bookmark_folders ORDER BY name ASC`,
  )
}

export async function createFolder(
  name: string,
  parent_id: string | null = null,
): Promise<BookmarkFolder> {
  const db = await getDatabase()
  const id = generateId()

  await db.execute(
    `
    INSERT INTO bookmark_folders (id, workspace_id, name, parent_id)
    VALUES ($1, 'default', $2, $3)
    `,
    [id, name, parent_id],
  )

  const rows = await db.select<BookmarkFolder[]>(
    `SELECT * FROM bookmark_folders WHERE id = $1 LIMIT 1`,
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

  // No deleted_at column on bookmark_folders, so this is a hard
  // delete. bookmarks.folder_id is ON DELETE SET NULL, but that only
  // fires if `PRAGMA foreign_keys = ON` is set on the connection —
  // otherwise bookmarks keep a dangling folder_id, which the UI
  // treats the same as "no folder".
  await db.execute(`DELETE FROM bookmark_folders WHERE id = $1`, [id])
}

// ---------- Bookmarks ----------

export async function getBookmarks(): Promise<Bookmark[]> {
  const db = await getDatabase()

  return db.select<Bookmark[]>(
    `
    SELECT *
    FROM bookmarks
    WHERE deleted_at IS NULL
    ORDER BY is_favorite DESC, title ASC
    `,
  )
}

export async function getBookmark(id: string): Promise<Bookmark | null> {
  const db = await getDatabase()

  const rows = await db.select<Bookmark[]>(
    `
    SELECT *
    FROM bookmarks
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [id],
  )

  return rows[0] ?? null
}

export async function createBookmark(
  url: string,
  title = "",
  folder_id: string | null = null,
): Promise<Bookmark> {
  const db = await getDatabase()
  const id = generateId()
  const favicon_url = deriveFaviconUrl(url)

  await db.execute(
    `
    INSERT INTO bookmarks (
      id, workspace_id, title, url, description, favicon_url, folder_id
    )
    VALUES (
      $1, 'default', $2, $3, '', $4, $5
    )
    `,
    [id, title, url, favicon_url, folder_id],
  )

  const bookmark = await getBookmark(id)

  if (!bookmark) {
    throw new Error("Failed to create bookmark")
  }

  return bookmark
}

export async function updateBookmark(id: string, edits: BookmarkEdits) {
  const db = await getDatabase()
  const favicon_url = deriveFaviconUrl(edits.url)

  // updated_at is set automatically by trg_bookmarks_updated.
  await db.execute(
    `
    UPDATE bookmarks
    SET
      title = $1,
      url = $2,
      description = $3,
      folder_id = $4,
      favicon_url = $5
    WHERE id = $6
    `,
    [edits.title, edits.url, edits.description, edits.folder_id, favicon_url, id],
  )

  return getBookmark(id)
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDatabase()

  await db.execute(
    `
    UPDATE bookmarks
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [id],
  )
}

export async function toggleBookmarkFavorite(
  id: string,
  favorite: boolean,
): Promise<void> {
  const db = await getDatabase()

  await db.execute(
    `UPDATE bookmarks SET is_favorite = $1 WHERE id = $2`,
    [favorite ? 1 : 0, id],
  )
}