import { useEffect, useRef, useState } from "react"
import {
  createNote,
  deleteNote,
  getNotes,
  toggleNoteFavorite,
  toggleNotePin,
  type Note,
  updateNote,
} from "../lib/notes"

import "./Notes.css"

function parseSqliteTimestamp(value: string): Date {
  // SQLite CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" in UTC.
  return new Date(`${value.replace(" ", "T")}Z`)
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

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

function getSnippet(content: string): string {
  const trimmed = content.trim()

  if (!trimmed) {
    return "No additional text"
  }

  const firstLine =
    trimmed.split("\n").find((line) => line.trim().length > 0) ?? trimmed

  return firstLine.length > 90 ? `${firstLine.slice(0, 90)}…` : firstLine
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

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M9.5 3.5h5l.6 5.2 3.1 2.9c.4.4.1 1.1-.4 1.1H14v5.8l-2 2.5-2-2.5v-5.8H5.2c-.5 0-.8-.7-.4-1.1l3.1-2.9.6-5.2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 4.2 14.3 9l5.3.8-3.8 3.7.9 5.3-4.7-2.5-4.7 2.5.9-5.3-3.8-3.7L9.7 9 12 4.2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
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

export function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)

  const savedNote = selectedNote
    ? notes.find((note) => note.id === selectedNote.id) ?? null
    : null

  const isDirty =
    !!selectedNote &&
    !!savedNote &&
    (selectedNote.title !== savedNote.title ||
      selectedNote.content !== savedNote.content)

  async function loadNotes(preferredId?: string) {
    try {
      setError(null)
      const result = await getNotes()

      setNotes(result)

      if (preferredId) {
        const match = result.find((note) => note.id === preferredId)
        setSelectedNote(match ?? result[0] ?? null)
      } else if (!selectedNote && result.length > 0) {
        setSelectedNote(result[0])
      }
    } catch (err) {
      console.error("Failed to load notes:", err)
      setError("Couldn't load your notes. Try again.")
    } finally {
      setLoading(false)
    }
  }

  // Refresh list/order without discarding an in-progress, unsaved edit
  // to the currently open note (used after pin/favorite toggles).
  async function refreshPreservingEdit(id: string) {
    try {
      const result = await getNotes()
      setNotes(result)
      setSelectedNote((current) => {
        if (!current || current.id !== id) return current
        const fresh = result.find((note) => note.id === id)
        return fresh
          ? { ...fresh, title: current.title, content: current.content }
          : current
      })
    } catch (err) {
      console.error("Failed to refresh notes:", err)
    }
  }

  useEffect(() => {
    loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function confirmDiscardIfDirty() {
    if (!isDirty) return true
    return window.confirm("You have unsaved changes. Discard them?")
  }

  function handleSelect(note: Note) {
    if (note.id === selectedNote?.id) return
    if (!confirmDiscardIfDirty()) return
    setError(null)
    setSelectedNote(note)
  }

  async function handleCreate() {
    if (!confirmDiscardIfDirty()) return

    try {
      setError(null)
      const note = await createNote("Untitled note", "")

      setNotes((current) => [note, ...current])
      setSelectedNote(note)

      requestAnimationFrame(() => titleInputRef.current?.focus())
    } catch (err) {
      console.error("Failed to create note:", err)
      setError("Couldn't create a new note. Try again.")
    }
  }

  async function handleSave() {
    if (!selectedNote || saving || !isDirty) return

    try {
      setSaving(true)
      setError(null)

      const updated = await updateNote(
        selectedNote.id,
        selectedNote.title,
        selectedNote.content,
      )

      if (!updated) {
        setError("That note no longer exists.")
        await loadNotes()
        return
      }

      await loadNotes(updated.id)
    } catch (err) {
      console.error("Failed to save note:", err)
      setError("Couldn't save your changes. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedNote || deleting) return
    if (!window.confirm(`Delete "${selectedNote.title || "Untitled note"}"?`)) {
      return
    }

    try {
      setDeleting(true)
      setError(null)

      await deleteNote(selectedNote.id)

      const remaining = notes.filter((note) => note.id !== selectedNote.id)
      setNotes(remaining)
      setSelectedNote(remaining[0] ?? null)
    } catch (err) {
      console.error("Failed to delete note:", err)
      setError("Couldn't delete that note. Try again.")
    } finally {
      setDeleting(false)
    }
  }

  async function handlePinToggle() {
    if (!selectedNote) return

    try {
      setError(null)
      await toggleNotePin(selectedNote.id, !selectedNote.is_pinned)
      await refreshPreservingEdit(selectedNote.id)
    } catch (err) {
      console.error("Failed to update pin:", err)
      setError("Couldn't update pin. Try again.")
    }
  }

  async function handleFavoriteToggle() {
    if (!selectedNote) return

    try {
      setError(null)
      await toggleNoteFavorite(selectedNote.id, !selectedNote.is_favorite)
      await refreshPreservingEdit(selectedNote.id)
    } catch (err) {
      console.error("Failed to update favorite:", err)
      setError("Couldn't update favorite. Try again.")
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
  }, [selectedNote, isDirty, saving])

  if (loading) {
    return (
      <div className="notes-app notes-app--loading">
        <span>Loading notes…</span>
      </div>
    )
  }

  const pinnedNotes = notes.filter((note) => note.is_pinned)
  const otherNotes = notes.filter((note) => !note.is_pinned)

  function renderNoteItem(note: Note) {
    const isActive = note.id === selectedNote?.id

    return (
      <button
        key={note.id}
        type="button"
        className={`note-item${isActive ? " note-item--active" : ""}`}
        onClick={() => handleSelect(note)}
        aria-current={isActive}
      >
        <span className="note-item-title">
          {note.title || "Untitled note"}
          {isActive && isDirty && (
            <span className="note-item-dot" aria-label="Unsaved changes" />
          )}
        </span>
        <span className="note-item-snippet">{getSnippet(note.content)}</span>
        <span className="note-item-meta">
          {!!note.is_favorite && <StarIcon filled />}
          <span>{formatRelativeTime(note.updated_at)}</span>
        </span>
      </button>
    )
  }

  return (
    <div className="notes-app">
      <aside className="notes-sidebar">
        <div className="notes-sidebar-header">
          <span className="notes-count">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </span>
          <button type="button" className="new-note-button" onClick={handleCreate}>
            <PlusIcon />
            New note
          </button>
        </div>

        {error && (
          <div className="notes-error" role="alert">
            {error}
          </div>
        )}

        <div className="notes-list">
          {notes.length === 0 && (
            <div className="notes-list-empty">
              No notes yet. Create one to get started.
            </div>
          )}

          {pinnedNotes.length > 0 && (
            <>
              <span className="notes-list-label">Pinned</span>
              {pinnedNotes.map(renderNoteItem)}
              {otherNotes.length > 0 && (
                <span className="notes-list-label">All notes</span>
              )}
            </>
          )}

          {otherNotes.map(renderNoteItem)}
        </div>
      </aside>

      <main className="notes-main">
        {selectedNote ? (
          <div className="notes-editor">
            <div className="editor-header">
              <input
                ref={titleInputRef}
                className="editor-title-input"
                value={selectedNote.title}
                placeholder="Untitled note"
                onChange={(event) =>
                  setSelectedNote({
                    ...selectedNote,
                    title: event.target.value,
                  })
                }
              />

              <div className="editor-actions">
                <button
                  type="button"
                  className={`icon-button${
                    selectedNote.is_pinned ? " icon-button--active" : ""
                  }`}
                  onClick={handlePinToggle}
                  aria-pressed={!!selectedNote.is_pinned}
                  title={selectedNote.is_pinned ? "Unpin note" : "Pin note"}
                >
                  <PinIcon filled={!!selectedNote.is_pinned} />
                </button>

                <button
                  type="button"
                  className={`icon-button${
                    selectedNote.is_favorite ? " icon-button--active" : ""
                  }`}
                  onClick={handleFavoriteToggle}
                  aria-pressed={!!selectedNote.is_favorite}
                  title={
                    selectedNote.is_favorite
                      ? "Remove from favorites"
                      : "Add to favorites"
                  }
                >
                  <StarIcon filled={!!selectedNote.is_favorite} />
                </button>

                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  onClick={handleDelete}
                  disabled={deleting}
                  title="Delete note"
                  aria-label="Delete note"
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

            <div className="editor-meta">
              Edited {formatRelativeTime(selectedNote.updated_at)}
              {isDirty && <span className="editor-meta-dirty"> · Unsaved changes</span>}
            </div>

            <textarea
              className="editor-body"
              value={selectedNote.content}
              placeholder="Start writing…"
              onChange={(event) =>
                setSelectedNote({
                  ...selectedNote,
                  content: event.target.value,
                })
              }
            />
          </div>
        ) : (
          <div className="notes-empty-state">
            <p>
              {notes.length === 0
                ? "Write your first note to get started."
                : "Select a note to read or edit it."}
            </p>
            {notes.length === 0 && (
              <button type="button" className="save-button" onClick={handleCreate}>
                New note
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}