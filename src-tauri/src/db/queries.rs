use anyhow::Result;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::parser::ProposedItem;

// ── Models ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    pub context_id: Option<String>,
    pub kind: String,
    pub title: String,
    pub body: Option<String>,
    pub status: String,
    pub waiting_on: Option<String>,
    pub followup_at: Option<String>,
    pub due_at: Option<String>,
    pub ticket_ref: Option<String>,
    pub url: Option<String>,
    pub done_at: Option<String>,
    pub source: String,
    pub origin_app: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
    // Joined fields (optional, populated by some queries)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_color: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub attachment_count: i64,
    #[serde(default)]
    pub position: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub item_id: String,
    pub filename: Option<String>,
    pub mime_type: String,
    pub data: String,
    pub created_at: String,
}

pub const ITEM_SELECT_COLS: &str = "i.id, i.context_id, i.kind, i.title, i.body, i.status,
        i.waiting_on, i.followup_at, i.due_at, i.ticket_ref, i.url,
        i.done_at, i.source, i.origin_app, i.created_at, i.updated_at,
        i.deleted_at, c.name, c.color,
        (SELECT GROUP_CONCAT(t.name, ',') FROM item_tags it JOIN tags t ON it.tag_id = t.id WHERE it.item_id = i.id),
        (SELECT COUNT(*) FROM attachments a WHERE a.item_id = i.id),
        i.position";

