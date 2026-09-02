-- ============================================================
-- NOTO — INITIAL DATABASE SCHEMA
-- Database: SQLite
-- Architecture: Local-first / modular / extensible
-- ============================================================

-- ============================================================
-- 1. APP / SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    value_type TEXT NOT NULL DEFAULT 'string' CHECK (
        value_type IN (
            'string',
            'number',
            'boolean',
            'json',
            'color'
        )
    ),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    icon TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS workspace_settings (
    workspace_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    value_type TEXT NOT NULL DEFAULT 'string' CHECK (
        value_type IN (
            'string',
            'number',
            'boolean',
            'json',
            'color'
        )
    ),
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (workspace_id, key),
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE
);

-- ============================================================
-- 2. TAGGING SYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS entity_tags (
    tag_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (
        tag_id,
        entity_type,
        entity_id
    ),
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

-- ============================================================
-- 3. NOTES
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    content_format TEXT NOT NULL DEFAULT 'markdown' CHECK (
        content_format IN (
            'plain',
            'markdown',
            'html',
            'json'
        )
    ),
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN (
            'active',
            'archived',
            'deleted'
        )
    ),
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_workspace ON notes (workspace_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes (updated_at);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes (status);

-- ============================================================
-- 4. NOTE LINKS
-- ============================================================

CREATE TABLE IF NOT EXISTS note_links (
    id TEXT PRIMARY KEY,
    source_note_id TEXT NOT NULL,
    target_note_id TEXT NOT NULL,
    link_type TEXT NOT NULL DEFAULT 'related',
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_note_id) REFERENCES notes (id) ON DELETE CASCADE,
    FOREIGN KEY (target_note_id) REFERENCES notes (id) ON DELETE CASCADE,
    CHECK (source_note_id != target_note_id),
    UNIQUE (source_note_id, target_note_id, link_type)
);

