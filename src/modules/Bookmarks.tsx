import { useEffect, useMemo, useRef, useState } from "react"
import {
  createBookmark,
  createFolder,
  deleteBookmark,
  getBookmarks,
  getFolders,
  toggleBookmarkFavorite,
  updateBookmark,
  type Bookmark,
  type BookmarkFolder,
} from "../lib/bookmarks"

import "./Bookmarks.css"

function parseSqliteTimestamp(value: string): Date {
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

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
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

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
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

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        d="M10.5 13.5 15 9M9.5 16.5 7 19a3 3 0 0 1-4.2-4.2l3-3M14.5 7.5 17 5a3 3 0 0 1 4.2 4.2l-3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.5 12h17M12 3.5c2.4 2.3 3.6 5.3 3.6 8.5s-1.2 6.2-3.6 8.5c-2.4-2.3-3.6-5.3-3.6-8.5S9.6 5.8 12 3.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  )
}

export function Bookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [folders, setFolders] = useState<BookmarkFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedBookmark, setSelectedBookmark] = useState<Bookmark | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [faviconFailed, setFaviconFailed] = useState(false)

  const titleInputRef = useRef<HTMLInputElement>(null)

  const savedBookmark = selectedBookmark
    ? bookmarks.find((bookmark) => bookmark.id === selectedBookmark.id) ?? null
    : null

  const isDirty =
    !!selectedBookmark &&
    !!savedBookmark &&
    (selectedBookmark.title !== savedBookmark.title ||
      selectedBookmark.url !== savedBookmark.url ||
      selectedBookmark.description !== savedBookmark.description ||
      (selectedBookmark.folder_id ?? "") !== (savedBookmark.folder_id ?? ""))

  const visibleBookmarks = useMemo(() => {
    if (!selectedFolderId) return bookmarks
    return bookmarks.filter((bookmark) => bookmark.folder_id === selectedFolderId)
  }, [bookmarks, selectedFolderId])

  async function loadAll(preferredId?: string) {
    try {
      setError(null)
      const [bookmarksResult, foldersResult] = await Promise.all([
        getBookmarks(),
        getFolders(),
      ])
      setBookmarks(bookmarksResult)
      setFolders(foldersResult)

      if (preferredId) {
        const match = bookmarksResult.find((b) => b.id === preferredId)
        setSelectedBookmark(match ?? null)
      }
    } catch (err) {
      console.error("Failed to load bookmarks:", err)
      setError("Couldn't load your bookmarks. Try again.")
    } finally {
      setLoading(false)
    }
  }

  async function refreshPreservingEdit(id: string) {
    try {
      const result = await getBookmarks()
      setBookmarks(result)
      setSelectedBookmark((current) => {
        if (!current || current.id !== id) return current
        const fresh = result.find((b) => b.id === id)
        return fresh
          ? { ...fresh, title: current.title, url: current.url, description: current.description, folder_id: current.folder_id }
          : current
      })
    } catch (err) {
      console.error("Failed to refresh bookmarks:", err)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  function confirmDiscardIfDirty() {
    if (!isDirty) return true
    return window.confirm("You have unsaved changes. Discard them?")
  }

  function handleSelect(bookmark: Bookmark) {
    if (bookmark.id === selectedBookmark?.id) return
    if (!confirmDiscardIfDirty()) return
    setError(null)
    setFaviconFailed(false)
    setSelectedBookmark({ ...bookmark })
  }

  function handleCloseForm() {
    if (!confirmDiscardIfDirty()) return
    setSelectedBookmark(null)
  }

  async function handleCreate() {
    if (!confirmDiscardIfDirty()) return

    try {
      setError(null)
      const bookmark = await createBookmark("https://", "New bookmark", selectedFolderId)

      setBookmarks((current) =>
        [...current, bookmark].sort((a, b) => a.title.localeCompare(b.title)),
      )
      setFaviconFailed(false)
      setSelectedBookmark(bookmark)

      requestAnimationFrame(() => titleInputRef.current?.focus())
    } catch (err) {
      console.error("Failed to create bookmark:", err)
      setError("Couldn't create a new bookmark. Try again.")
    }
  }

  async function handleSave() {
    if (!selectedBookmark || saving || !isDirty) return

    try {
      setSaving(true)
      setError(null)

      const updated = await updateBookmark(selectedBookmark.id, {
        title: selectedBookmark.title,
        url: selectedBookmark.url,
        description: selectedBookmark.description,
        folder_id: selectedBookmark.folder_id,
      })

      if (!updated) {
        setError("That bookmark no longer exists.")
        await loadAll()
        setSelectedBookmark(null)
        return
      }

      setFaviconFailed(false)
      await loadAll(updated.id)
    } catch (err) {
      console.error("Failed to save bookmark:", err)
      setError("Couldn't save your changes. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedBookmark || deleting) return
    if (!window.confirm(`Delete "${selectedBookmark.title || "this bookmark"}"?`)) return

    try {
      setDeleting(true)
      setError(null)

      await deleteBookmark(selectedBookmark.id)

      setBookmarks((current) => current.filter((b) => b.id !== selectedBookmark.id))
      setSelectedBookmark(null)
    } catch (err) {
      console.error("Failed to delete bookmark:", err)
      setError("Couldn't delete that bookmark. Try again.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleFavoriteToggle(bookmark: Bookmark, event: React.MouseEvent) {
    event.stopPropagation()

    try {
      setError(null)
      await toggleBookmarkFavorite(bookmark.id, !bookmark.is_favorite)
      await refreshPreservingEdit(bookmark.id)
    } catch (err) {
      console.error("Failed to update favorite:", err)
      setError("Couldn't update favorite. Try again.")
    }
  }

  async function handleAddFolder() {
    const name = window.prompt("Folder name")
    if (!name || !name.trim()) return

    try {
      setError(null)
      const folder = await createFolder(name.trim())
      setFolders((current) =>
        [...current, folder].sort((a, b) => a.name.localeCompare(b.name)),
      )
    } catch (err) {
      console.error("Failed to create folder:", err)
      setError("Couldn't create that folder. Try again.")
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
  }, [selectedBookmark, isDirty, saving])

  if (loading) {
    return (
      <div className="bookmarks-app bookmarks-app--loading">
        <span>Loading bookmarks…</span>
      </div>
    )
  }

  function renderBookmarkRow(bookmark: Bookmark) {
    const isActive = bookmark.id === selectedBookmark?.id

    return (
      <div
        key={bookmark.id}
        className={`bookmark-item${isActive ? " bookmark-item--active" : ""}`}
      >
        <button
          type="button"
          className="bookmark-item-main"
          onClick={() => handleSelect(bookmark)}
        >
          {bookmark.favicon_url ? (
            <img
              className="bookmark-favicon"
              src={bookmark.favicon_url}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none"
              }}
            />
          ) : (
            <span className="bookmark-favicon bookmark-favicon--fallback">
              <GlobeIcon />
            </span>
          )}

          <span className="bookmark-item-body">
            <span className="bookmark-item-title">
              {bookmark.title || "Untitled bookmark"}
            </span>
            <span className="bookmark-item-url">{getHostname(bookmark.url)}</span>
          </span>
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={(event) => handleFavoriteToggle(bookmark, event)}
          aria-label={bookmark.is_favorite ? "Remove from favorites" : "Add to favorites"}
          title={bookmark.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <StarIcon filled={!!bookmark.is_favorite} />
        </button>
      </div>
    )
  }

  return (
    <div className="bookmarks-app">
      <aside className="bookmarks-sidebar">
        <div className="bookmarks-sidebar-header">
          <span className="bookmarks-count">
            {bookmarks.length} {bookmarks.length === 1 ? "bookmark" : "bookmarks"}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={handleCreate}
            aria-label="New bookmark"
            title="New bookmark"
          >
            <PlusIcon />
          </button>
        </div>

        <div className="folder-filter-row">
          <select
            value={selectedFolderId ?? ""}
            onChange={(event) => setSelectedFolderId(event.target.value || null)}
          >
            <option value="">All bookmarks</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-button"
            onClick={handleAddFolder}
            aria-label="New folder"
            title="New folder"
          >
            <PlusIcon />
          </button>
        </div>

        {error && (
          <div className="bookmarks-error" role="alert">
            {error}
          </div>
        )}

        <div className="bookmarks-list">
          {visibleBookmarks.length === 0 ? (
            <div className="bookmarks-list-empty">No bookmarks yet.</div>
          ) : (
            visibleBookmarks.map(renderBookmarkRow)
          )}
        </div>
      </aside>

      <main className="bookmarks-main">
        {selectedBookmark ? (
          <div className="bookmark-form">
            <div className="bookmark-form-header">
              {selectedBookmark.favicon_url && !faviconFailed ? (
                <img
                  className="bookmark-form-favicon"
                  src={selectedBookmark.favicon_url}
                  alt=""
                  onError={() => setFaviconFailed(true)}
                />
              ) : (
                <span className="bookmark-form-favicon bookmark-favicon--fallback">
                  <GlobeIcon />
                </span>
              )}

              <input
                ref={titleInputRef}
                className="bookmark-title-input"
                value={selectedBookmark.title}
                placeholder="Untitled bookmark"
                onChange={(event) =>
                  setSelectedBookmark({ ...selectedBookmark, title: event.target.value })
                }
              />

              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={handleDelete}
                disabled={deleting}
                title="Delete bookmark"
                aria-label="Delete bookmark"
              >
                <TrashIcon />
              </button>
            </div>

            <label className="field">
              <span className="field-label">URL</span>
              <div className="url-row">
                <input
                  type="text"
                  value={selectedBookmark.url}
                  onChange={(event) => {
                    setFaviconFailed(false)
                    setSelectedBookmark({ ...selectedBookmark, url: event.target.value })
                  }}
                />
                <a
                  className="visit-button"
                  href={selectedBookmark.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open in browser"
                >
                  <LinkIcon />
                  Visit
                </a>
              </div>
            </label>

            <label className="field">
              <span className="field-label">Folder</span>
              <select
                value={selectedBookmark.folder_id ?? ""}
                onChange={(event) =>
                  setSelectedBookmark({
                    ...selectedBookmark,
                    folder_id: event.target.value || null,
                  })
                }
              >
                <option value="">No folder</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field-grow">
              <span className="field-label">Description</span>
              <textarea
                className="bookmark-description"
                value={selectedBookmark.description}
                placeholder="Add a description…"
                onChange={(event) =>
                  setSelectedBookmark({
                    ...selectedBookmark,
                    description: event.target.value,
                  })
                }
              />
            </label>

            <div className="bookmark-form-meta">
              Edited {formatRelativeTime(selectedBookmark.updated_at)}
            </div>

            <div className="bookmark-form-actions">
              <button
                type="button"
                className="save-button"
                onClick={handleSave}
                disabled={saving || !isDirty}
              >
                {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
              </button>
              <button type="button" className="cancel-button" onClick={handleCloseForm}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="bookmarks-empty-state">
            <p>
              {bookmarks.length === 0
                ? "Save your first bookmark to get started."
                : "Select a bookmark to view or edit it."}
            </p>
            {bookmarks.length === 0 && (
              <button type="button" className="save-button" onClick={handleCreate}>
                New bookmark
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}