pub fn map_item_row(row: &rusqlite::Row) -> rusqlite::Result<Item> {
    let tags_csv: Option<String> = row.get(19)?;
    let tags = match tags_csv {
        Some(s) if !s.is_empty() => s
            .split(',')
            .filter(|t| !t.is_empty())
            .map(|t| t.to_string())
            .collect(),
        _ => vec![],
    };
    let attachment_count: i64 = row.get(20).unwrap_or(0);
    let position: f64 = row.get(21).unwrap_or(0.0);

    Ok(Item {
        id: row.get(0)?,
        context_id: row.get(1)?,
        kind: row.get(2)?,
        title: row.get(3)?,
        body: row.get(4)?,
        status: row.get(5)?,
        waiting_on: row.get(6)?,
        followup_at: row.get(7)?,
        due_at: row.get(8)?,
        ticket_ref: row.get(9)?,
        url: row.get(10)?,
        done_at: row.get(11)?,
        source: row.get(12)?,
        origin_app: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
        deleted_at: row.get(16)?,
        context_name: row.get(17)?,
        context_color: row.get(18)?,
        tags,
        attachment_count,
        position,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Context {
    pub id: String,
    pub name: String,
    pub color: String,
    pub sync_enabled: bool,
    pub archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewItem {
    pub title: String,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub context_id: Option<String>,
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub waiting_on: Option<String>,
    #[serde(default)]
    pub followup_at: Option<String>,
    #[serde(default)]
    pub due_at: Option<String>,
    #[serde(default)]
    pub ticket_ref: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default = "default_source")]
    pub source: String,
    #[serde(default)]
    pub origin_app: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_kind() -> String {
    "note".to_string()
}
fn default_status() -> String {
    "inbox".to_string()
}
fn default_source() -> String {
    "manual".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateItem {
    pub id: String,
    #[serde(default)]
    pub context_id: Option<Option<String>>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub body: Option<Option<String>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub waiting_on: Option<Option<String>>,
    #[serde(default)]
    pub followup_at: Option<Option<String>>,
    #[serde(default)]
    pub due_at: Option<Option<String>>,
    #[serde(default)]
    pub ticket_ref: Option<Option<String>>,
    #[serde(default)]
    pub url: Option<Option<String>>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

// ── Today items ─────────────────────────────────────────────────────────

/// Items for the Today/Execution screen: all active open tasks to be executed,
/// overdue, waiting items, and inbox items. Excludes done/dropped and soft-deleted.
pub fn get_today_items(conn: &Connection) -> Result<Vec<Item>> {
    let sql = format!(
        "SELECT {ITEM_SELECT_COLS}
         FROM items i
         LEFT JOIN contexts c ON i.context_id = c.id
         WHERE i.deleted_at IS NULL
           AND i.status NOT IN ('done', 'dropped')
         ORDER BY
           CASE
             WHEN i.status = 'open' THEN 0
             WHEN i.status = 'waiting' THEN 1
             WHEN i.status = 'inbox' THEN 2
             ELSE 3
           END,
           i.position ASC,
           i.created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let items = stmt
        .query_map([], map_item_row)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(items)
}

// ── Inbox items ─────────────────────────────────────────────────────────

pub fn get_inbox_items(conn: &Connection) -> Result<Vec<Item>> {
    let sql = format!(
        "SELECT {ITEM_SELECT_COLS}
         FROM items i
         LEFT JOIN contexts c ON i.context_id = c.id
         WHERE i.deleted_at IS NULL AND i.status = 'inbox'
         ORDER BY i.position ASC, i.created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let items = stmt
        .query_map([], map_item_row)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(items)
}

// ── Done items ──────────────────────────────────────────────────────────

pub fn get_done_items(conn: &Connection) -> Result<Vec<Item>> {
    let sql = format!(
        "SELECT {ITEM_SELECT_COLS}
         FROM items i
         LEFT JOIN contexts c ON i.context_id = c.id
         WHERE i.deleted_at IS NULL AND i.status IN ('done', 'dropped')
         ORDER BY i.done_at DESC, i.updated_at DESC
         LIMIT 200"
    );
    let mut stmt = conn.prepare(&sql)?;
    let items = stmt
        .query_map([], map_item_row)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(items)
}

// ── Review items ────────────────────────────────────────────────────────

pub fn get_review_items(conn: &Connection, stale_days: i64) -> Result<Vec<Item>> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let stale_date = (Utc::now() - chrono::Duration::days(stale_days))
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();
    let today_start = format!("{today}T00:00:00");

    let sql = format!(
        "SELECT {ITEM_SELECT_COLS}
         FROM items i
         LEFT JOIN contexts c ON i.context_id = c.id
         WHERE i.deleted_at IS NULL
           AND (
               (i.created_at >= ?1)
               OR (i.due_at IS NOT NULL AND i.due_at <= ?2 AND i.status NOT IN ('done', 'dropped'))
               OR (i.updated_at < ?3 AND i.status NOT IN ('done', 'dropped', 'inbox'))
           )
         ORDER BY i.created_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let items = stmt
        .query_map(params![&today_start, &today, &stale_date], map_item_row)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(items)
}

// ── Insert item ─────────────────────────────────────────────────────────

pub fn insert_item(conn: &Connection, new: &NewItem) -> Result<Item> {
    let id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();

    // Determine if status should auto-upgrade based on context presence
    let status = if new.status == "inbox" && new.context_id.is_some() {
        "open".to_string()
    } else {
        new.status.clone()
    };

    let done_at = if status == "done" {
        Some(now.clone())
    } else {
        None
    };

    conn.execute(
        "INSERT INTO items (id, context_id, kind, title, body, status, waiting_on,
         followup_at, due_at, ticket_ref, url, done_at, source, origin_app,
         created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            &id,
            &new.context_id,
            &new.kind,
            &new.title,
            &new.body,
            &status,
            &new.waiting_on,
            &new.followup_at,
            &new.due_at,
            &new.ticket_ref,
            &new.url,
            &done_at,
            &new.source,
            &new.origin_app,
            &now,
            &now,
        ],
    )?;

    // Handle tags
    for tag_name in &new.tags {
        let tag_name = tag_name.trim().to_lowercase().replace(' ', "");
        if tag_name.is_empty() {
            continue;
        }
        ensure_tag(conn, &tag_name)?;
        let tag_id: String = conn.query_row(
            "SELECT id FROM tags WHERE name = ?1",
            [&tag_name],
            |row| row.get(0),
        )?;
        conn.execute(
            "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
            params![&id, &tag_id],
        )?;
    }

    Ok(Item {
        id,
        context_id: new.context_id.clone(),
        kind: new.kind.clone(),
        title: new.title.clone(),
        body: new.body.clone(),
        status,
        waiting_on: new.waiting_on.clone(),
        followup_at: new.followup_at.clone(),
        due_at: new.due_at.clone(),
        ticket_ref: new.ticket_ref.clone(),
        url: new.url.clone(),
        done_at,
        source: new.source.clone(),
        origin_app: new.origin_app.clone(),
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
        context_name: None,
        context_color: None,
        tags: new.tags.clone(),
        attachment_count: 0,
        position: 0.0,
    })
}

pub fn upsert_remote_items(conn: &Connection, items: &[Item]) -> Result<usize> {
    let mut updated = 0;
    for item in items {
        let rows = conn.execute(
            "INSERT INTO items (
                id, context_id, kind, title, body, status, waiting_on,
                followup_at, due_at, ticket_ref, url, done_at, source,
                origin_app, position, created_at, updated_at, deleted_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
             ON CONFLICT(id) DO UPDATE SET
                context_id = excluded.context_id,
                kind = excluded.kind,
                title = excluded.title,
                body = excluded.body,
                status = excluded.status,
                waiting_on = excluded.waiting_on,
                followup_at = excluded.followup_at,
                due_at = excluded.due_at,
                ticket_ref = excluded.ticket_ref,
                url = excluded.url,
                done_at = excluded.done_at,
                position = excluded.position,
                updated_at = excluded.updated_at,
                deleted_at = excluded.deleted_at
             WHERE excluded.updated_at >= items.updated_at",
            params![
                &item.id,
                &item.context_id,
                &item.kind,
                &item.title,
                &item.body,
                &item.status,
                &item.waiting_on,
                &item.followup_at,
                &item.due_at,
                &item.ticket_ref,
                &item.url,
                &item.done_at,
                &item.source,
                &item.origin_app,
                &item.position,
                &item.created_at,
                &item.updated_at,
                &item.deleted_at,
            ],
        )?;
        if rows > 0 {
            updated += 1;
        }
    }
    Ok(updated)
}

fn ensure_tag(conn: &Connection, name: &str) -> Result<()> {
    let exists: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM tags WHERE name = ?1",
        [name],
        |row| row.get(0),
    )?;
    if !exists {
        let id = Uuid::now_v7().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO tags (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![&id, name, &now, &now],
        )?;
    }
    Ok(())
}

// ── Update item ─────────────────────────────────────────────────────────

pub fn update_item(conn: &Connection, update: &UpdateItem) -> Result<Item> {
    let now = Utc::now().to_rfc3339();

    // Build dynamic SET clause
    let mut sets = vec!["updated_at = ?1".to_string()];
    let mut param_idx = 2u32;
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now.clone())];

    macro_rules! set_field {
        ($field:ident, $col:expr) => {
            if let Some(ref val) = update.$field {
                sets.push(format!("{} = ?{}", $col, param_idx));
                values.push(Box::new(val.clone()));
                param_idx += 1;
            }
        };
    }

    macro_rules! set_option_field {
        ($field:ident, $col:expr) => {
            if let Some(ref val) = update.$field {
                sets.push(format!("{} = ?{}", $col, param_idx));
                values.push(Box::new(val.clone()));
                param_idx += 1;
            }
        };
    }

    set_option_field!(context_id, "context_id");
    set_field!(kind, "kind");
    set_field!(title, "title");
    set_option_field!(body, "body");
    set_option_field!(waiting_on, "waiting_on");
    set_option_field!(followup_at, "followup_at");
    set_option_field!(due_at, "due_at");
    set_option_field!(ticket_ref, "ticket_ref");
    set_option_field!(url, "url");

    // Handle status with done_at side-effect
    if let Some(ref status) = update.status {
        sets.push(format!("status = ?{param_idx}"));
        values.push(Box::new(status.clone()));
        param_idx += 1;
        if status == "done" || status == "dropped" {
            sets.push(format!("done_at = ?{param_idx}"));
            values.push(Box::new(now.clone()));
            param_idx += 1;
        }
    }

    // Add the WHERE id
    let sql = format!(
        "UPDATE items SET {} WHERE id = ?{} AND deleted_at IS NULL",
        sets.join(", "),
        param_idx
    );
    values.push(Box::new(update.id.clone()));

    let params_ref: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    conn.execute(&sql, params_ref.as_slice())?;

    // Handle tags if provided
    if let Some(ref tags) = update.tags {
        conn.execute("DELETE FROM item_tags WHERE item_id = ?1", [&update.id])?;
        for tag_name in tags {
            let tag_name = tag_name.trim().to_lowercase().replace(' ', "");
            if tag_name.is_empty() {
                continue;
            }
            ensure_tag(conn, &tag_name)?;
            let tag_id: String = conn.query_row(
                "SELECT id FROM tags WHERE name = ?1",
                [&tag_name],
                |row| row.get(0),
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?1, ?2)",
                params![&update.id, &tag_id],
            )?;
        }
    }

    // Fetch and return updated item
    get_item_by_id(conn, &update.id)
}

pub fn get_item_by_id(conn: &Connection, id: &str) -> Result<Item> {
    let sql = format!(
        "SELECT {ITEM_SELECT_COLS}
         FROM items i
         LEFT JOIN contexts c ON i.context_id = c.id
         WHERE i.id = ?1"
    );
    let item = conn.query_row(&sql, [id], map_item_row)?;
    Ok(item)
}

// ── Contexts ────────────────────────────────────────────────────────────

pub fn get_contexts(conn: &Connection) -> Result<Vec<Context>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, sync_enabled, archived, created_at, updated_at, deleted_at
         FROM contexts
         WHERE deleted_at IS NULL
         ORDER BY name",
    )?;

    let contexts = stmt
        .query_map([], |row| {
            Ok(Context {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                sync_enabled: row.get(3)?,
                archived: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                deleted_at: row.get(7)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(contexts)
}

pub fn create_context(conn: &Connection, name: &str, color: &str) -> Result<Context> {
    let id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO contexts (id, name, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![&id, name, color, &now, &now],
    )?;
    Ok(Context {
        id,
        name: name.to_string(),
        color: color.to_string(),
        sync_enabled: true,
        archived: false,
        created_at: now.clone(),
        updated_at: now,
        deleted_at: None,
    })
}

pub fn find_or_create_context(conn: &Connection, name: &str) -> Result<String> {
    if let Ok(id) = conn.query_row(
        "SELECT id FROM contexts WHERE LOWER(name) = LOWER(?1) AND deleted_at IS NULL",
        [name],
        |row| row.get::<_, String>(0),
    ) {
        return Ok(id);
    }
    let ctx = create_context(conn, name, "#6366f1")?;
    Ok(ctx.id)
}

pub fn update_context(conn: &Connection, id: &str, name: &str, color: &str) -> Result<Context> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE contexts SET name = ?1, color = ?2, updated_at = ?3 WHERE id = ?4",
        params![name, color, &now, id],
    )?;

    let mut stmt = conn.prepare(
        "SELECT id, name, color, sync_enabled, archived, created_at, updated_at, deleted_at
         FROM contexts WHERE id = ?1",
    )?;
    let ctx = stmt.query_row([id], |row| {
        Ok(Context {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            sync_enabled: row.get(3)?,
            archived: row.get(4)?,
            created_at: row.get(5)?,
            updated_at: row.get(6)?,
            deleted_at: row.get(7)?,
        })
    })?;

    Ok(ctx)
}

pub fn delete_context(conn: &Connection, id: &str) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE contexts SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
        params![&now, id],
    )?;
    conn.execute(
        "UPDATE items SET context_id = NULL, updated_at = ?1 WHERE context_id = ?2",
        params![&now, id],
    )?;
    Ok(())
}

