use anyhow::Result;
use rusqlite::Connection;

/// Current schema version. Bump this when adding new migrations.
const CURRENT_VERSION: i64 = 2;

/// Run all pending migrations in order.
pub fn run_all(conn: &Connection) -> Result<()> {
    // Ensure the internal version tracking table exists.
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _schema_version (
            version INTEGER NOT NULL DEFAULT 0
        );",
    )?;

    let version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if version < 1 {
        migrate_v1(conn)?;
    }
    if version < 2 {
        migrate_v2(conn)?;
    }

    // Update version marker.
    if version < CURRENT_VERSION {
        conn.execute("DELETE FROM _schema_version", [])?;
        conn.execute(
            "INSERT INTO _schema_version (version) VALUES (?1)",
            [CURRENT_VERSION],
        )?;
    }

    Ok(())
}

fn migrate_v1(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        -- Device identity for future sync
        CREATE TABLE IF NOT EXISTS meta (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        -- Contexts: work, personal, projects, etc.
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

        -- Main items table
        CREATE TABLE IF NOT EXISTS items (
            id           TEXT PRIMARY KEY,
            context_id   TEXT,
            kind         TEXT NOT NULL DEFAULT 'note'
                         CHECK (kind IN ('task', 'link', 'note', 'ticket')),
            title        TEXT NOT NULL,
            body         TEXT,
            status       TEXT NOT NULL DEFAULT 'inbox'
                         CHECK (status IN ('inbox', 'open', 'waiting', 'done', 'dropped')),
            waiting_on   TEXT,
            followup_at  TEXT,
            due_at       TEXT,
            ticket_ref   TEXT,
            url          TEXT,
            done_at      TEXT,
            source       TEXT NOT NULL DEFAULT 'manual'
                         CHECK (source IN ('capture', 'import', 'manual')),
            origin_app   TEXT,
            created_at   TEXT NOT NULL,
            updated_at   TEXT NOT NULL,
            deleted_at   TEXT,
            position     REAL NOT NULL DEFAULT 0.0,
            FOREIGN KEY (context_id) REFERENCES contexts(id)
        );

        CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
        CREATE INDEX IF NOT EXISTS idx_items_context ON items(context_id);
        CREATE INDEX IF NOT EXISTS idx_items_followup ON items(followup_at);
        CREATE INDEX IF NOT EXISTS idx_items_due ON items(due_at);
        CREATE INDEX IF NOT EXISTS idx_items_waiting ON items(waiting_on);
        CREATE INDEX IF NOT EXISTS idx_items_position ON items(position);

        -- Tags
        CREATE TABLE IF NOT EXISTS tags (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
        );

        -- Item-Tag N:N
        CREATE TABLE IF NOT EXISTS item_tags (
            item_id TEXT NOT NULL,
            tag_id  TEXT NOT NULL,
            PRIMARY KEY (item_id, tag_id),
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (tag_id)  REFERENCES tags(id)
        );

        -- FTS5 virtual table for full-text search
        CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
            title,
            body,
            waiting_on,
            ticket_ref,
            content = 'items',
            content_rowid = 'rowid',
            tokenize = 'unicode61 remove_diacritics 2'
        );

        -- Triggers to keep FTS in sync
        CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
            INSERT INTO items_fts(rowid, title, body, waiting_on, ticket_ref)
            VALUES (NEW.rowid, NEW.title, NEW.body, NEW.waiting_on, NEW.ticket_ref);
        END;

        CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
            INSERT INTO items_fts(items_fts, rowid, title, body, waiting_on, ticket_ref)
            VALUES ('delete', OLD.rowid, OLD.title, OLD.body, OLD.waiting_on, OLD.ticket_ref);
        END;

        CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
            INSERT INTO items_fts(items_fts, rowid, title, body, waiting_on, ticket_ref)
            VALUES ('delete', OLD.rowid, OLD.title, OLD.body, OLD.waiting_on, OLD.ticket_ref);
            INSERT INTO items_fts(rowid, title, body, waiting_on, ticket_ref)
            VALUES (NEW.rowid, NEW.title, NEW.body, NEW.waiting_on, NEW.ticket_ref);
        END;

        -- Attachments / Screenshots (Prints)
        CREATE TABLE IF NOT EXISTS attachments (
            id         TEXT PRIMARY KEY,
            item_id    TEXT NOT NULL,
            filename   TEXT,
            mime_type  TEXT NOT NULL,
            data       TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_attachments_item ON attachments(item_id);
        ",
    )?;

    // Insert device_id if not present.
    let device_id = uuid::Uuid::now_v7().to_string();
    conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('device_id', ?1)",
        [&device_id],
    )?;

    Ok(())
}

fn migrate_v2(conn: &Connection) -> Result<()> {
    let has_position: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('items') WHERE name = 'position'",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map(|c| c > 0)
        .unwrap_or(false);

    if !has_position {
        conn.execute(
            "ALTER TABLE items ADD COLUMN position REAL NOT NULL DEFAULT 0.0",
            [],
        )?;
    }

    conn.execute_batch(
        "CREATE INDEX IF NOT EXISTS idx_items_position ON items(position);",
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn test_migrations_run_without_error() {
        let conn = db::init_memory().unwrap();
        // Verify tables exist
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='items'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_migrations_idempotent() {
        let conn = db::init_memory().unwrap();
        // Running again should not fail
        run_all(&conn).unwrap();
    }

    #[test]
    fn test_device_id_created() {
        let conn = db::init_memory().unwrap();
        let device_id: String = conn
            .query_row(
                "SELECT value FROM meta WHERE key = 'device_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(!device_id.is_empty());
    }

    #[test]
    fn test_fts_table_exists() {
        let conn = db::init_memory().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='items_fts'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_schema_version() {
        let conn = db::init_memory().unwrap();
        let version: i64 = conn
            .query_row("SELECT version FROM _schema_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, CURRENT_VERSION);
    }
}
