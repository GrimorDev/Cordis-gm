use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

/// Minimize the calling window.
#[tauri::command]
fn window_minimize(window: tauri::Window) {
    let _ = window.minimize();
}

/// Toggle maximise / restore on the calling window.
#[tauri::command]
fn window_maximize(window: tauri::Window) {
    if window.is_maximized().unwrap_or(false) {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
}

/// Hide window to tray (called by title-bar X button).
#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.hide();
}

/// Fully quit the application (called from tray menu "Zamknij").
#[tauri::command]
fn window_quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // ── System tray ─────────────────────────────────────────────────
            let show_i = MenuItem::with_id(app, "show", "Pokaż Cordyn", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Zamknij", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Cordyn")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.unminimize();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
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
                        if let Some(win) = app.get_webview_window("main") {
                            if win.is_visible().unwrap_or(false) {
                                let _ = win.set_focus();
                            } else {
                                let _ = win.show();
                                let _ = win.unminimize();
                                let _ = win.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // ── Close → hide to tray (nie zamykaj, tylko chowaj) ───────────
            let app_handle = app.handle().clone();
            let main_window = app.get_webview_window("main").unwrap();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    if let Some(win) = app_handle.get_webview_window("main") {
                        let _ = win.hide();
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_maximize,
            window_close,
            window_quit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
