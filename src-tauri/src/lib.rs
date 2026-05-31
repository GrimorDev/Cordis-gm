#[allow(unused_imports)]
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
    let mut audio_client = device.get_iaudioclient().map_err(|e| e.to_string())?;
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

/// Returns true when running on Linux (used by frontend to show Linux-specific hints).
#[tauri::command]
fn is_linux() -> bool {
    cfg!(target_os = "linux")
}

/// Returns true when running on Windows.
#[tauri::command]
fn is_windows() -> bool {
    cfg!(target_os = "windows")
}

/// Open Windows Privacy Settings for microphone access.
/// Uses the ms-settings: URI scheme which works on Windows 10/11.
#[cfg(target_os = "windows")]
#[tauri::command]
fn open_mic_privacy_settings() {
    let _ = std::process::Command::new("explorer.exe")
        .arg("ms-settings:privacy-microphone")
        .spawn();
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn open_mic_privacy_settings() {
    // no-op on non-Windows
}

/// Returns true when the process was launched as an AppImage ($APPIMAGE env var is set).
#[tauri::command]
fn is_appimage() -> bool {
    std::env::var("APPIMAGE").is_ok()
}

/// Install a .deb package using pkexec (graphical privilege escalation).
/// Shows a system authentication dialog — no terminal required.
/// Returns Ok(()) on success, Err with message on failure.
#[cfg(target_os = "linux")]
#[tauri::command]
fn install_deb_update(path: String) -> Result<(), String> {
    use std::process::Command;

    // Verify the file exists before attempting install
    if !std::path::Path::new(&path).exists() {
        return Err(format!("File not found: {}", path));
    }

    // Try pkexec first — shows a native GTK authentication dialog (no terminal)
    let result = Command::new("pkexec")
        .args(["dpkg", "-i", &path])
        .status();

    match result {
        Ok(status) if status.success() => {
            // Clean up the temp .deb file
            let _ = std::fs::remove_file(&path);
            Ok(())
        }
        Ok(status) => {
            Err(format!("dpkg failed with exit code: {:?}", status.code()))
        }
        Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => {
            // pkexec not available (minimal/non-GNOME distros) — try sudo as fallback
            let sudo_result = Command::new("sudo")
                .args(["-A", "dpkg", "-i", &path]) // -A = use askpass
                .status();
            match sudo_result {
                Ok(s) if s.success() => {
                    let _ = std::fs::remove_file(&path);
                    Ok(())
                }
                _ => Err(
                    "pkexec nie jest dostępny — zainstaluj ręcznie: sudo dpkg -i <plik>".to_string()
                ),
            }
        }
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
fn install_deb_update(_path: String) -> Result<(), String> {
    Err("Tylko na Linuxie".to_string())
}

/// Clear WebKitGTK's cached permission decisions for microphone/camera.
/// WebKitGTK stores permission grants/denials in its local storage database.
/// Deleting it forces fresh permission dialogs the next time getUserMedia is called.
/// After calling this, the caller should restart the app (via tauri-plugin-process).
#[tauri::command]
async fn reset_webkit_permissions(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    // WebKitGTK stores permission/storage data inside the app data dir.
    // Remove known WebKit data subdirectories to clear cached denials.
    let webkit_dirs = ["local_storage", "IndexedDB", "databases", "webappsstore.sqlite",
                       "cookies.sqlite", "storage", ".local_storage"];
    for dir in &webkit_dirs {
        let p = app_data.join(dir);
        if p.exists() {
            if p.is_dir() {
                let _ = std::fs::remove_dir_all(&p);
            } else {
                let _ = std::fs::remove_file(&p);
            }
        }
    }
    // Also try the WebKit2GTK data directory which can live next to the app data dir
    if let Some(parent) = app_data.parent() {
        for name in &["webkitgtk", "WebKitGTK"] {
            let p = parent.join(name);
            if p.exists() {
                let _ = std::fs::remove_dir_all(&p);
            }
        }
    }
    Ok(())
}

/// Request microphone + camera permissions (macOS system dialog, Linux WebKitGTK prompt).
/// Also enumerates devices so the settings page shows real device names.
#[tauri::command]
async fn request_media_permissions(window: tauri::WebviewWindow) -> Result<(), String> {
    let js = r#"
        (function() {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
            // Request audio first, then video — each triggers its own dialog on macOS/Linux
            navigator.mediaDevices.getUserMedia({ audio: true, video: false })
                .then(function(s){ s.getTracks().forEach(function(t){ t.stop(); }); return true; })
                .catch(function(){ return false; })
                .then(function() {
                    return navigator.mediaDevices.getUserMedia({ audio: false, video: true })
                        .then(function(s){ s.getTracks().forEach(function(t){ t.stop(); }); })
                        .catch(function(){});
                });
        })();
    "#;
    window.eval(js).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(LoopbackState(std::sync::Mutex::new(None)))
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Second launch attempt — bring existing window to front
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
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

            // ── Linux: auto-allow mic/camera/notification permission requests ──
            // WebKitGTK DENIES every getUserMedia call by default unless a
            // PermissionRequest handler explicitly calls allow().
            // WEBKIT_DISABLE_SANDBOX=1 (set in main.rs) lets the renderer
            // process open /dev/snd & /dev/video* but does NOT bypass the
            // WebKit permission gate — we must handle that here.
            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::{WebViewExt, PermissionRequestExt};
                use glib::prelude::ObjectExt;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.with_webview(|wv| {
                        let webview = wv.inner();
                        // WebKitGTK ships with WebRTC OFF by default → RTCPeerConnection
                        // is undefined on Linux (getUserMedia works but no peers form).
                        // settings() returns Option<Settings>; enable via glib property
                        // so it compiles regardless of the binding feature level (a no-op
                        // warning on libs that lack the property).
                        if let Some(settings) = WebViewExt::settings(&webview) {
                            settings.set_property("enable-webrtc", true);
                            settings.set_property("enable-media-stream", true);
                        }
                        webview.connect_permission_request(|_, req| {
                            req.allow();
                            true
                        });
                    });
                }
            }

            // ── Windows: auto-grant mic/camera so we can drop the fake-UI flag ──
            // Without --use-fake-ui-for-media-stream, WebView2 denies getUserMedia
            // unless we handle PermissionRequested. We auto-allow Microphone +
            // Camera here; getDisplayMedia then shows the NATIVE picker (choose
            // screen / window / tab) instead of grabbing the whole screen.
            #[cfg(target_os = "windows")]
            {
                use webview2_com::Microsoft::Web::WebView2::Win32::{
                    COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
                    COREWEBVIEW2_PERMISSION_KIND_CAMERA,
                    COREWEBVIEW2_PERMISSION_KIND_UNKNOWN_PERMISSION,
                    COREWEBVIEW2_PERMISSION_STATE_ALLOW,
                };
                use webview2_com::PermissionRequestedEventHandler;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.with_webview(|webview| unsafe {
                        if let Ok(core) = webview.controller().CoreWebView2() {
                            let handler = PermissionRequestedEventHandler::create(Box::new(
                                move |_sender, args| {
                                    if let Some(args) = args {
                                        let mut kind = COREWEBVIEW2_PERMISSION_KIND_UNKNOWN_PERMISSION;
                                        let _ = args.PermissionKind(&mut kind);
                                        if kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
                                            || kind == COREWEBVIEW2_PERMISSION_KIND_CAMERA
                                        {
                                            let _ = args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW);
                                        }
                                    }
                                    Ok(())
                                },
                            ));
                            let mut token = Default::default();
                            let _ = core.add_PermissionRequested(&handler, &mut token);
                        }
                    });
                }
            }

            // ── Close → hide to tray (nie zamykaj, tylko chowaj) ───────────
            let app_handle = app.handle().clone();
            let main_window = app.get_webview_window("main").unwrap();
            main_window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    // Persist window position/size/monitor before hiding to tray
                    use tauri_plugin_window_state::AppHandleExt;
                    let _ = app_handle.save_window_state(
                        tauri_plugin_window_state::StateFlags::all(),
                    );
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
            request_media_permissions,
            reset_webkit_permissions,
            is_linux,
            is_windows,
            is_appimage,
            install_deb_update,
            open_mic_privacy_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
