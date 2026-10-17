pub mod db;
pub mod parser;
pub mod capture;
pub mod tray;
pub mod config;
pub mod active_app;
pub mod sync;

use anyhow::Result;
use std::sync::Mutex;
use tauri::Manager;

/// Tauri commands exposed to the frontend.
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
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    item_json: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let new_item: db::queries::NewItem =
        serde_json::from_str(&item_json).map_err(|e| e.to_string())?;
    let item = db::queries::insert_item(&conn, &new_item).map_err(|e| e.to_string())?;
    serde_json::to_string(&item).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_item(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    item_json: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let update: db::queries::UpdateItem =
        serde_json::from_str(&item_json).map_err(|e| e.to_string())?;
    let item = db::queries::update_item(&conn, &update).map_err(|e| e.to_string())?;
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
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    items_json: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let proposed: Vec<parser::ProposedItem> =
        serde_json::from_str(&items_json).map_err(|e| e.to_string())?;
    let imported = db::queries::import_proposed_items(&conn, &proposed)
        .map_err(|e| e.to_string())?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install panic hook to log crashes
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
            // Focus existing main window if it exists
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
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
        ])
        .setup(|app| {
            // Initialize database
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir)?;
            let db_path = app_dir.join("notas-fup.db");
            let conn = db::init(&db_path)?;
            app.manage(Mutex::new(conn));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