// ── Import proposed items ───────────────────────────────────────────────

pub fn import_proposed_items(conn: &Connection, proposed: &[ProposedItem]) -> Result<Vec<Item>> {
    let mut imported = Vec::new();
    for p in proposed {
        if p.is_secret && !p.force_import {
            continue;
        }

        let context_id = if let Some(ref ctx_name) = p.context {
            Some(find_or_create_context(conn, ctx_name)?)
        } else {
            None
        };

        let new = NewItem {
            title: p.title.clone(),
            body: p.body.clone(),
            context_id,
            kind: p.kind.clone(),
            status: p.status.clone(),
            waiting_on: p.waiting_on.clone(),
            followup_at: p.followup_at.clone(),
            due_at: p.due_at.clone(),
            ticket_ref: p.ticket_ref.clone(),
            url: p.url.clone(),
            source: "import".to_string(),
            origin_app: None,
            tags: p.tags.clone(),
        };
        let item = insert_item(conn, &new)?;
        imported.push(item);
    }
    Ok(imported)
}

// ── Attachments ─────────────────────────────────────────────────────────

pub fn add_attachment(
    conn: &Connection,
    item_id: &str,
    filename: Option<&str>,
    mime_type: &str,
    data: &str,
) -> Result<Attachment> {
    let id = Uuid::now_v7().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO attachments (id, item_id, filename, mime_type, data, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![&id, item_id, &filename, mime_type, data, &now],
    )?;

    // Touch item updated_at
    conn.execute(
        "UPDATE items SET updated_at = ?1 WHERE id = ?2",
        params![&now, item_id],
    )?;

    Ok(Attachment {
        id,
        item_id: item_id.to_string(),
        filename: filename.map(|s| s.to_string()),
        mime_type: mime_type.to_string(),
        data: data.to_string(),
        created_at: now,
    })
}

