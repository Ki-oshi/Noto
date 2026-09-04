import { useEffect, useRef, useState } from "react"
import {
  createTask,
  deleteTask,
  getTasks,
  setTaskStatus,
  toggleTaskComplete,
  updateTask,
  type Task,
  type TaskStatus,
} from "../lib/tasks"

import "./Tasks.css"

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "No priority",
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
}

const LIST_SECTIONS: {
  key: string
  label: string
  match: (task: Task) => boolean
}[] = [
  {
    key: "in_progress",
    label: "In progress",
    match: (task) => task.status === "in_progress",
  },
  {
    key: "todo",
    label: "To do",
    match: (task) => task.status === "todo",
  },
  {
    key: "completed",
    label: "Completed",
    match: (task) => task.status === "completed",
  },
  {
    key: "other",
    label: "Archived",
    match: (task) => task.status === "cancelled" || task.status === "archived",
  },
]

function parseSqliteTimestamp(value: string): Date {
  // SQLite CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC.
  return new Date(`${value.replace(" ", "T")}Z`)
}

function parseDueDate(value: string): Date {
  // due_at may be a plain date (YYYY-MM-DD) or a full SQLite timestamp.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`)
  }
  return parseSqliteTimestamp(value)
}

function formatRelativeTime(value: string): string {
  const date = parseSqliteTimestamp(value)
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000)

  if (diffSec < 5) return "Just now"
  if (diffSec < 60) return `${diffSec}s ago`

  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`

  const diffDay = Math.round(diffHour / 24)
  if (diffDay === 1) return "Yesterday"
  if (diffDay < 7) return `${diffDay}d ago`

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function formatDueDate(value: string): string {
  return parseDueDate(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function isOverdue(task: Task): boolean {
  if (!task.due_at) return false
  if (
    task.status === "completed" ||
    task.status === "cancelled" ||
    task.status === "archived"
  ) {
    return false
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  return parseDueDate(task.due_at).getTime() < startOfToday.getTime()
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path
        d="M5 12.5 9.5 17 19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M5 7h14M9.5 7V5.2c0-.4.3-.7.7-.7h3.6c.4 0 .7.3.7.7V7M7.5 7l.6 12.1c0 .5.4.9.9.9h6c.5 0 .9-.4.9-.9L16.5 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)

  const savedTask = selectedTask
    ? tasks.find((task) => task.id === selectedTask.id) ?? null
    : null

  const isDirty =
    !!selectedTask &&
    !!savedTask &&
    (selectedTask.title !== savedTask.title ||
      selectedTask.description !== savedTask.description ||
      selectedTask.priority !== savedTask.priority ||
      (selectedTask.due_at ?? "") !== (savedTask.due_at ?? ""))

  async function loadTasks(preferredId?: string) {
    try {
      setError(null)
      const result = await getTasks()

      setTasks(result)

      if (preferredId) {
        const match = result.find((task) => task.id === preferredId)
        setSelectedTask(match ?? null)
      } else if (selectedTask) {
        const match = result.find((task) => task.id === selectedTask.id)
        setSelectedTask(match ?? null)
      }
    } catch (err) {
      console.error("Failed to load tasks:", err)
      setError("Couldn't load your tasks. Try again.")
    } finally {
      setLoading(false)
    }
  }

  // Refresh list/order without discarding an in-progress, unsaved edit
  // to the currently open task (used after status toggles).
  async function refreshPreservingEdit(id: string) {
    try {
      const result = await getTasks()
      setTasks(result)
      setSelectedTask((current) => {
        if (!current || current.id !== id) return current
        const fresh = result.find((task) => task.id === id)
        return fresh
          ? {
              ...fresh,
              title: current.title,
              description: current.description,
              priority: current.priority,
              due_at: current.due_at,
            }
          : current
      })
    } catch (err) {
      console.error("Failed to refresh tasks:", err)
    }
  }

  useEffect(() => {
    loadTasks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function confirmDiscardIfDirty() {
    if (!isDirty) return true
    return window.confirm("You have unsaved changes. Discard them?")
  }

  function handleSelect(task: Task) {
    if (task.id === selectedTask?.id) return
    if (!confirmDiscardIfDirty()) return
    setError(null)
    setSelectedTask(task)
  }

  async function handleCreate() {
    if (!confirmDiscardIfDirty()) return

    try {
      setError(null)
      const task = await createTask("New task", "")

      setTasks((current) => [task, ...current])
      setSelectedTask(task)

      requestAnimationFrame(() => titleInputRef.current?.focus())
    } catch (err) {
      console.error("Failed to create task:", err)
      setError("Couldn't create a new task. Try again.")
    }
  }

  async function handleSave() {
    if (!selectedTask || saving || !isDirty) return

    try {
      setSaving(true)
      setError(null)

      const updated = await updateTask(selectedTask.id, {
        title: selectedTask.title,
        description: selectedTask.description,
        priority: selectedTask.priority,
        due_at: selectedTask.due_at,
      })

      if (!updated) {
        setError("That task no longer exists.")
        await loadTasks()
        return
      }

      await loadTasks(updated.id)
    } catch (err) {
      console.error("Failed to save task:", err)
      setError("Couldn't save your changes. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedTask || deleting) return
    if (!window.confirm(`Delete "${selectedTask.title || "Untitled task"}"?`)) {
      return
    }

    try {
      setDeleting(true)
      setError(null)

      await deleteTask(selectedTask.id)

      const remaining = tasks.filter((task) => task.id !== selectedTask.id)
      setTasks(remaining)
      setSelectedTask(null)
    } catch (err) {
      console.error("Failed to delete task:", err)
      setError("Couldn't delete that task. Try again.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleStatusChange(status: TaskStatus) {
    if (!selectedTask) return

    try {
      setError(null)
      await setTaskStatus(selectedTask.id, status)
      await refreshPreservingEdit(selectedTask.id)
    } catch (err) {
      console.error("Failed to update status:", err)
      setError("Couldn't update status. Try again.")
    }
  }

  async function handleQuickToggle(task: Task, event: React.MouseEvent) {
    event.stopPropagation()

    try {
      setError(null)
      await toggleTaskComplete(task.id, task.status !== "completed")
      await refreshPreservingEdit(selectedTask?.id ?? "")
    } catch (err) {
      console.error("Failed to update task:", err)
      setError("Couldn't update that task. Try again.")
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s"

      if (isSaveShortcut) {
        event.preventDefault()
        handleSave()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTask, isDirty, saving])

  if (loading) {
    return (
      <div className="tasks-app tasks-app--loading">
        <span>Loading tasks…</span>
      </div>
    )
  }

  function renderTaskItem(task: Task) {
    const isActive = task.id === selectedTask?.id
    const completed = task.status === "completed"
    const overdue = isOverdue(task)

    return (
      <div
        key={task.id}
        className={`task-item${isActive ? " task-item--active" : ""}`}
      >
        <button
          type="button"
          className={`task-checkbox${completed ? " task-checkbox--checked" : ""}`}
          onClick={(event) => handleQuickToggle(task, event)}
          aria-pressed={completed}
          aria-label={completed ? "Mark as not done" : "Mark as done"}
        >
          {completed && <CheckIcon />}
        </button>

        <button
          type="button"
          className="task-item-main"
          onClick={() => handleSelect(task)}
          aria-current={isActive}
        >
          <span
            className={`task-item-title${
              completed ? " task-item-title--done" : ""
            }`}
          >
            {task.title || "Untitled task"}
            {isActive && isDirty && (
              <span className="task-item-dot" aria-label="Unsaved changes" />
            )}
          </span>

          {(task.priority > 0 || task.due_at) && (
            <span className="task-item-meta">
              {task.priority > 0 && (
                <span
                  className={`priority-dot priority-dot--${task.priority}`}
                  title={PRIORITY_LABELS[task.priority]}
                />
              )}
              {task.due_at && (
                <span
                  className={`due-badge${overdue ? " due-badge--overdue" : ""}`}
                >
                  {formatDueDate(task.due_at)}
                </span>
              )}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="tasks-app">
      <aside className="tasks-sidebar">
        <div className="tasks-sidebar-header">
          <span className="tasks-count">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
          <button type="button" className="new-task-button" onClick={handleCreate}>
            <PlusIcon />
            New task
          </button>
        </div>

        {error && (
          <div className="tasks-error" role="alert">
            {error}
          </div>
        )}

        <div className="tasks-list">
          {tasks.length === 0 && (
            <div className="tasks-list-empty">
              No tasks yet. Create one to get started.
            </div>
          )}

          {LIST_SECTIONS.map((section) => {
            const sectionTasks = tasks.filter(section.match)
            if (sectionTasks.length === 0) return null

            return (
              <div key={section.key}>
                <span className="tasks-list-label">{section.label}</span>
                {sectionTasks.map(renderTaskItem)}
              </div>
            )
          })}
        </div>
      </aside>

      <main className="tasks-main">
        {selectedTask ? (
          <div className="tasks-editor">
            <div className="editor-header">
              <button
                type="button"
                className={`task-checkbox task-checkbox--large${
                  selectedTask.status === "completed"
                    ? " task-checkbox--checked"
                    : ""
                }`}
                onClick={() =>
                  handleStatusChange(
                    selectedTask.status === "completed" ? "todo" : "completed",
                  )
                }
                aria-pressed={selectedTask.status === "completed"}
                aria-label={
                  selectedTask.status === "completed"
                    ? "Mark as not done"
                    : "Mark as done"
                }
              >
                {selectedTask.status === "completed" && <CheckIcon />}
              </button>

              <input
                ref={titleInputRef}
                className={`editor-title-input${
                  selectedTask.status === "completed"
                    ? " editor-title-input--done"
                    : ""
                }`}
                value={selectedTask.title}
                placeholder="Untitled task"
                onChange={(event) =>
                  setSelectedTask({
                    ...selectedTask,
                    title: event.target.value,
                  })
                }
              />

              <div className="editor-actions">
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete task"
                  aria-label="Delete task"
                >
                  <TrashIcon />
                </button>

                <button
                  type="button"
                  className="save-button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                >
                  {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
                </button>
              </div>
            </div>

            <div className="editor-fields">
              <label className="field">
                <span className="field-label">Status</span>
                <select
                  value={selectedTask.status}
                  onChange={(event) =>
                    handleStatusChange(event.target.value as TaskStatus)
                  }
                >
                  {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Priority</span>
                <select
                  value={selectedTask.priority}
                  onChange={(event) =>
                    setSelectedTask({
                      ...selectedTask,
                      priority: Number(event.target.value),
                    })
                  }
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">Due date</span>
                <input
                  type="date"
                  value={selectedTask.due_at ? selectedTask.due_at.slice(0, 10) : ""}
                  onChange={(event) =>
                    setSelectedTask({
                      ...selectedTask,
                      due_at: event.target.value || null,
                    })
                  }
                />
              </label>
            </div>

            <div className="editor-meta">
              Edited {formatRelativeTime(selectedTask.updated_at)}
              {isDirty && <span className="editor-meta-dirty"> · Unsaved changes</span>}
            </div>

            <textarea
              className="editor-body"
              value={selectedTask.description}
              placeholder="Add a description…"
              onChange={(event) =>
                setSelectedTask({
                  ...selectedTask,
                  description: event.target.value,
                })
              }
            />
          </div>
        ) : (
          <div className="tasks-empty-state">
            <p>
              {tasks.length === 0
                ? "Add your first task to get started."
                : "Select a task to view or edit it."}
            </p>
            {tasks.length === 0 && (
              <button type="button" className="save-button" onClick={handleCreate}>
                New task
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}