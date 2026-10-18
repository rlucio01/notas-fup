pub mod active_app;
pub mod capture;
pub mod config;
pub mod db;
pub mod parser;
pub mod sync;
pub mod tray;
pub mod notifications;

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
fn update_context(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: String,
    name: String,
    color: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let ctx = db::queries::update_context(&conn, &id, &name, &color).map_err(|e| e.to_string())?;
    let _ = app.emit("context-updated", &id);
    let _ = app.emit("item-updated", ());
    serde_json::to_string(&ctx).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_context(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: String,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::queries::delete_context(&conn, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("context-updated", &id);
    let _ = app.emit("item-updated", ());
    Ok(())
}

#[tauri::command]
fn add_attachment(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    item_id: String,
    filename: Option<String>,
    mime_type: String,
    data: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let attachment = db::queries::add_attachment(&conn, &item_id, filename.as_deref(), &mime_type, &data)
        .map_err(|e| e.to_string())?;
    let _ = app.emit("item-updated", &item_id);
    serde_json::to_string(&attachment).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_item_attachments(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    item_id: String,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let list = db::queries::get_item_attachments(&conn, &item_id).map_err(|e| e.to_string())?;
    serde_json::to_string(&list).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_attachment(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    id: String,
    item_id: Option<String>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::queries::delete_attachment(&conn, &id).map_err(|e| e.to_string())?;
    if let Some(ref iid) = item_id {
        let _ = app.emit("item-updated", iid);
    }
    Ok(())
}

#[tauri::command]
fn reorder_items(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    item_ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    db::queries::reorder_items(&conn, &item_ids).map_err(|e| e.to_string())?;
    let _ = app.emit("item-updated", ());
    Ok(())
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
fn sync_remote_items_cmd(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
    items_json: String,
) -> Result<usize, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let items: Vec<db::queries::Item> =
        serde_json::from_str(&items_json).map_err(|e| e.to_string())?;
    let count = db::queries::upsert_remote_items(&conn, &items).map_err(|e| e.to_string())?;
    if count > 0 {
        let _ = app.emit("item-updated", "remote-sync");
    }
    Ok(count)
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
fn get_followup_alerts(
    state: tauri::State<'_, Mutex<rusqlite::Connection>>,
) -> Result<String, String> {
    let conn = state.lock().map_err(|e| e.to_string())?;
    let alerts = db::queries::get_followup_alerts(&conn).map_err(|e| e.to_string())?;
    serde_json::to_string(&alerts).map_err(|e| e.to_string())
}

#[tauri::command]
fn trigger_followup_alerts(app: tauri::AppHandle) -> Result<usize, String> {
    notifications::check_and_send_followup_notifications(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn send_test_notification_cmd(app: tauri::AppHandle) -> Result<(), String> {
    notifications::send_test_notification(&app).map_err(|e| e.to_string())
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

#[tauri::command]
fn download_and_install_update(url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        let safe_url = url.replace('\'', "''");
        let ps_script = format!(
            "$temp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), 'NotasFUP_setup_update.exe'); \
             [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
             (New-Object System.Net.WebClient).DownloadFile('{safe_url}', $temp); \
             Start-Process $temp;"
        );

        Command::new("powershell")
            .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", &ps_script])
            .spawn()
            .map_err(|e| format!("Falha ao iniciar download da atualização: {e}"))?;

        Ok("Download iniciado e instalador em execução".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = url;
        Err("Atualização automática direta disponível apenas para Windows".to_string())
    }
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

    let app = tauri::Builder::default()
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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .on_window_event(|window, event| {
            // When user closes any window, explicitly destroy it so WebView2 frees memory
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
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
            update_context,
            delete_context,
            get_done_items,
            get_review_items,
            save_capture,
            open_capture_window_cmd,
            close_capture_window_cmd,
            open_main_window_cmd,
            close_main_window_cmd,
            get_active_app,
            add_attachment,
            get_item_attachments,
            delete_attachment,
            reorder_items,
            get_followup_alerts,
            trigger_followup_alerts,
            send_test_notification_cmd,
            sync_remote_items_cmd,
            download_and_install_update,
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

            // 4. Background check for follow-up alerts (runs on start and periodically)
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                let _ = notifications::check_and_send_followup_notifications(&app_handle);

                loop {
                    std::thread::sleep(std::time::Duration::from_secs(1800)); // Every 30 minutes
                    let _ = notifications::check_and_send_followup_notifications(&app_handle);
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            if !tray::should_exit() {
                api.prevent_exit();
            }
        }
    });
}
