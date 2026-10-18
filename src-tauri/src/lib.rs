pub mod active_app;
pub mod capture;
pub mod config;
pub mod db;
pub mod parser;
pub mod sync;
pub mod tray;

use anyhow::Result;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

// ── Tauri Commands ───────────────────────────────────────────────────

#[tauri::command]
fn get_today_items(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let items = db::queries::get_today_items(&conn).map_err(|e| e.to_string())?;
    serde_json::to_string(&items).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_inbox_items(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let items = db::queries::get_inbox_items(&conn).map_err(|e| e.to_string())?;
    serde_json::to_string(&items).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_item(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    item_json: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let new_item: db::queries::NewItem =
        serde_json::from_str(&item_json).map_err(|e| e.to_string())?;
    let item = db::queries::insert_item(&conn, &new_item).map_err(|e| e.to_string())?;
    let _ = app.emit("item-created", &item.id);
    serde_json::to_string(&item).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_item(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    item_json: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let update: db::queries::UpdateItem =
        serde_json::from_str(&item_json).map_err(|e| e.to_string())?;
    let item = db::queries::update_item(&conn, &update).map_err(|e| e.to_string())?;
    let _ = app.emit("item-updated", &item.id);
    serde_json::to_string(&item).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_items(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    query: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let items = db::fts::search(&conn, &query).map_err(|e| e.to_string())?;
    serde_json::to_string(&items).map_err(|e| e.to_string())
}

#[tauri::command]
fn parse_notepad_text(text: String) -> Result<String, String> {
    let proposed = parser::parse(&text);
    serde_json::to_string(&proposed).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_items(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    items_json: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let proposed: Vec<parser::ProposedItem> =
        serde_json::from_str(&items_json).map_err(|e| e.to_string())?;
    let imported =
        db::queries::import_proposed_items(&conn, &proposed).map_err(|e| e.to_string())?;
    let _ = app.emit("items-imported", ());
    serde_json::to_string(&imported).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_contexts(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let contexts = db::queries::get_contexts(&conn).map_err(|e| e.to_string())?;
    serde_json::to_string(&contexts).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_context(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    name: String,
    color: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let ctx = db::queries::create_context(&conn, &name, &color).map_err(|e| e.to_string())?;
    serde_json::to_string(&ctx).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_done_items(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let items = db::queries::get_done_items(&conn).map_err(|e| e.to_string())?;
    serde_json::to_string(&items).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_review_items(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    stale_days: i64,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let items = db::queries::get_review_items(&conn, stale_days).map_err(|e| e.to_string())?;
    serde_json::to_string(&items).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_capture(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    text: String,
    origin_app: Option<String>,
) -> Result<String, String> {
    let parsed = capture::syntax::parse_quick_capture(&text);
    if parsed.title.trim().is_empty() {
        capture::close_capture_window(&app);
        return Err("Título não pode ser vazio".to_string());
    }

    let conn = state.lock().map_err(|e| e.to_string())?;

    // Find or create context if specified
    let context_id = if let Some(ctx_name) = &parsed.context {
        let ctx_id = db::queries::find_or_create_context(&conn, ctx_name)
            .map_err(|e| e.to_string())?;
        Some(ctx_id)
    } else {
        None
    };

    let status = if parsed.waiting_on.is_some() || parsed.followup_at.is_some() {
        "waiting".to_string()
    } else if context_id.is_some() {
        "open".to_string()
    } else {
        "inbox".to_string()
    };

    let kind = if parsed.ticket_ref.is_some() {
        "ticket".to_string()
    } else if parsed.url.is_some() {
        "link".to_string()
    } else if status == "waiting" {
        "task".to_string()
    } else {
        "note".to_string()
    };

    let new_item = db::queries::NewItem {
        context_id,
        kind,
        title: parsed.title,
        body: parsed.body,
        status,
        waiting_on: parsed.waiting_on,
        followup_at: parsed.followup_at,
        due_at: None,
        ticket_ref: parsed.ticket_ref,
        url: parsed.url,
        source: "capture".to_string(),
        origin_app,
        tags: parsed.tags,
    };

    let item = db::queries::insert_item(&conn, &new_item).map_err(|e| e.to_string())?;
    let _ = app.emit("item-created", &item.id);

    // Destroy capture window on complete
    capture::close_capture_window(&app);

    serde_json::to_string(&item).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_capture_window_cmd(app: tauri::AppHandle) -> Result<(), String> {
    capture::open_capture_window(app).await
}

#[tauri::command]
async fn close_capture_window_cmd(app: tauri::AppHandle) {
    capture::close_capture_window(&app);
}

#[tauri::command]
async fn open_main_window_cmd(app: tauri::AppHandle) -> Result<(), String> {
    capture::open_main_window(app).await
}

#[tauri::command]
async fn close_main_window_cmd(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.destroy();
    }
}

#[tauri::command]
fn get_active_app() -> Option<String> {
    active_app::get_foreground_window_title()
}

// ── Application Entry Point ──────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let msg = format!("{info}");
        eprintln!("PANIC: {msg}");
        if let Ok(dir) = std::env::current_dir() {
            let path = dir.join("crash.log");
            let _ = std::fs::write(path, &msg);
        }
        default_hook(info);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            } else {
                let h = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = capture::open_main_window(h).await;
                });
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .on_window_event(|window, event| {
            // When user closes any window, explicitly destroy it so WebView2 frees memory
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let _ = window.destroy();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_today_items,
            get_inbox_items,
            create_item,
            update_item,
            search_items,
            parse_notepad_text,
            import_items,
            get_contexts,
            create_context,
            get_done_items,
            get_review_items,
            save_capture,
            open_capture_window_cmd,
            close_capture_window_cmd,
            open_main_window_cmd,
            close_main_window_cmd,
            get_active_app,
        ])
        .setup(|app| {
            // 1. Initialize SQLite database
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("notas-fup.db");
            let conn = db::init(&db_path)?;
            app.manage(Mutex::new(conn));

            // 2. Setup System Tray
            if let Err(e) = tray::setup_tray(app.handle()) {
                eprintln!("Tray setup error: {e}");
            }

            // 3. Register global shortcut (Ctrl+Alt+N)
            if let Err(e) = capture::register_global_shortcut(app.handle(), "Ctrl+Alt+N") {
                eprintln!("Global shortcut registration error: {e}");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
