-- Cloudflare D1 Schema for Notas FUP

CREATE TABLE IF NOT EXISTS contexts (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    color        TEXT NOT NULL DEFAULT '#6366f1',
    sync_enabled INTEGER NOT NULL DEFAULT 1,
    archived     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    deleted_at   TEXT
);

CREATE TABLE IF NOT EXISTS items (
    id          TEXT PRIMARY KEY,
    context_id  TEXT REFERENCES contexts(id) ON DELETE SET NULL,
    kind        TEXT NOT NULL DEFAULT 'task',
    title       TEXT NOT NULL,
    body        TEXT,
    status      TEXT NOT NULL DEFAULT 'inbox',
    waiting_on  TEXT,
    followup_at TEXT,
    due_at      TEXT,
    ticket_ref  TEXT,
    url         TEXT,
    done_at     TEXT,
    source      TEXT NOT NULL DEFAULT 'manual',
    origin_app  TEXT,
    position    REAL NOT NULL DEFAULT 0.0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_context ON items(context_id);
CREATE INDEX IF NOT EXISTS idx_items_position ON items(position);
CREATE INDEX IF NOT EXISTS idx_items_updated ON items(updated_at);
CREATE INDEX IF NOT EXISTS idx_items_deleted ON items(deleted_at);

CREATE TABLE IF NOT EXISTS attachments (
    id          TEXT PRIMARY KEY,
    item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    filename    TEXT,
    mime_type   TEXT NOT NULL,
    data        TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments(item_id);

CREATE TABLE IF NOT EXISTS tags (
    id   TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS item_tags (
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    tag_id  TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);
