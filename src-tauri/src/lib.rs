use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

// ── WASAPI loopback state ────────────────────────────────────────────────────
struct LoopbackState(std::sync::Mutex<Option<std::sync::Arc<std::sync::atomic::AtomicBool>>>);

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

// ── WASAPI loopback capture (Windows only) ───────────────────────────────────

// AudioCaptureClient wraps a raw COM pointer (IUnknown / NonNull<c_void>) which
// Rust conservatively marks !Send.  We initialise MTA above, so cross-thread
// access is safe per COM rules — we just have to assert it ourselves.
//
// IMPORTANT: Rust 2021 closures use "precise field capture" — if you write
// `wrapper.0` inside a closure the compiler captures the *field* (type
// AudioCaptureClient: !Send), not the wrapper.  We therefore implement Deref /
// DerefMut so callers use `(*wrapper).method()` or implicit auto-deref, which
// counts as a *deref projection* (not a field projection) and causes the whole
// SendWrap<T> to be captured instead.
#[cfg(windows)]
struct SendWrap<T>(T);
#[cfg(windows)]
unsafe impl<T> Send for SendWrap<T> {}
#[cfg(windows)]
impl<T> std::ops::Deref for SendWrap<T> {
    type Target = T;
    fn deref(&self) -> &T { &self.0 }
}
#[cfg(windows)]
impl<T> std::ops::DerefMut for SendWrap<T> {
    fn deref_mut(&mut self) -> &mut T { &mut self.0 }
}

#[cfg(windows)]
#[tauri::command]
fn start_audio_loopback(
    app: tauri::AppHandle,
    state: tauri::State<LoopbackState>,
) -> Result<serde_json::Value, String> {
    use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
    use base64::Engine as _;

    wasapi::initialize_mta().map_err(|e| e.to_string())?;

    let device = wasapi::get_default_device(&wasapi::Direction::Render)
        .map_err(|e| e.to_string())?;
    let audio_client = device.get_iaudioclient().map_err(|e| e.to_string())?;
    let mix_format = audio_client.get_mixformat().map_err(|e| e.to_string())?;

    let sr = mix_format.get_samplespersec();
    let ch = mix_format.get_nchannels();
    let block_align = mix_format.get_blockalign() as usize;

    audio_client
        .initialize_client(
            &mix_format,
            0,
            &wasapi::Direction::Capture,
            &wasapi::ShareMode::Shared,
            true,
        )
        .map_err(|e| e.to_string())?;

    let capture_client = audio_client.get_audiocaptureclient().map_err(|e| e.to_string())?;
    audio_client.start_stream().map_err(|e| e.to_string())?;

    let stop_flag = Arc::new(AtomicBool::new(true));
    {
        let mut guard = state.0.lock().unwrap();
        *guard = Some(stop_flag.clone());
    }

    // Wrap in SendWrap so the COM pointer can cross the thread boundary (MTA is
    // multi-thread safe, Rust just can't prove it automatically).
    let capture_client = SendWrap(capture_client);

    let flag = stop_flag.clone();
    std::thread::spawn(move || {
        // Access via Deref (deref projection), NOT .0 (field projection).
        // Rust 2021 would capture .0 as AudioCaptureClient (!Send) with field
        // projection; deref projection captures the whole SendWrap<T> (Send).
        while flag.load(Ordering::Relaxed) {
            match capture_client.get_next_nbr_frames() {
                Ok(Some(n)) if n > 0 => {
                    let mut buffer = vec![0u8; n as usize * block_align];
                    if capture_client.read_from_device(n as usize, &mut buffer).is_ok() {
                        // Interpret raw bytes as f32 samples (already PCM f32 in mix format)
                        let raw_bytes: &[u8] = &buffer;
                        let b64 = base64::engine::general_purpose::STANDARD.encode(raw_bytes);
                        let _ = app.emit("audio_loopback_chunk", b64);
                    }
                }
                _ => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                }
            }
        }
    });

    Ok(serde_json::json!({ "sample_rate": sr, "channels": ch }))
}

#[cfg(not(windows))]
#[tauri::command]
fn start_audio_loopback(
    _app: tauri::AppHandle,
    _state: tauri::State<LoopbackState>,
) -> Result<serde_json::Value, String> {
    Err("Only on Windows".to_string())
}

#[tauri::command]
fn stop_audio_loopback(state: tauri::State<LoopbackState>) {
    use std::sync::atomic::Ordering;
    let guard = state.0.lock().unwrap();
    if let Some(flag) = guard.as_ref() {
        flag.store(false, Ordering::Relaxed);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(LoopbackState(std::sync::Mutex::new(None)))
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
            start_audio_loopback,
            stop_audio_loopback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
