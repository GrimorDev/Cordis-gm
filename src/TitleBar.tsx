/**
 * TitleBar — custom frameless window chrome for the Tauri desktop app.
 *
 * Only rendered when running inside Tauri (`window.__TAURI_INTERNALS__` is present).
 *
 * macOS:  titleBarStyle "Overlay" gives native traffic lights (red/yellow/green).
 *         We render a thin drag region with left padding so content clears the
 *         traffic lights — NO custom window control buttons.
 *
 * Windows / Linux: full custom titlebar with minimize / maximize / close buttons
 *         positioned on the right side (Windows convention).
 *
 * The `data-tauri-drag-region` attribute lets users drag the window by clicking
 * anywhere on the bar that is NOT a button.
 */
import type { CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Detect macOS at module level (navigator.platform is deprecated but widely
// supported and does not require an async Tauri plugin call).
const isMacOS =
  typeof navigator !== 'undefined' &&
  (/Mac/i.test(navigator.platform) || navigator.userAgent.includes('Mac OS'));

export function TitleBar() {
  // ── macOS ────────────────────────────────────────────────────────────────
  // Native traffic-light buttons are shown by Tauri at the top-left.
  // We only need a drag region + right-side label. No custom control buttons.
  if (isMacOS) {
    return (
      <div
        data-tauri-drag-region
        style={{
          height: 28,
          minHeight: 28,
          background: '#0a0a14',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          // The whole bar is draggable; buttons inside override this.
          WebkitAppRegion: 'drag' as CSSProperties['WebkitAppRegion'],
          userSelect: 'none',
          // Traffic lights occupy roughly the first 75 px on the left.
          paddingLeft: 80,
        }}
      >
        <span
          style={{
            color: '#475569',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Cordyn
        </span>
      </div>
    );
  }

  // ── Windows / Linux ───────────────────────────────────────────────────────
  const btn = (
    label: string,
    title: string,
    cmd: string,
    hoverColor: string,
  ) => (
    <button
      title={title}
      onClick={() => invoke(cmd).catch(() => {})}
      style={{
        width: 46,
        height: 32,
        background: 'transparent',
        border: 'none',
        color: '#94a3b8',
        fontSize: 14,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = hoverColor;
        (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8';
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      data-tauri-drag-region
      style={{
        height: 32,
        minHeight: 32,
        background: '#0a0a14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        WebkitAppRegion: 'drag' as CSSProperties['WebkitAppRegion'],
        userSelect: 'none',
      }}
    >
      {/* App name / logo area */}
      <span
        style={{
          color: '#475569',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          paddingLeft: 12,
          textTransform: 'uppercase',
        }}
      >
        Cordyn
      </span>

      {/* Window control buttons — not draggable */}
      <div
        style={{ display: 'flex', WebkitAppRegion: 'no-drag' as CSSProperties['WebkitAppRegion'] }}
      >
        {btn('─', 'Minimize', 'window_minimize', '#1e293b')}
        {btn('□', 'Maximize / Restore', 'window_maximize', '#1e293b')}
        {btn('✕', 'Close', 'window_close', '#7f1d1d')}
      </div>
    </div>
  );
}

// Re-export a helper so App.tsx can conditionally render without importing
// @tauri-apps/api on web builds (dynamic import keeps it tree-shaken).
export const isTauri =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Open a URL in the system browser.
 * In Tauri: uses @tauri-apps/plugin-shell so the OS browser opens the link.
 * On web: uses window.open with _blank.
 */
export function openExternalLink(url: string): void {
  if (isTauri) {
    import('@tauri-apps/plugin-shell').then(({ open }) => open(url)).catch(() => {
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
