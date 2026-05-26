// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // ── Linux: set WebKitGTK env vars BEFORE GTK initialises (must be first) ──
    // Placing this in run() is too late — GTK may already have forked the
    // renderer process before set_var takes effect.  main() is the earliest
    // safe point.  WEBKIT_DISABLE_SANDBOX=1 lets the renderer process open
    // /dev/snd and /dev/video* (mic/camera).  Do NOT disable DMABUF here —
    // that forces software rendering which makes the whole app lag badly.
    #[cfg(target_os = "linux")]
    {
        // Allow renderer access to audio/video hardware
        std::env::set_var("WEBKIT_DISABLE_SANDBOX", "1");
        std::env::set_var("WEBKIT_FORCE_SANDBOX", "0");
        // Keep DMABUF enabled — hardware accelerated rendering (no lag)
        // Only disable it if you see GPU driver crashes: WEBKIT_DISABLE_DMABUF_RENDERER=1
    }
    app_lib::run();
}
