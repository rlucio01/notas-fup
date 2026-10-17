pub mod migrations;
pub mod queries;
pub mod fts;

use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;

/// Open (or create) the SQLite database and run all pending migrations.
pub fn init(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    // Performance pragmas for a local-first desktop app.
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA foreign_keys = ON;
         PRAGMA busy_timeout = 5000;",
    )?;

    migrations::run_all(&conn)?;
    Ok(conn)
}

#[cfg(test)]
pub fn init_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;",
    )?;
    migrations::run_all(&conn)?;
    Ok(conn)
}
