use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle,
};

static SHOULD_EXIT: AtomicBool = AtomicBool::new(false);

/// Returns true only if the user explicitly clicked "Sair" in the tray menu.
pub fn should_exit() -> bool {
    SHOULD_EXIT.load(Ordering::SeqCst)
}

/// Request a real exit of the application process.
pub fn request_exit(app: &AppHandle) {
    SHOULD_EXIT.store(true, Ordering::SeqCst);
    app.exit(0);
}

/// Initialize system tray with menu and left-click quick capture trigger.
pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let capture_i = MenuItem::with_id(app, "capture", "Captura rápida", true, None::<&str>)?;
    let open_i = MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&capture_i, &open_i, &quit_i])?;

    let icon = match tauri::image::Image::from_bytes(include_bytes!("../../icons/32x32.png")) {
        Ok(img) => img,
        Err(_) => match app.default_window_icon() {
            Some(i) => i.clone(),
            None => return Err("default window icon not found".into()),
        },
    };

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip("Notas FUP")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "capture" => {
                let h = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::capture::open_capture_window(h).await;
                });
            }
            "open" => {
                let h = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::capture::open_main_window(h).await;
                });
            }
            "quit" => {
                request_exit(app);
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
                let h = tray.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::capture::open_capture_window(h).await;
                });
            }
        })
        .build(app)?;

    Ok(())
}