pub fn get_item_attachments(conn: &Connection, item_id: &str) -> Result<Vec<Attachment>> {
    let mut stmt = conn.prepare(
        "SELECT id, item_id, filename, mime_type, data, created_at
         FROM attachments
         WHERE item_id = ?1
         ORDER BY created_at ASC",
    )?;

    let attachments = stmt
        .query_map([item_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                item_id: row.get(1)?,
                filename: row.get(2)?,
                mime_type: row.get(3)?,
                data: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(attachments)
}

pub fn delete_attachment(conn: &Connection, id: &str) -> Result<()> {
    conn.execute("DELETE FROM attachments WHERE id = ?1", [id])?;
    Ok(())
}

pub fn reorder_items(conn: &Connection, item_ids: &[String]) -> Result<()> {
    let now = Utc::now().to_rfc3339();
    let mut stmt = conn.prepare("UPDATE items SET position = ?1, updated_at = ?2 WHERE id = ?3")?;
    for (index, id) in item_ids.iter().enumerate() {
        stmt.execute(params![index as f64, &now, id])?;
    }
    Ok(())
}

// ── Follow-up Alerts ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FollowupAlerts {
    pub overdue: Vec<Item>,
    pub due_today: Vec<Item>,
    pub due_tomorrow: Vec<Item>,
}

pub fn get_followup_alerts(conn: &Connection) -> Result<FollowupAlerts> {
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let tomorrow = (Utc::now() + chrono::Duration::days(1)).format("%Y-%m-%d").to_string();

    let sql = format!(
        "SELECT {ITEM_SELECT_COLS}
         FROM items i
         LEFT JOIN contexts c ON i.context_id = c.id
         WHERE i.deleted_at IS NULL
           AND i.status = 'waiting'
           AND i.followup_at IS NOT NULL
           AND i.followup_at <= ?1
         ORDER BY i.followup_at ASC, i.position ASC"
    );

    let mut stmt = conn.prepare(&sql)?;
    let items: Vec<Item> = stmt
        .query_map([&tomorrow], map_item_row)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    let mut overdue = Vec::new();
    let mut due_today = Vec::new();
    let mut due_tomorrow = Vec::new();

    for item in items {
        if let Some(ref d) = item.followup_at {
            let d_str = &d[..10.min(d.len())];
            if d_str < &today[..] {
                overdue.push(item);
            } else if d_str == &today[..] {
                due_today.push(item);
            } else if d_str == &tomorrow[..] {
                due_tomorrow.push(item);
            }
        }
    }

    Ok(FollowupAlerts {
        overdue,
        due_today,
        due_tomorrow,
    })
}

// ── Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn setup() -> Connection {
        db::init_memory().unwrap()
    }

    #[test]
    fn test_reorder_items() {
        let conn = setup();
        let item1 = insert_item(
            &conn,
            &NewItem {
                title: "First item".to_string(),
                body: None,
                context_id: None,
                kind: "task".to_string(),
                status: "inbox".to_string(),
                waiting_on: None,
                followup_at: None,
                due_at: None,
                ticket_ref: None,
                url: None,
                source: "manual".to_string(),
                origin_app: None,
                tags: vec![],
            },
        )
        .unwrap();

        let item2 = insert_item(
            &conn,
            &NewItem {
                title: "Second item".to_string(),
                body: None,
                context_id: None,
                kind: "task".to_string(),
                status: "inbox".to_string(),
                waiting_on: None,
                followup_at: None,
                due_at: None,
                ticket_ref: None,
                url: None,
                source: "manual".to_string(),
                origin_app: None,
                tags: vec![],
            },
        )
        .unwrap();

        // Reorder putting item2 first, item1 second
        reorder_items(&conn, &[item2.id.clone(), item1.id.clone()]).unwrap();

        let inboxes = get_inbox_items(&conn).unwrap();
        assert_eq!(inboxes.len(), 2);
        assert_eq!(inboxes[0].id, item2.id);
        assert_eq!(inboxes[1].id, item1.id);
    }

    #[test]
    fn test_attachment_crud_and_count() {
        let conn = setup();
        let new = NewItem {
            title: "Task with print".to_string(),
            body: None,
            context_id: None,
            kind: "task".to_string(),
            status: "inbox".to_string(),
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            source: "manual".to_string(),
            origin_app: None,
            tags: vec![],
        };
        let item = insert_item(&conn, &new).unwrap();
        assert_eq!(item.attachment_count, 0);

        let att = add_attachment(
            &conn,
            &item.id,
            Some("screenshot.png"),
            "image/png",
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        )
        .unwrap();
        assert_eq!(att.item_id, item.id);

        let list = get_item_attachments(&conn, &item.id).unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].mime_type, "image/png");

        let fetched = get_item_by_id(&conn, &item.id).unwrap();
        assert_eq!(fetched.attachment_count, 1);

        delete_attachment(&conn, &att.id).unwrap();
        let list_after = get_item_attachments(&conn, &item.id).unwrap();
        assert_eq!(list_after.len(), 0);

        let fetched_after = get_item_by_id(&conn, &item.id).unwrap();
        assert_eq!(fetched_after.attachment_count, 0);
    }

    #[test]
    fn test_insert_and_get_item() {
        let conn = setup();
        let new = NewItem {
            title: "Test item".to_string(),
            body: Some("Body text".to_string()),
            context_id: None,
            kind: "note".to_string(),
            status: "inbox".to_string(),
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            source: "manual".to_string(),
            origin_app: None,
            tags: vec![],
        };
        let item = insert_item(&conn, &new).unwrap();
        assert_eq!(item.title, "Test item");
        assert_eq!(item.status, "inbox");
        assert!(!item.id.is_empty());

        let fetched = get_item_by_id(&conn, &item.id).unwrap();
        assert_eq!(fetched.title, "Test item");
    }

    #[test]
    fn test_item_with_context_gets_open_status() {
        let conn = setup();
        let ctx = create_context(&conn, "Trabalho", "#3b82f6").unwrap();
        let new = NewItem {
            title: "Work item".to_string(),
            body: None,
            context_id: Some(ctx.id.clone()),
            kind: "task".to_string(),
            status: "inbox".to_string(),
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            source: "capture".to_string(),
            origin_app: None,
            tags: vec![],
        };
        let item = insert_item(&conn, &new).unwrap();
        // Item with context auto-upgrades from inbox to open
        assert_eq!(item.status, "open");
    }

    #[test]
    fn test_insert_item_with_tags() {
        let conn = setup();
        let new = NewItem {
            title: "Tagged item".to_string(),
            body: None,
            context_id: None,
            kind: "note".to_string(),
            status: "inbox".to_string(),
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            source: "manual".to_string(),
            origin_app: None,
            tags: vec!["finops".to_string(), "cloud".to_string()],
        };
        let item = insert_item(&conn, &new).unwrap();

        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM item_tags WHERE item_id = ?1",
                [&item.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(tag_count, 2);

        let fetched = get_item_by_id(&conn, &item.id).unwrap();
        assert_eq!(fetched.tags.len(), 2);
        assert!(fetched.tags.contains(&"finops".to_string()));
        assert!(fetched.tags.contains(&"cloud".to_string()));

        // Test updating/reclassifying tags
        let update = UpdateItem {
            id: item.id.clone(),
            context_id: None,
            kind: None,
            title: None,
            body: None,
            status: None,
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            tags: Some(vec!["nova_tag".to_string()]),
        };
        let updated = update_item(&conn, &update).unwrap();
        assert_eq!(updated.tags, vec!["nova_tag".to_string()]);
    }

    #[test]
    fn test_update_item_status() {
        let conn = setup();
        let new = NewItem {
            title: "To complete".to_string(),
            body: None,
            context_id: None,
            kind: "task".to_string(),
            status: "inbox".to_string(),
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            source: "manual".to_string(),
            origin_app: None,
            tags: vec![],
        };
        let item = insert_item(&conn, &new).unwrap();

        let update = UpdateItem {
            id: item.id.clone(),
            status: Some("done".to_string()),
            context_id: None,
            kind: None,
            title: None,
            body: None,
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            tags: None,
        };
        let updated = update_item(&conn, &update).unwrap();
        assert_eq!(updated.status, "done");
        assert!(updated.done_at.is_some());
    }

    #[test]
    fn test_inbox_items_query() {
        let conn = setup();
        let new = NewItem {
            title: "Inbox item".to_string(),
            body: None,
            context_id: None,
            kind: "note".to_string(),
            status: "inbox".to_string(),
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            source: "manual".to_string(),
            origin_app: None,
            tags: vec![],
        };
        insert_item(&conn, &new).unwrap();

        let items = get_inbox_items(&conn).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].status, "inbox");
    }

    #[test]
    fn test_context_crud() {
        let conn = setup();
        let ctx = create_context(&conn, "Pessoal", "#ef4444").unwrap();
        assert_eq!(ctx.name, "Pessoal");
        assert_eq!(ctx.color, "#ef4444");

        let all = get_contexts(&conn).unwrap();
        assert_eq!(all.len(), 1);

        let updated = update_context(&conn, &ctx.id, "Pessoal VIP", "#3b82f6").unwrap();
        assert_eq!(updated.name, "Pessoal VIP");
        assert_eq!(updated.color, "#3b82f6");

        delete_context(&conn, &ctx.id).unwrap();
        let all_after = get_contexts(&conn).unwrap();
        assert_eq!(all_after.len(), 0);
    }

    #[test]
    fn test_find_or_create_context() {
        let conn = setup();
        let id1 = find_or_create_context(&conn, "Trabalho").unwrap();
        let id2 = find_or_create_context(&conn, "trabalho").unwrap();
        assert_eq!(id1, id2); // case-insensitive match
    }

    #[test]
    fn test_done_items_query() {
        let conn = setup();
        let new = NewItem {
            title: "Done item".to_string(),
            body: None,
            context_id: None,
            kind: "task".to_string(),
            status: "inbox".to_string(),
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            source: "manual".to_string(),
            origin_app: None,
            tags: vec![],
        };
        let item = insert_item(&conn, &new).unwrap();
        let update = UpdateItem {
            id: item.id,
            status: Some("done".to_string()),
            context_id: None,
            kind: None,
            title: None,
            body: None,
            waiting_on: None,
            followup_at: None,
            due_at: None,
            ticket_ref: None,
            url: None,
            tags: None,
        };
        update_item(&conn, &update).unwrap();

        let done = get_done_items(&conn).unwrap();
        assert_eq!(done.len(), 1);
        assert_eq!(done[0].status, "done");
    }
}
