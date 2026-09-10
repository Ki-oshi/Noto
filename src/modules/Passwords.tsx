import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import {
  createEntry,
  createFolder,
  decryptEntrySecret,
  deleteEntry,
  generatePassword,
  getEntries,
  getFolders,
  isVaultConfigured,
  isVaultUnlocked,
  lockVault,
  setupVault,
  toggleEntryFavorite,
  unlockVault,
  updateEntry,
  type EntryMetaEdits,
  type PasswordEntry,
  type PasswordFolder,
  type PasswordGeneratorOptions,
} from "../lib/passwords"

import "./Passwords.css"

const DEFAULT_GENERATOR_OPTIONS: PasswordGeneratorOptions = {
  length: 16,
  useLowercase: true,
  useUppercase: true,
  useNumbers: true,
  useSymbols: true,
  excludeAmbiguous: false,
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

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M3 3l18 18M9.9 5.1A10.8 10.8 0 0 1 12 5c6 0 9.5 6.5 9.5 6.5a17.6 17.6 0 0 1-3.2 4M6.5 6.9C4 8.6 2.5 11.5 2.5 11.5S6 18 12 18a10 10 0 0 0 3-.5M9.5 9.7a3 3 0 0 0 4.2 4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function DiceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" />
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

export function Passwords() {
  const [loading, setLoading] = useState(true)
  const [vaultConfigured, setVaultConfigured] = useState(false)
  const [vaultUnlocked, setVaultUnlocked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [setupPassword, setSetupPassword] = useState("")
  const [setupConfirmPassword, setSetupConfirmPassword] = useState("")
  const [setupError, setSetupError] = useState<string | null>(null)
  const [settingUp, setSettingUp] = useState(false)

  const [unlockPassword, setUnlockPassword] = useState("")
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlocking, setUnlocking] = useState(false)

  const [entries, setEntries] = useState<PasswordEntry[]>([])
  const [folders, setFolders] = useState<PasswordFolder[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  const [selectedEntry, setSelectedEntry] = useState<PasswordEntry | null>(null)
  const [password, setPassword] = useState("")
  const [notes, setNotes] = useState("")
  const [secretLoaded, setSecretLoaded] = useState(false)
  const [secretDirty, setSecretDirty] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [decrypting, setDecrypting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [entryGeneratorOpen, setEntryGeneratorOpen] = useState(false)
  const [generatorOptions, setGeneratorOptions] = useState<PasswordGeneratorOptions>(
    DEFAULT_GENERATOR_OPTIONS,
  )
  const [generatedPassword, setGeneratedPassword] = useState("")
  const [generatorError, setGeneratorError] = useState<string | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)

  const savedEntry = selectedEntry
    ? entries.find((entry) => entry.id === selectedEntry.id) ?? null
    : null

  const metadataDirty =
    !!selectedEntry &&
    !!savedEntry &&
    (selectedEntry.title !== savedEntry.title ||
      (selectedEntry.username ?? "") !== (savedEntry.username ?? "") ||
      (selectedEntry.website_url ?? "") !== (savedEntry.website_url ?? "") ||
      (selectedEntry.folder_id ?? "") !== (savedEntry.folder_id ?? ""))

  const isDirty = metadataDirty || secretDirty

  const visibleEntries = useMemo(() => {
    if (!selectedFolderId) return entries
    return entries.filter((entry) => entry.folder_id === selectedFolderId)
  }, [entries, selectedFolderId])

  async function loadEntriesAndFolders() {
    const [entriesResult, foldersResult] = await Promise.all([getEntries(), getFolders()])
    setEntries(entriesResult)
    setFolders(foldersResult)
  }

  async function loadVaultState() {
    try {
      setError(null)
      const configured = await isVaultConfigured()
      setVaultConfigured(configured)

      if (configured) {
        // The Rust-side vault state is a singleton that persists across
        // route changes within the same app session — it can already be
        // unlocked even though this component just (re)mounted.
        const unlocked = await isVaultUnlocked()
        setVaultUnlocked(unlocked)
        if (unlocked) {
          await loadEntriesAndFolders()
        }
      }
    } catch (err) {
      console.error("Failed to load vault state:", err)
      setError("Couldn't check the vault's status.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVaultState()
  }, [])

  function confirmDiscardIfDirty() {
    if (!isDirty) return true
    return window.confirm("You have unsaved changes. Discard them?")
  }

  function resetEntryFormState() {
    setPassword("")
    setNotes("")
    setSecretLoaded(false)
    setSecretDirty(false)
    setRevealed(false)
    setEntryGeneratorOpen(false)
  }

  // ---------- Vault lifecycle ----------

  async function handleSetupVault() {
    if (setupPassword.length < 8) {
      setSetupError("Master password must be at least 8 characters.")
      return
    }
    if (setupPassword !== setupConfirmPassword) {
      setSetupError("Passwords don't match.")
      return
    }

    try {
      setSettingUp(true)
      setSetupError(null)
      await setupVault(setupPassword)
      setSetupPassword("")
      setSetupConfirmPassword("")
      setVaultConfigured(true)
      setVaultUnlocked(true)
      await loadEntriesAndFolders()
    } catch (err) {
      console.error("Failed to set up vault:", err)
      setSetupError(err instanceof Error ? err.message : "Couldn't set up the vault.")
    } finally {
      setSettingUp(false)
    }
  }

  async function handleUnlockVault() {
    if (!unlockPassword) return

    try {
      setUnlocking(true)
      setUnlockError(null)
      await unlockVault(unlockPassword)
      setUnlockPassword("")
      setVaultUnlocked(true)
      await loadEntriesAndFolders()
    } catch (err) {
      console.error("Failed to unlock vault:", err)
      setUnlockError("Incorrect master password.")
    } finally {
      setUnlocking(false)
    }
  }

  async function handleLockVault() {
    try {
      await lockVault()
    } catch (err) {
      console.error("Failed to lock vault:", err)
    } finally {
      // Clear every trace of decrypted material from React state, not
      // just the Rust-side session key.
      setVaultUnlocked(false)
      setSelectedEntry(null)
      resetEntryFormState()
      setEntries([])
      setFolders([])
      setSelectedFolderId(null)
    }
  }

  // ---------- Folders ----------

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

  // ---------- Entries ----------

  function handleSelectEntry(entry: PasswordEntry) {
    if (selectedEntry?.id === entry.id) return
    if (!confirmDiscardIfDirty()) return

    setError(null)
    setSelectedEntry({ ...entry })
    resetEntryFormState()
  }

  function handleCloseEntryForm() {
    if (!confirmDiscardIfDirty()) return
    setSelectedEntry(null)
    resetEntryFormState()
  }

  async function handleCreateEntry() {
    if (!confirmDiscardIfDirty()) return

    try {
      setError(null)
      const entry = await createEntry(
        {
          title: "New entry",
          username: null,
          website_url: null,
          folder_id: selectedFolderId,
        },
        { password: "", notes: "" },
      )

      setEntries((current) =>
        [...current, entry].sort((a, b) => a.title.localeCompare(b.title)),
      )
      setSelectedEntry(entry)
      setPassword("")
      setNotes("")
      setSecretLoaded(true)
      setRevealed(true)
      setSecretDirty(false)
      setEntryGeneratorOpen(false)

      requestAnimationFrame(() => titleInputRef.current?.focus())
    } catch (err) {
      console.error("Failed to create entry:", err)
      setError(
        err instanceof Error ? err.message : "Couldn't create a new entry. Try again.",
      )
    }
  }

  async function handleSaveEntry() {
    if (!selectedEntry || saving || !isDirty) return

    const meta: EntryMetaEdits = {
      title: selectedEntry.title,
      username: selectedEntry.username,
      website_url: selectedEntry.website_url,
      folder_id: selectedEntry.folder_id,
    }

    try {
      setSaving(true)
      setError(null)

      const updated = await updateEntry(
        selectedEntry.id,
        meta,
        secretDirty ? { password, notes } : null,
      )

      if (!updated) {
        setError("That entry no longer exists.")
        await loadEntriesAndFolders()
        setSelectedEntry(null)
        resetEntryFormState()
        return
      }

      setEntries((current) =>
        current
          .map((entry) => (entry.id === updated.id ? updated : entry))
          .sort((a, b) => a.title.localeCompare(b.title)),
      )
      setSelectedEntry(updated)
      setSecretDirty(false)
    } catch (err) {
      console.error("Failed to save entry:", err)
      setError(err instanceof Error ? err.message : "Couldn't save this entry. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEntry() {
    if (!selectedEntry || deleting) return
    if (!window.confirm(`Delete "${selectedEntry.title || "this entry"}"?`)) return

    try {
      setDeleting(true)
      setError(null)
      await deleteEntry(selectedEntry.id)
      setEntries((current) => current.filter((entry) => entry.id !== selectedEntry.id))
      setSelectedEntry(null)
      resetEntryFormState()
    } catch (err) {
      console.error("Failed to delete entry:", err)
      setError("Couldn't delete that entry. Try again.")
    } finally {
      setDeleting(false)
    }
  }

  async function handleFavoriteToggle(entry: PasswordEntry, event: MouseEvent) {
    event.stopPropagation()

    try {
      setError(null)
      await toggleEntryFavorite(entry.id, !entry.is_favorite)
      const result = await getEntries()
      setEntries(result)

      if (selectedEntry?.id === entry.id) {
        const fresh = result.find((e) => e.id === entry.id)
        if (fresh) {
          setSelectedEntry((current) =>
            current
              ? { ...current, is_favorite: fresh.is_favorite, updated_at: fresh.updated_at }
              : current,
          )
        }
      }
    } catch (err) {
      console.error("Failed to update favorite:", err)
      setError("Couldn't update favorite. Try again.")
    }
  }

  async function handleRevealSecret() {
    if (!selectedEntry) return

    if (secretLoaded) {
      setRevealed((current) => !current)
      return
    }

    try {
      setError(null)
      setDecrypting(true)
      const secret = await decryptEntrySecret(selectedEntry)
      setPassword(secret.password)
      setNotes(secret.notes)
      setSecretLoaded(true)
      setRevealed(true)
    } catch (err) {
      console.error("Failed to decrypt entry:", err)
      setError(err instanceof Error ? err.message : "Couldn't decrypt this entry.")
    } finally {
      setDecrypting(false)
    }
  }

  async function handleCopyPassword() {
    if (!selectedEntry) return

    try {
      setError(null)
      let value = password

      if (!secretLoaded) {
        setDecrypting(true)
        const secret = await decryptEntrySecret(selectedEntry)
        setPassword(secret.password)
        setNotes(secret.notes)
        setSecretLoaded(true)
        value = secret.password
      }

      await navigator.clipboard.writeText(value)
    } catch (err) {
      console.error("Failed to copy password:", err)
      setError("Couldn't copy the password.")
    } finally {
      setDecrypting(false)
    }
  }

  // ---------- Generator ----------

  function regenerate() {
    try {
      setGeneratedPassword(generatePassword(generatorOptions))
      setGeneratorError(null)
    } catch (err) {
      setGeneratedPassword("")
      setGeneratorError(
        err instanceof Error ? err.message : "Couldn't generate a password.",
      )
    }
  }

  useEffect(() => {
    if (entryGeneratorOpen) regenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryGeneratorOpen, generatorOptions])

  function handleUseGeneratedPassword() {
    if (!generatedPassword) return
    setPassword(generatedPassword)
    setSecretLoaded(true)
    setRevealed(true)
    setSecretDirty(true)
    setEntryGeneratorOpen(false)
  }

  async function handleCopyGenerated() {
    if (!generatedPassword) return
    try {
      await navigator.clipboard.writeText(generatedPassword)
    } catch (err) {
      console.error("Failed to copy generated password:", err)
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s"
      if (!isSaveShortcut || !vaultUnlocked || !selectedEntry) return
      event.preventDefault()
      handleSaveEntry()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultUnlocked, selectedEntry, isDirty, saving])

  function renderGeneratorPanel() {
    return (
      <div className="generator-panel">
        <div className="generator-preview">
          <code>{generatedPassword || "—"}</code>
          <button
            type="button"
            className="icon-button"
            onClick={regenerate}
            title="Regenerate"
            aria-label="Regenerate"
          >
            <DiceIcon />
          </button>
        </div>

        {generatorError && <div className="generator-error">{generatorError}</div>}

        <label className="field">
          <span className="field-label">Length: {generatorOptions.length}</span>
          <input
            type="range"
            min={8}
            max={64}
            value={generatorOptions.length}
            onChange={(event) =>
              setGeneratorOptions({ ...generatorOptions, length: Number(event.target.value) })
            }
          />
        </label>

        <div className="generator-toggles">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={generatorOptions.useLowercase}
              onChange={(event) =>
                setGeneratorOptions({ ...generatorOptions, useLowercase: event.target.checked })
              }
            />
            <span>Lowercase (a-z)</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={generatorOptions.useUppercase}
              onChange={(event) =>
                setGeneratorOptions({ ...generatorOptions, useUppercase: event.target.checked })
              }
            />
            <span>Uppercase (A-Z)</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={generatorOptions.useNumbers}
              onChange={(event) =>
                setGeneratorOptions({ ...generatorOptions, useNumbers: event.target.checked })
              }
            />
            <span>Numbers (0-9)</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={generatorOptions.useSymbols}
              onChange={(event) =>
                setGeneratorOptions({ ...generatorOptions, useSymbols: event.target.checked })
              }
            />
            <span>Symbols (!@#$…)</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={generatorOptions.excludeAmbiguous}
              onChange={(event) =>
                setGeneratorOptions({
                  ...generatorOptions,
                  excludeAmbiguous: event.target.checked,
                })
              }
            />
            <span>Exclude ambiguous (l, 1, I, O, 0)</span>
          </label>
        </div>

        <div className="generator-actions">
          <button
            type="button"
            className="save-button"
            onClick={handleUseGeneratedPassword}
            disabled={!generatedPassword}
          >
            Use this password
          </button>
          <button
            type="button"
            className="cancel-button"
            onClick={handleCopyGenerated}
            disabled={!generatedPassword}
          >
            Copy
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="passwords-app passwords-app--loading">
        <span>Loading…</span>
      </div>
    )
  }

  if (!vaultConfigured) {
    return (
      <div className="passwords-app passwords-gate">
        <div className="gate-card">
          <div className="gate-icon">
            <LockIcon />
          </div>
          <h2>Set up your password vault</h2>
          <p className="gate-copy">
            Choose a master password. It encrypts every saved password and never leaves this
            device — if you forget it, saved entries can't be recovered.
          </p>

          <label className="field">
            <span className="field-label">Master password</span>
            <input
              type="password"
              value={setupPassword}
              autoFocus
              onChange={(event) => setSetupPassword(event.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Confirm master password</span>
            <input
              type="password"
              value={setupConfirmPassword}
              onChange={(event) => setSetupConfirmPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSetupVault()
              }}
            />
          </label>

          {setupError && <div className="gate-error">{setupError}</div>}

          <button
            type="button"
            className="save-button gate-button"
            onClick={handleSetupVault}
            disabled={settingUp}
          >
            {settingUp ? "Setting up…" : "Create vault"}
          </button>
        </div>
      </div>
    )
  }

  if (!vaultUnlocked) {
    return (
      <div className="passwords-app passwords-gate">
        <div className="gate-card">
          <div className="gate-icon">
            <LockIcon />
          </div>
          <h2>Vault locked</h2>
          <p className="gate-copy">Enter your master password to unlock.</p>

          <label className="field">
            <span className="field-label">Master password</span>
            <input
              type="password"
              value={unlockPassword}
              autoFocus
              onChange={(event) => setUnlockPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleUnlockVault()
              }}
            />
          </label>

          {unlockError && <div className="gate-error">{unlockError}</div>}

          <button
            type="button"
            className="save-button gate-button"
            onClick={handleUnlockVault}
            disabled={unlocking}
          >
            {unlocking ? "Unlocking…" : "Unlock"}
          </button>
        </div>
      </div>
    )
  }

  function renderEntryRow(entry: PasswordEntry) {
    const isActive = selectedEntry?.id === entry.id
    const subtitle = entry.username || entry.website_url || ""

    return (
      <div key={entry.id} className={`entry-item${isActive ? " entry-item--active" : ""}`}>
        <button type="button" className="entry-item-main" onClick={() => handleSelectEntry(entry)}>
          <span className="entry-item-title">{entry.title || "Untitled entry"}</span>
          {subtitle && <span className="entry-item-subtitle">{subtitle}</span>}
        </button>

        <button
          type="button"
          className="icon-button"
          onClick={(event) => handleFavoriteToggle(entry, event)}
          aria-label={entry.is_favorite ? "Remove from favorites" : "Add to favorites"}
          title={entry.is_favorite ? "Remove from favorites" : "Add to favorites"}
        >
          <StarIcon filled={!!entry.is_favorite} />
        </button>
      </div>
    )
  }

  return (
    <div className="passwords-app">
      <aside className="passwords-sidebar">
        <div className="passwords-sidebar-header">
          <span className="passwords-count">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
          <button
            type="button"
            className="icon-button"
            onClick={handleCreateEntry}
            aria-label="New entry"
            title="New entry"
          >
            <PlusIcon />
          </button>
        </div>

        <div className="folder-filter-row">
          <select
            value={selectedFolderId ?? ""}
            onChange={(event) => setSelectedFolderId(event.target.value || null)}
          >
            <option value="">All items</option>
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
          <div className="passwords-error" role="alert">
            {error}
          </div>
        )}

        <div className="entries-list">
          {visibleEntries.length === 0 ? (
            <div className="entries-list-empty">No entries yet.</div>
          ) : (
            visibleEntries.map(renderEntryRow)
          )}
        </div>
      </aside>

      <main className="passwords-main">
        <div className="passwords-toolbar">
          <h2>{selectedEntry ? selectedEntry.title || "Untitled entry" : "Select an entry"}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={handleLockVault}
            title="Lock vault"
            aria-label="Lock vault"
          >
            <LockIcon />
          </button>
        </div>

        {selectedEntry ? (
          <div className="entry-form">
            <div className="entry-form-header">
              <input
                ref={titleInputRef}
                className="entry-title-input"
                value={selectedEntry.title}
                placeholder="Untitled entry"
                onChange={(event) =>
                  setSelectedEntry({ ...selectedEntry, title: event.target.value })
                }
              />
              <button
                type="button"
                className="icon-button icon-button--danger"
                onClick={handleDeleteEntry}
                disabled={deleting}
                title="Delete entry"
                aria-label="Delete entry"
              >
                <TrashIcon />
              </button>
            </div>

            <label className="field">
              <span className="field-label">Username / email</span>
              <input
                type="text"
                value={selectedEntry.username ?? ""}
                onChange={(event) =>
                  setSelectedEntry({
                    ...selectedEntry,
                    username: event.target.value || null,
                  })
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Website</span>
              <input
                type="text"
                value={selectedEntry.website_url ?? ""}
                placeholder="https://"
                onChange={(event) =>
                  setSelectedEntry({
                    ...selectedEntry,
                    website_url: event.target.value || null,
                  })
                }
              />
            </label>

            <label className="field">
              <span className="field-label">Folder</span>
              <select
                value={selectedEntry.folder_id ?? ""}
                onChange={(event) =>
                  setSelectedEntry({
                    ...selectedEntry,
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

            <div className="field">
              <span className="field-label">Password</span>
              <div className="password-row">
                <input
                  type={revealed ? "text" : "password"}
                  value={password}
                  readOnly={!secretLoaded}
                  placeholder={secretLoaded ? "" : "••••••••••••"}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setSecretDirty(true)
                  }}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleRevealSecret}
                  disabled={decrypting}
                  title={revealed ? "Hide password" : "Show password"}
                  aria-label={revealed ? "Hide password" : "Show password"}
                >
                  {revealed ? <EyeOffIcon /> : <EyeIcon />}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={handleCopyPassword}
                  disabled={decrypting}
                  title="Copy password"
                  aria-label="Copy password"
                >
                  <CopyIcon />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setEntryGeneratorOpen((current) => !current)}
                  title="Generate password"
                  aria-label="Generate password"
                >
                  <DiceIcon />
                </button>
              </div>
            </div>

            {entryGeneratorOpen && renderGeneratorPanel()}

            <label className="field field-grow">
              <span className="field-label">Notes</span>
              <textarea
                className="entry-notes"
                value={notes}
                readOnly={!secretLoaded}
                placeholder={secretLoaded ? "Add notes…" : "Reveal the password to edit notes"}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setSecretDirty(true)
                }}
              />
            </label>

            <div className="entry-form-actions">
              <button
                type="button"
                className="save-button"
                onClick={handleSaveEntry}
                disabled={saving || !isDirty}
              >
                {saving ? "Saving…" : isDirty ? "Save" : "Saved"}
              </button>
              <button type="button" className="cancel-button" onClick={handleCloseEntryForm}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="passwords-empty-state">
            <p>Select an entry to view it, or create a new one.</p>
          </div>
        )}
      </main>
    </div>
  )
}