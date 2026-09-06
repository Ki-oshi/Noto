import { useEffect, useMemo, useRef, useState } from "react"
import {
  createEvent,
  deleteEvent,
  getEvents,
  updateEvent,
  type CalendarEvent,
  type EventEdits,
} from "../lib/calendar"

import "./Calendar.css"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Matches the app's own theme preset accent hues (sage, ocean, rose,
// amber, lavender, cyan) so event colors stay in the brand palette.
const EVENT_COLORS = [
  "#A8C3A0",
  "#67A7C9",
  "#E797A8",
  "#DDA33B",
  "#9D7CF3",
  "#60C0C5",
]

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseFlexibleDate(value: string): Date {
  // Date-only strings ("YYYY-MM-DD") parse as UTC midnight in JS, which
  // can shift the displayed day in negative-UTC-offset timezones, so
  // disambiguate by always parsing as local time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`)
  }
  return new Date(value)
}

function formatEventTime(event: CalendarEvent): string {
  if (event.all_day) return "All day"

  const start = parseFlexibleDate(event.starts_at)
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  if (!event.ends_at) return startLabel

  const end = parseFlexibleDate(event.ends_at)
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${startLabel} – ${endLabel}`
}

function formatDateKeyLabel(dateKey: string): string {
  return parseFlexibleDate(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function normalizeDateInput(value: string, allDay: boolean): string {
  if (allDay) return value // "YYYY-MM-DD"
  return value.length === 16 ? `${value}:00` : value // ensure seconds
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

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M14.5 6 8.5 12l6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M9.5 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Calendar() {
  const today = new Date()
  const todayKey = toDateKey(today)

  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  )
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)

  const savedEvent = selectedEvent
    ? events.find((event) => event.id === selectedEvent.id) ?? null
    : null

  const isDirty =
    !!selectedEvent &&
    !!savedEvent &&
    (selectedEvent.title !== savedEvent.title ||
      selectedEvent.description !== savedEvent.description ||
      (selectedEvent.location ?? "") !== (savedEvent.location ?? "") ||
      selectedEvent.starts_at !== savedEvent.starts_at ||
      (selectedEvent.ends_at ?? "") !== (savedEvent.ends_at ?? "") ||
      selectedEvent.all_day !== savedEvent.all_day ||
      (selectedEvent.color ?? "") !== (savedEvent.color ?? ""))

  async function loadEvents() {
    try {
      setError(null)
      const result = await getEvents()
      setEvents(result)
    } catch (err) {
      console.error("Failed to load events:", err)
      setError("Couldn't load your calendar. Try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvents()
  }, [])

  const monthDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstOfMonth = new Date(year, month, 1)

    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())

    const cells: { date: Date; dateKey: string; inCurrentMonth: boolean }[] = []

    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart)
      date.setDate(gridStart.getDate() + i)
      cells.push({
        date,
        dateKey: toDateKey(date),
        inCurrentMonth: date.getMonth() === month,
      })
    }

    return cells
  }, [viewDate])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}

    for (const event of events) {
      const key = event.starts_at.slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(event)
    }

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    }

    return map
  }, [events])

  const dayEvents = eventsByDate[selectedDateKey] ?? []

  function confirmDiscardIfDirty() {
    if (!isDirty) return true
    return window.confirm("You have unsaved changes. Discard them?")
  }

  function handlePrevMonth() {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
  }

  function handleNextMonth() {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
  }

  function handleToday() {
    if (!confirmDiscardIfDirty()) return
    const now = new Date()
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDateKey(toDateKey(now))
    setSelectedEvent(null)
  }

  function handleSelectDay(dateKey: string) {
    if (!confirmDiscardIfDirty()) return

    setError(null)
    setSelectedDateKey(dateKey)
    setSelectedEvent(null)

    const [year, month] = dateKey.split("-").map(Number)
    if (year !== viewDate.getFullYear() || month - 1 !== viewDate.getMonth()) {
      setViewDate(new Date(year, month - 1, 1))
    }
  }

  function handleSelectEvent(event: CalendarEvent) {
    if (selectedEvent?.id === event.id) return
    if (!confirmDiscardIfDirty()) return

    setError(null)
    setSelectedDateKey(event.starts_at.slice(0, 10))
    setSelectedEvent(event)
  }

  function handleCloseForm() {
    if (!confirmDiscardIfDirty()) return
    setSelectedEvent(null)
  }

  async function handleCreate() {
    if (!confirmDiscardIfDirty()) return

    try {
      setError(null)
      const event = await createEvent({
        title: "New event",
        description: "",
        location: null,
        starts_at: `${selectedDateKey}T09:00:00`,
        ends_at: `${selectedDateKey}T10:00:00`,
        all_day: false,
        color: EVENT_COLORS[0],
      })

      setEvents((current) => [...current, event])
      setSelectedEvent(event)

      requestAnimationFrame(() => titleInputRef.current?.focus())
    } catch (err) {
      console.error("Failed to create event:", err)
      setError(
        err instanceof Error ? err.message : "Couldn't create a new event. Try again.",
      )
    }
  }

  async function handleSave() {
    if (!selectedEvent || saving || !isDirty) return

    const edits: EventEdits = {
      title: selectedEvent.title,
      description: selectedEvent.description,
      location: selectedEvent.location,
      starts_at: selectedEvent.starts_at,
      ends_at: selectedEvent.ends_at,
      all_day: !!selectedEvent.all_day,
      color: selectedEvent.color,
    }

    try {
      setSaving(true)
      setError(null)

      const updated = await updateEvent(selectedEvent.id, edits)

      if (!updated) {
        setError("That event no longer exists.")
        await loadEvents()
        setSelectedEvent(null)
        return
      }

      setEvents((current) =>
        current.map((event) => (event.id === updated.id ? updated : event)),
      )
      setSelectedEvent(updated)
      setSelectedDateKey(updated.starts_at.slice(0, 10))
    } catch (err) {
      console.error("Failed to save event:", err)
      setError(
        err instanceof Error ? err.message : "Couldn't save your changes. Try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selectedEvent || deleting) return
    if (!window.confirm(`Delete "${selectedEvent.title || "Untitled event"}"?`)) {
      return
    }

    try {
      setDeleting(true)
      setError(null)

      await deleteEvent(selectedEvent.id)

      setEvents((current) => current.filter((event) => event.id !== selectedEvent.id))
      setSelectedEvent(null)
    } catch (err) {
      console.error("Failed to delete event:", err)
      setError("Couldn't delete that event. Try again.")
    } finally {
      setDeleting(false)
    }
  }

  function handleAllDayToggle(checked: boolean) {
    if (!selectedEvent) return

    const startDateKey = selectedEvent.starts_at.slice(0, 10)
    const endDateKey = selectedEvent.ends_at ? selectedEvent.ends_at.slice(0, 10) : null

    setSelectedEvent({
      ...selectedEvent,
      all_day: checked ? 1 : 0,
      starts_at: checked ? startDateKey : `${startDateKey}T09:00:00`,
      ends_at: endDateKey ? (checked ? endDateKey : `${endDateKey}T10:00:00`) : null,
    })
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
  }, [selectedEvent, isDirty, saving])

  if (loading) {
    return (
      <div className="calendar-app calendar-app--loading">
        <span>Loading calendar…</span>
      </div>
    )
  }

  return (
    <div className="calendar-app">
      <aside className="calendar-sidebar">
        <div className="calendar-sidebar-header">
          <span className="calendar-selected-day">
            {formatDateKeyLabel(selectedDateKey)}
          </span>
          <button type="button" className="new-event-button" onClick={handleCreate}>
            <PlusIcon />
            New event
          </button>
        </div>

        {error && (
          <div className="calendar-error" role="alert">
            {error}
          </div>
        )}

        {selectedEvent ? (
          <div className="event-form">
            <div className="event-form-header">
              <input
                ref={titleInputRef}
                className="event-title-input"
                value={selectedEvent.title}
                placeholder="Untitled event"
                onChange={(event) =>
                  setSelectedEvent({ ...selectedEvent, title: event.target.value })
                }
              />
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={handleDelete}
                disabled={deleting}
                title="Delete event"
                aria-label="Delete event"
              >
                <TrashIcon />
              </button>
            </div>

            <label className="field field-inline">
              <input
                type="checkbox"
                checked={!!selectedEvent.all_day}
                onChange={(event) => handleAllDayToggle(event.target.checked)}
              />
              <span>All day</span>
            </label>

            <label className="field">
              <span className="field-label">Starts</span>
              <input
                type={selectedEvent.all_day ? "date" : "datetime-local"}
                value={
                  selectedEvent.all_day
                    ? selectedEvent.starts_at.slice(0, 10)
                    : selectedEvent.starts_at.slice(0, 16)
                }
                onChange={(event) =>
                  setSelectedEvent({
                    ...selectedEvent,
                    starts_at: normalizeDateInput(
                      event.target.value,
                      !!selectedEvent.all_day,
                    ),
                  })
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Ends</span>
              <input
                type={selectedEvent.all_day ? "date" : "datetime-local"}
                value={
                  selectedEvent.ends_at
                    ? selectedEvent.all_day
                      ? selectedEvent.ends_at.slice(0, 10)
                      : selectedEvent.ends_at.slice(0, 16)
                    : ""
                }
                onChange={(event) =>
                  setSelectedEvent({
                    ...selectedEvent,
                    ends_at: event.target.value
                      ? normalizeDateInput(event.target.value, !!selectedEvent.all_day)
                      : null,
                  })
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Location</span>
              <input
                type="text"
                value={selectedEvent.location ?? ""}
                placeholder="Add location"
                onChange={(event) =>
                  setSelectedEvent({
                    ...selectedEvent,
                    location: event.target.value || null,
                  })
                }
              />
            </label>

            <div className="field">
              <span className="field-label">Color</span>
              <div className="color-swatches">
                {EVENT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch${
                      selectedEvent.color === color ? " color-swatch--selected" : ""
                    }`}
                    style={{ background: color }}
                    onClick={() => setSelectedEvent({ ...selectedEvent, color })}
                    aria-label={`Set color ${color}`}
                    aria-pressed={selectedEvent.color === color}
                  />
                ))}
              </div>
            </div>

            <label className="field field-grow">
              <span className="field-label">Description</span>
              <textarea
                className="event-description"
                value={selectedEvent.description}
                placeholder="Add a description…"
                onChange={(event) =>
                  setSelectedEvent({
                    ...selectedEvent,
                    description: event.target.value,
                  })
                }
              />
            </label>

            <div className="event-form-actions">
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
          <div className="calendar-agenda">
            {dayEvents.length === 0 ? (
              <div className="calendar-agenda-empty">No events on this day.</div>
            ) : (
              dayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="agenda-item"
                  onClick={() => handleSelectEvent(event)}
                >
                  <span
                    className="agenda-color-dot"
                    style={{ background: event.color ?? "var(--color-primary)" }}
                  />
                  <span className="agenda-item-body">
                    <span className="agenda-item-title">
                      {event.title || "Untitled event"}
                    </span>
                    <span className="agenda-item-time">{formatEventTime(event)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </aside>

      <main className="calendar-main">
        <div className="calendar-toolbar">
          <div className="calendar-nav">
            <button
              type="button"
              className="icon-button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
            >
              <ChevronLeftIcon />
            </button>
            <h2 className="calendar-month-title">
              {viewDate.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <button
              type="button"
              className="icon-button"
              onClick={handleNextMonth}
              aria-label="Next month"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <button type="button" className="today-button" onClick={handleToday}>
            Today
          </button>
        </div>

        <div className="calendar-weekdays">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {monthDays.map((cell) => {
            const cellEvents = eventsByDate[cell.dateKey] ?? []
            const isSelected = cell.dateKey === selectedDateKey
            const isToday = cell.dateKey === todayKey

            return (
              <div
                key={cell.dateKey}
                role="button"
                tabIndex={0}
                className={`calendar-cell${
                  cell.inCurrentMonth ? "" : " calendar-cell--outside"
                }${isSelected ? " calendar-cell--selected" : ""}${
                  isToday ? " calendar-cell--today" : ""
                }`}
                onClick={() => handleSelectDay(cell.dateKey)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    handleSelectDay(cell.dateKey)
                  }
                }}
              >
                <span className="calendar-cell-day">{cell.date.getDate()}</span>

                <div className="calendar-cell-events">
                  {cellEvents.slice(0, 3).map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="calendar-event-chip"
                      style={{
                        background: `color-mix(in srgb, ${
                          event.color ?? "var(--color-primary)"
                        } 16%, var(--color-surface))`,
                      }}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        handleSelectEvent(event)
                      }}
                    >
                      <span
                        className="calendar-event-dot"
                        style={{ background: event.color ?? "var(--color-primary)" }}
                      />
                      <span className="calendar-event-chip-title">
                        {event.title || "Untitled event"}
                      </span>
                    </button>
                  ))}

                  {cellEvents.length > 3 && (
                    <span className="calendar-event-more">
                      +{cellEvents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}