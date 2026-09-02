import Database from "@tauri-apps/plugin-sql"

export interface Note {
  id: string
  workspace_id: string | null
  title: string
  content: string
  content_format: "plain" | "markdown" | "html" | "json"
  status: "active" | "archived" | "deleted"
  is_pinned: number
  is_favorite: number
  metadata: string
  created_at: string
  updated_at: string
  deleted_at: string | null
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

export async function getNotes(): Promise<Note[]> {
  const db = await getDatabase()

  return db.select<Note[]>(
    `
    SELECT *
    FROM notes
    WHERE status = 'active'
    ORDER BY is_pinned DESC, updated_at DESC
    `
  )
}

export async function getNote(id: string): Promise<Note | null> {
  const db = await getDatabase()

  const notes = await db.select<Note[]>(
    `
    SELECT *
    FROM notes
    WHERE id = $1
      AND status != 'deleted'
    LIMIT 1
    `,
    [id]
  )

  return notes[0] ?? null
}

export async function createNote(
  title = "",
  content = "",
): Promise<Note> {
  const db = await getDatabase()

  const id = generateId()

  await db.execute(
    `
    INSERT INTO notes (
      id,
      workspace_id,
      title,
      content,
      content_format,
      status
    )
    VALUES (
      $1,
      'default',
      $2,
      $3,
      'markdown',
      'active'
    )
    `,
    [id, title, content]
  )

  const note = await getNote(id)

  if (!note) {
    throw new Error("Failed to create note")
  }

  return note
}

export async function updateNote(
  id: string,
  title: string,
  content: string,
) {
  const db = await getDatabase()

  // Note: updated_at is set automatically by trg_notes_updated,
  // no need to set it here.
  await db.execute(
    `
    UPDATE notes
    SET
      title = $1,
      content = $2
    WHERE id = $3
    `,
    [title, content, id]
  )

  return getNote(id)
}

export async function deleteNote(id: string) {
  const db = await getDatabase()

  await db.execute(
    `
    UPDATE notes
    SET
      status = 'deleted',
      deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [id]
  )
}

export async function toggleNotePin(
  id: string,
  pinned: boolean,
) {
  const db = await getDatabase()

  await db.execute(
    `
    UPDATE notes
    SET is_pinned = $1
    WHERE id = $2
    `,
    [pinned ? 1 : 0, id]
  )
}

export async function toggleNoteFavorite(
  id: string,
  favorite: boolean,
) {
  const db = await getDatabase()

  await db.execute(
    `
    UPDATE notes
    SET is_favorite = $1
    WHERE id = $2
    `,
    [favorite ? 1 : 0, id]
  )
}