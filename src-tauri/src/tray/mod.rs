use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

/// Initialize system tray with menu and left-click quick capture trigger.
pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let capture_i = MenuItem::with_id(app, "capture", "Captura rápida", true, None::<&str>)?;
    let open_i = MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&capture_i, &open_i, &quit_i])?;

    let icon = match app.default_window_icon() {
        Some(i) => i.clone(),
        None => {
            // Fallback: load icon from embedded bytes if needed
            return Err("default window icon not found".into());
        }
    };

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Notas FUP")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "capture" => {
                let _ = crate::capture::open_capture_window(app);
            }
            "open" => {
                let _ = crate::capture::open_main_window(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = crate::capture::open_capture_window(app);
            }
        })
        .build(app)?;

    Ok(())
}
