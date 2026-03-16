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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
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
            window_minimize,
            window_maximize,
            window_close
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
