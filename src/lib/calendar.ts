import Database from "@tauri-apps/plugin-sql"

export interface CalendarEvent {
  id: string
  workspace_id: string | null
  title: string
  description: string
  location: string | null
  starts_at: string
  ends_at: string | null
  all_day: number
  timezone: string | null
  recurrence: string | null
  color: string | null
  metadata: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface EventEdits {
  title: string
  description: string
  location: string | null
  starts_at: string
  ends_at: string | null
  all_day: boolean
  color: string | null
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

function assertValidRange(edits: EventEdits) {
  if (edits.ends_at && edits.ends_at < edits.starts_at) {
    throw new Error("End must be on or after the start.")
  }
}

export async function getEvents(): Promise<CalendarEvent[]> {
  const db = await getDatabase()

  return db.select<CalendarEvent[]>(
    `
    SELECT *
    FROM calendar_events
    WHERE deleted_at IS NULL
    ORDER BY starts_at ASC
    `
  )
}

export async function getEvent(id: string): Promise<CalendarEvent | null> {
  const db = await getDatabase()

  const events = await db.select<CalendarEvent[]>(
    `
    SELECT *
    FROM calendar_events
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [id]
  )

  return events[0] ?? null
}

export async function createEvent(edits: EventEdits): Promise<CalendarEvent> {
  assertValidRange(edits)

  const db = await getDatabase()
  const id = generateId()

  await db.execute(
    `
    INSERT INTO calendar_events (
      id,
      workspace_id,
      title,
      description,
      location,
      starts_at,
      ends_at,
      all_day,
      color
    )
    VALUES (
      $1, 'default', $2, $3, $4, $5, $6, $7, $8
    )
    `,
    [
      id,
      edits.title,
      edits.description,
      edits.location,
      edits.starts_at,
      edits.ends_at,
      edits.all_day ? 1 : 0,
      edits.color,
    ]
  )

  const event = await getEvent(id)

  if (!event) {
    throw new Error("Failed to create event")
  }

  return event
}

export async function updateEvent(id: string, edits: EventEdits) {
  assertValidRange(edits)

  const db = await getDatabase()

  // updated_at is set automatically by trg_calendar_events_updated.
  await db.execute(
    `
    UPDATE calendar_events
    SET
      title = $1,
      description = $2,
      location = $3,
      starts_at = $4,
      ends_at = $5,
      all_day = $6,
      color = $7
    WHERE id = $8
    `,
    [
      edits.title,
      edits.description,
      edits.location,
      edits.starts_at,
      edits.ends_at,
      edits.all_day ? 1 : 0,
      edits.color,
      id,
    ]
  )

  return getEvent(id)
}

export async function deleteEvent(id: string) {
  const db = await getDatabase()

  await db.execute(
    `
    UPDATE calendar_events
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [id]
  )
}