-- ============================================================
-- 5. TASKS
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo' CHECK (
        status IN (
            'todo',
            'in_progress',
            'completed',
            'cancelled',
            'archived'
        )
    ),
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 4),
    due_at TEXT,
    completed_at TEXT,
    parent_task_id TEXT,
    recurrence TEXT CHECK (recurrence IS NULL OR json_valid(recurrence)),
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL,
    FOREIGN KEY (parent_task_id) REFERENCES tasks (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks (due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks (parent_task_id);

-- ============================================================
-- 6. CALENDAR EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    location TEXT,
    starts_at TEXT NOT NULL,
    ends_at TEXT,
    all_day INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
    timezone TEXT,
    recurrence TEXT CHECK (recurrence IS NULL OR json_valid(recurrence)),
    color TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL,
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_starts ON calendar_events (starts_at);
CREATE INDEX IF NOT EXISTS idx_calendar_workspace ON calendar_events (workspace_id);

-- ============================================================
-- 7. FINANCES — ACCOUNTS
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_accounts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'other' CHECK (
        account_type IN (
            'cash',
            'bank',
            'credit_card',
            'savings',
            'investment',
            'loan',
            'other'
        )
    ),
    currency TEXT NOT NULL DEFAULT 'PHP',
    initial_balance REAL NOT NULL DEFAULT 0,
    current_balance REAL NOT NULL DEFAULT 0,
    color TEXT,
    icon TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_workspace ON financial_accounts (workspace_id);

-- ============================================================
-- 8. FINANCES — CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_categories (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    name TEXT NOT NULL,
    category_type TEXT NOT NULL DEFAULT 'expense' CHECK (
        category_type IN ('income', 'expense', 'transfer')
    ),
    parent_id TEXT,
    color TEXT,
    icon TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES financial_categories (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_categories_parent ON financial_categories (parent_id);

-- ============================================================
-- 9. FINANCES — TRANSACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_transactions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    account_id TEXT NOT NULL,
    category_id TEXT,
    amount REAL NOT NULL,
    transaction_type TEXT NOT NULL DEFAULT 'expense' CHECK (
        transaction_type IN ('income', 'expense', 'transfer')
    ),
    description TEXT NOT NULL DEFAULT '',
    transaction_date TEXT NOT NULL,
    transfer_account_id TEXT,
    notes TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL,
    FOREIGN KEY (account_id) REFERENCES financial_accounts (id) ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES financial_categories (id) ON DELETE SET NULL,
    FOREIGN KEY (transfer_account_id) REFERENCES financial_accounts (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_transactions_account ON financial_transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_category ON financial_transactions (category_id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON financial_transactions (transaction_date);

-- ============================================================
-- 10. PROJECTS
-- ============================================================

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN (
            'planning',
            'active',
            'on_hold',
            'completed',
            'archived'
        )
    ),
    color TEXT,
    icon TEXT,
    start_date TEXT,
    due_date TEXT,
    completed_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects (workspace_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);

-- ============================================================
-- 11. PROJECT ↔ TASK
-- ============================================================

CREATE TABLE IF NOT EXISTS project_tasks (
    project_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, task_id),
    FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_position ON project_tasks (project_id, position);

-- ============================================================
-- 12. BOOKMARKS
-- ============================================================

CREATE TABLE IF NOT EXISTS bookmark_folders (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    name TEXT NOT NULL,
    parent_id TEXT,
    color TEXT,
    icon TEXT,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES bookmark_folders (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    title TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    favicon_url TEXT,
    folder_id TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL,
    FOREIGN KEY (folder_id) REFERENCES bookmark_folders (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_workspace ON bookmarks (workspace_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder ON bookmarks (folder_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_folders_parent ON bookmark_folders (parent_id);

-- ============================================================
-- 13. PASSWORD VAULT (encrypted)
-- ============================================================
-- Design:
--   1. User sets a master password once. App derives a key via a slow,
--      memory-hard KDF (Argon2id recommended) using vault_config.kdf_salt
--      and the stored cost parameters.
--   2. That derivation produces TWO independent sub-keys via HKDF:
--        - a verification key, used ONLY to decrypt vault_config.verifier
--          (a known constant) to confirm the master password is correct
--        - an encryption key, used to encrypt/decrypt password_entries.secret_data
--      Keeping these separate means a verifier check never exposes
--      material usable to decrypt real secrets.
--   3. Neither the master password, the derived key(s), nor plaintext
--      passwords are ever written to this database.
--   4. Use audited crates only (e.g. `argon2`, `chacha20poly1305` /
--      `aes-gcm` from RustCrypto) — no custom cipher implementations.
-- ============================================================

CREATE TABLE IF NOT EXISTS vault_config (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- singleton row: one vault per local install
    kdf_algorithm TEXT NOT NULL DEFAULT 'argon2id',
    kdf_salt BLOB NOT NULL,
    kdf_memory_kib INTEGER NOT NULL,
    kdf_iterations INTEGER NOT NULL,
    kdf_parallelism INTEGER NOT NULL,
    verifier BLOB NOT NULL,        -- AEAD ciphertext of a known constant
    verifier_nonce BLOB NOT NULL,
    encryption_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_folders (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    name TEXT NOT NULL,
    parent_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES password_folders (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS password_entries (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    folder_id TEXT,
    title TEXT NOT NULL,
    username TEXT,
    website_url TEXT,
    secret_data BLOB NOT NULL,     -- AEAD ciphertext of JSON {"password":"...","notes":"..."}
    secret_nonce BLOB NOT NULL,    -- unique nonce/IV for this ciphertext — never reuse
    encryption_version INTEGER NOT NULL DEFAULT 1 CHECK (encryption_version > 0),
    is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)), -- non-secret flags only
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE SET NULL,
    FOREIGN KEY (folder_id) REFERENCES password_folders (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_password_entries_workspace ON password_entries (workspace_id);
CREATE INDEX IF NOT EXISTS idx_password_entries_folder ON password_entries (folder_id);
CREATE INDEX IF NOT EXISTS idx_password_folders_parent ON password_folders (parent_id);

-- ============================================================
-- 14. ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    storage_path TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (entity_type, entity_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments (entity_type, entity_id);

-- ============================================================
-- 15. REMINDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    title TEXT NOT NULL,
    remind_at TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
    completed_at TEXT,
    recurrence TEXT CHECK (recurrence IS NULL OR json_valid(recurrence)),
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders (remind_at);
CREATE INDEX IF NOT EXISTS idx_reminders_entity ON reminders (entity_type, entity_id);

-- ============================================================
-- 16. USER-DEFINED / CUSTOM FIELDS
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_fields (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    name TEXT NOT NULL,
    field_type TEXT NOT NULL DEFAULT 'text' CHECK (
        field_type IN (
            'text',
            'number',
            'boolean',
            'date',
            'datetime',
            'color',
            'url',
            'select',
            'multiselect',
            'json'
        )
    ),
    options TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(options)),
    default_value TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (entity_type, name)
);

CREATE TABLE IF NOT EXISTS custom_field_values (
    field_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    value TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (field_id, entity_type, entity_id),
    FOREIGN KEY (field_id) REFERENCES custom_fields (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity ON custom_field_values (entity_type, entity_id);

-- ============================================================
-- 17. UNIVERSAL ENTITY RELATIONSHIPS
-- ============================================================

CREATE TABLE IF NOT EXISTS entity_relations (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT NOT NULL DEFAULT 'related',
    metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_type, source_id, target_type, target_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_entity_relations_source ON entity_relations (source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_relations_target ON entity_relations (target_type, target_id);

-- ============================================================
-- 18. SEARCH INDEX
-- ============================================================
-- NOTE: password_entries is intentionally never indexed here —
-- secrets must never enter the FTS index in any form.

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5 (
    entity_type UNINDEXED,
    entity_id UNINDEXED,
    title,
    content,
    tokenize = 'unicode61'
);

-- ============================================================
-- 19. ACTIVITY / CHANGE LOG
-- ============================================================
-- NOTE: application code must NEVER write plaintext secret values
-- (passwords, decrypted notes) into `changes` for entity_type = 'password'.
-- Log the fact of a change (e.g. {"field":"password"}), never the value.

CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (
        action IN ('created', 'updated', 'deleted', 'restored')
    ),
    changes TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(changes)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (created_at);

-- ============================================================
-- 20. DEFAULT WORKSPACE
-- ============================================================

INSERT OR IGNORE INTO workspaces (id, name, description, color, icon)
VALUES ('default', 'Personal', 'Default Noto workspace', '#8FAF91', 'home');

-- ============================================================
-- 21. DEFAULT APP SETTINGS
-- ============================================================

INSERT OR IGNORE INTO app_settings (key, value, value_type)
VALUES
    ('theme.appearance', 'system', 'string'),
    ('theme.preset', 'sage', 'string'),
    ('theme.custom_color', '#8FAF91', 'color'),
    ('sidebar.collapsed', 'false', 'boolean'),
    ('app.first_run', 'true', 'boolean');

-- ============================================================
-- 22. TRIGGERS — UPDATED TIMESTAMPS
-- ============================================================

CREATE TRIGGER IF NOT EXISTS trg_app_settings_updated
AFTER UPDATE ON app_settings
BEGIN
    UPDATE app_settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
END;

CREATE TRIGGER IF NOT EXISTS trg_workspaces_updated
AFTER UPDATE ON workspaces
BEGIN
    UPDATE workspaces SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_workspace_settings_updated
AFTER UPDATE ON workspace_settings
BEGIN
    UPDATE workspace_settings
    SET updated_at = CURRENT_TIMESTAMP
    WHERE workspace_id = NEW.workspace_id AND key = NEW.key;
END;

CREATE TRIGGER IF NOT EXISTS trg_tags_updated
AFTER UPDATE ON tags
BEGIN
    UPDATE tags SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_updated
AFTER UPDATE ON notes
BEGIN
    UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_updated
AFTER UPDATE ON tasks
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_calendar_events_updated
AFTER UPDATE ON calendar_events
BEGIN
    UPDATE calendar_events SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_financial_accounts_updated
AFTER UPDATE ON financial_accounts
BEGIN
    UPDATE financial_accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_financial_categories_updated
AFTER UPDATE ON financial_categories
BEGIN
    UPDATE financial_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_financial_transactions_updated
AFTER UPDATE ON financial_transactions
BEGIN
    UPDATE financial_transactions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_projects_updated
AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmark_folders_updated
AFTER UPDATE ON bookmark_folders
BEGIN
    UPDATE bookmark_folders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_updated
AFTER UPDATE ON bookmarks
BEGIN
    UPDATE bookmarks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_vault_config_updated
AFTER UPDATE ON vault_config
BEGIN
    UPDATE vault_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_password_folders_updated
AFTER UPDATE ON password_folders
BEGIN
    UPDATE password_folders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_password_entries_updated
AFTER UPDATE ON password_entries
BEGIN
    UPDATE password_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_reminders_updated
AFTER UPDATE ON reminders
BEGIN
    UPDATE reminders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_custom_fields_updated
AFTER UPDATE ON custom_fields
BEGIN
    UPDATE custom_fields SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_custom_field_values_updated
AFTER UPDATE ON custom_field_values
BEGIN
    UPDATE custom_field_values
    SET updated_at = CURRENT_TIMESTAMP
    WHERE field_id = NEW.field_id AND entity_type = NEW.entity_type AND entity_id = NEW.entity_id;
END;

-- ============================================================
-- 23. SEARCH TRIGGERS — NOTES
-- ============================================================

CREATE TRIGGER IF NOT EXISTS trg_notes_search_insert
AFTER INSERT ON notes
BEGIN
    INSERT INTO search_index (entity_type, entity_id, title, content)
    VALUES ('note', NEW.id, NEW.title, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_search_delete
AFTER DELETE ON notes
BEGIN
    DELETE FROM search_index WHERE entity_type = 'note' AND entity_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_notes_search_update
AFTER UPDATE ON notes
BEGIN
    DELETE FROM search_index WHERE entity_type = 'note' AND entity_id = OLD.id;
    INSERT INTO search_index (entity_type, entity_id, title, content)
    VALUES ('note', NEW.id, NEW.title, NEW.content);
END;

-- ============================================================
-- 24. SEARCH TRIGGERS — TASKS
-- ============================================================

CREATE TRIGGER IF NOT EXISTS trg_tasks_search_insert
AFTER INSERT ON tasks
BEGIN
    INSERT INTO search_index (entity_type, entity_id, title, content)
    VALUES ('task', NEW.id, NEW.title, NEW.description);
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_search_delete
AFTER DELETE ON tasks
BEGIN
    DELETE FROM search_index WHERE entity_type = 'task' AND entity_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_search_update
AFTER UPDATE ON tasks
BEGIN
    DELETE FROM search_index WHERE entity_type = 'task' AND entity_id = OLD.id;
    INSERT INTO search_index (entity_type, entity_id, title, content)
    VALUES ('task', NEW.id, NEW.title, NEW.description);
END;

-- ============================================================
-- 25. SEARCH TRIGGERS — BOOKMARKS
-- ============================================================

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_search_insert
AFTER INSERT ON bookmarks
BEGIN
    INSERT INTO search_index (entity_type, entity_id, title, content)
    VALUES ('bookmark', NEW.id, NEW.title, NEW.url || ' ' || NEW.description);
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_search_delete
AFTER DELETE ON bookmarks
BEGIN
    DELETE FROM search_index WHERE entity_type = 'bookmark' AND entity_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_bookmarks_search_update
AFTER UPDATE ON bookmarks
BEGIN
    DELETE FROM search_index WHERE entity_type = 'bookmark' AND entity_id = OLD.id;
    INSERT INTO search_index (entity_type, entity_id, title, content)
    VALUES ('bookmark', NEW.id, NEW.title, NEW.url || ' ' || NEW.description);
END;

-- ============================================================
-- COMPLETE
-- ============================================================
