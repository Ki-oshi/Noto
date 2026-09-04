import Database from "@tauri-apps/plugin-sql"

export type TaskStatus =
  | "todo"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "archived"

export interface Task {
  id: string
  workspace_id: string | null
  title: string
  description: string
  status: TaskStatus
  priority: number
  due_at: string | null
  completed_at: string | null
  parent_task_id: string | null
  recurrence: string | null
  metadata: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TaskEdits {
  title: string
  description: string
  priority: number
  due_at: string | null
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

export async function getTasks(): Promise<Task[]> {
  const db = await getDatabase()

  return db.select<Task[]>(
    `
    SELECT *
    FROM tasks
    WHERE deleted_at IS NULL
    ORDER BY
      CASE status
        WHEN 'in_progress' THEN 0
        WHEN 'todo' THEN 1
        WHEN 'completed' THEN 2
        ELSE 3
      END,
      priority DESC,
      due_at IS NULL,
      due_at ASC,
      created_at DESC
    `
  )
}

export async function getTask(id: string): Promise<Task | null> {
  const db = await getDatabase()

  const tasks = await db.select<Task[]>(
    `
    SELECT *
    FROM tasks
    WHERE id = $1
      AND deleted_at IS NULL
    LIMIT 1
    `,
    [id]
  )

  return tasks[0] ?? null
}

export async function createTask(
  title = "",
  description = "",
): Promise<Task> {
  const db = await getDatabase()

  const id = generateId()

  await db.execute(
    `
    INSERT INTO tasks (
      id,
      workspace_id,
      title,
      description,
      status,
      priority
    )
    VALUES (
      $1,
      'default',
      $2,
      $3,
      'todo',
      0
    )
    `,
    [id, title, description]
  )

  const task = await getTask(id)

  if (!task) {
    throw new Error("Failed to create task")
  }

  return task
}

export async function updateTask(id: string, edits: TaskEdits) {
  const db = await getDatabase()

  // updated_at is set automatically by trg_tasks_updated.
  await db.execute(
    `
    UPDATE tasks
    SET
      title = $1,
      description = $2,
      priority = $3,
      due_at = $4
    WHERE id = $5
    `,
    [edits.title, edits.description, edits.priority, edits.due_at, id]
  )

  return getTask(id)
}

export async function setTaskStatus(id: string, status: TaskStatus) {
  const db = await getDatabase()

  if (status === "completed") {
    await db.execute(
      `
      UPDATE tasks
      SET status = $1, completed_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [status, id]
    )
  } else {
    await db.execute(
      `
      UPDATE tasks
      SET status = $1, completed_at = NULL
      WHERE id = $2
      `,
      [status, id]
    )
  }

  return getTask(id)
}

export async function toggleTaskComplete(id: string, completed: boolean) {
  return setTaskStatus(id, completed ? "completed" : "todo")
}

export async function deleteTask(id: string) {
  const db = await getDatabase()

  await db.execute(
    `
    UPDATE tasks
    SET deleted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [id]
  )
}