use anyhow::Result;
use rusqlite::{params, Connection};

use crate::db::queries::Item;

/// Full-text search using FTS5. Supports prefix queries automatically.
pub fn search(conn: &Connection, query: &str) -> Result<Vec<Item>> {
    let query = query.trim();
    if query.is_empty() {
        let sql = format!(
            "SELECT {cols}
             FROM items i
             LEFT JOIN contexts c ON i.context_id = c.id
             WHERE i.deleted_at IS NULL
             ORDER BY i.position ASC, i.created_at DESC
             LIMIT 150",
            cols = crate::db::queries::ITEM_SELECT_COLS
        );
        let mut stmt = conn.prepare(&sql)?;
        let items = stmt
            .query_map([], crate::db::queries::map_item_row)?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        return Ok(items);
    }

    // Add prefix matching: append * to last term if it doesn't already end with one
    let fts_query = if query.ends_with('*') {
        query.to_string()
    } else {
        // Split into words and add * to the last one for prefix matching
        let words: Vec<&str> = query.split_whitespace().collect();
        if words.is_empty() {
            return Ok(vec![]);
        }
        let mut parts: Vec<String> = words.iter().map(|w| w.to_string()).collect();
        if let Some(last) = parts.last_mut() {
            last.push('*');
        }
        parts.join(" ")
    };

    let sql = format!(
        "SELECT {cols}
         FROM items i
         JOIN items_fts ON items_fts.rowid = i.rowid
         LEFT JOIN contexts c ON i.context_id = c.id
         WHERE items_fts MATCH ?1
           AND i.deleted_at IS NULL
         ORDER BY rank
         LIMIT 100",
        cols = crate::db::queries::ITEM_SELECT_COLS
    );
    let mut stmt = conn.prepare(&sql)?;

    let items = stmt
        .query_map(params![&fts_query], crate::db::queries::map_item_row)?
        .collect::<std::result::Result<Vec<_>, _>>()?;

    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use crate::db::queries::{insert_item, NewItem};

    fn setup_with_items() -> Connection {
        let conn = db::init_memory().unwrap();

        let items = vec![
            ("Estudar clouds sobre IA", "Verificar precos Azure e AWS"),
            ("Cobrar resposta do Fulano", "Email pendente"),
            ("PTASK0012345 correcao de vulnerabilidades", "Urgente"),
            ("Verificar escritura do banco", "Documentos pendentes"),
        ];

        for (title, body) in items {
            let new = NewItem {
                title: title.to_string(),
                body: Some(body.to_string()),
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
        }

        conn
    }

    #[test]
    fn test_search_by_title() {
        let conn = setup_with_items();
        let results = search(&conn, "clouds").unwrap();
        assert_eq!(results.len(), 1);
        assert!(results[0].title.contains("clouds"));
    }

    #[test]
    fn test_search_by_body() {
        let conn = setup_with_items();
        let results = search(&conn, "Azure").unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_prefix() {
        let conn = setup_with_items();
        let results = search(&conn, "Estud").unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_ticket_ref() {
        let conn = setup_with_items();
        let results = search(&conn, "PTASK").unwrap();
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn test_search_empty_query() {
        let conn = setup_with_items();
        let results = search(&conn, "").unwrap();
        assert_eq!(results.len(), 4);
    }

    #[test]
    fn test_search_no_results() {
        let conn = setup_with_items();
        let results = search(&conn, "xyznonexistent").unwrap();
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_diacritics() {
        let conn = db::init_memory().unwrap();
        let new = NewItem {
            title: "Verificar situacao da licenca".to_string(),
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

        // Search with accent should match without accent (unicode61 remove_diacritics 2)
        let results = search(&conn, "situacao").unwrap();
        assert_eq!(results.len(), 1);
    }
}
