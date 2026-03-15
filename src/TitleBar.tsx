/**
 * TitleBar — custom frameless window chrome for the Tauri desktop app.
 *
 * Only rendered when running inside Tauri (`window.__TAURI__` is present).
 * The `data-tauri-drag-region` attribute lets users drag the window by
 * clicking anywhere on the bar that is NOT a button.
 */
import type { CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function TitleBar() {
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
