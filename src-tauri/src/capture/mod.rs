pub mod syntax;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Open the fast, frameless, on-demand quick capture window.
pub fn open_capture_window(app: &AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        "capture",
        WebviewUrl::default(),
    )
    .title("Captura Rápida")
    .inner_size(640.0, 200.0)
    .decorations(false)
    .always_on_top(true)
    .center()
    .resizable(false)
    .skip_taskbar(true)
    .shadow(true)
    .devtools(cfg!(debug_assertions))
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Close and destroy the capture window so no WebView2 remains in memory.
pub fn close_capture_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.destroy();
    }
}

/// Open the full main application window on demand.
pub fn open_main_window(app: &AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(
        app,
        "main",
        WebviewUrl::default(),
    )
    .title("Notas FUP")
    .inner_size(980.0, 700.0)
    .min_inner_size(700.0, 480.0)
    .decorations(true)
    .center()
    .resizable(true)
    .devtools(cfg!(debug_assertions))
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Register the default or configured global shortcut (e.g. "Ctrl+Alt+N").
pub fn register_global_shortcut(app: &AppHandle, shortcut_str: &str) -> Result<(), String> {
    let shortcut: Shortcut = shortcut_str.parse().map_err(|e| format!("{e:?}"))?;

    let app_handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = open_capture_window(&app_handle);
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}
