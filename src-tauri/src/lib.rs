use tauri::Manager;

/// Closes the splash-screen window and shows the main app window.
/// Called from the frontend via `invoke('close_splashscreen')` once React
/// has finished its first render.
#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) {
    // Close the splash window (it may already be gone in dev hot-reload)
    if let Some(splash) = app.get_webview_window("splashscreen") {
        splash.close().unwrap_or(());
    }
    // Show the main window (it starts hidden so users don't see a blank frame)
    if let Some(main) = app.get_webview_window("main") {
        main.show().unwrap_or(());
        main.set_focus().unwrap_or(());
    }
}

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

/// Close the calling window (quits the app when the main window is closed).
#[tauri::command]
fn window_close(window: tauri::Window) {
    let _ = window.close();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            window_minimize,
            window_maximize,
            window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
