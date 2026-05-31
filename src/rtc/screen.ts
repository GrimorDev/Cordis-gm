// ─── Screen-share source abstraction ─────────────────────────────────────────
// Goal: a CUSTOM, cross-platform source picker (screen / window) instead of the
// inconsistent per-WebView behaviour (Windows WebView2 grabs the whole screen
// with no chooser). Strategy, built in increments:
//
//   1. listScreenSources(): native enumeration via the Tauri `list_screen_sources`
//      command (Rust xcap — Windows/Linux/macOS). Returns null when the native
//      command is unavailable (web, or before the Rust side ships) so callers
//      fall back to the browser's getDisplayMedia picker.
//   2. captureSourceStream(): native frame capture bridged to a <canvas> →
//      canvas.captureStream() (next increment). For now it falls back to
//      getDisplayMedia so nothing regresses.

import { captureScreen, type ScreenQuality } from '../webrtc';

export interface ScreenSource {
  id: string;
  name: string;
  kind: 'screen' | 'window';
  /** data: URL PNG thumbnail, if the native side provided one. */
  thumbnail?: string;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Native enumeration of shareable sources. Returns null when not available
 * (web / native command not yet shipped) → caller uses getDisplayMedia.
 */
export async function listScreenSources(): Promise<ScreenSource[] | null> {
  if (!isTauri) return null;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const list = await invoke<ScreenSource[]>('list_screen_sources');
    return Array.isArray(list) && list.length > 0 ? list : null;
  } catch {
    // Command not registered yet (older binary) → fall back.
    return null;
  }
}

/**
 * Capture a chosen source as a MediaStream.
 * Increment 1: native streaming not wired yet → use getDisplayMedia. Once the
 * Rust frame bridge lands, this routes the selected source's frames through a
 * <canvas> + captureStream(). The signature is already source-aware so callers
 * don't change again.
 */
export async function captureSourceStream(
  _source: ScreenSource | null,
  quality: ScreenQuality,
): Promise<MediaStream> {
  // TODO(increment 2): if (_source && isTauri) → native canvas-bridge capture.
  return captureScreen(quality);
}
