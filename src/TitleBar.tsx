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
import React from 'react';
import type { CSSProperties } from 'react';
import { invoke } from '@tauri-apps/api/core';

// Detect macOS at module level (navigator.platform is deprecated but widely
// supported and does not require an async Tauri plugin call).
const isMacOS =
  typeof navigator !== 'undefined' &&
  (/Mac/i.test(navigator.platform) || navigator.userAgent.includes('Mac OS'));

// Shared hover state hook for traffic-light dots
function useDotHover() {
  const [hover, setHover] = React.useState(false);
  return { hover, onMouseEnter: () => setHover(true), onMouseLeave: () => setHover(false) };
}

export function TitleBar() {
  const [groupHover, setGroupHover] = React.useState(false);

  // ── macOS ────────────────────────────────────────────────────────────────
  // `decorations: false` in tauri.conf.json removes native traffic lights on macOS.
  // We render custom macOS-style dots (close/minimize/fullscreen) on the left.
  if (isMacOS) {
    const dot = (
      cmd: string,
      bg: string,
      symbol: string,
      title: string,
    ) => (
      <button
        title={title}
        onClick={(e) => { e.stopPropagation(); invoke(cmd).catch(() => {}); }}
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          backgroundColor: bg,
          border: 'none',
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          WebkitAppRegion: 'no-drag' as CSSProperties['WebkitAppRegion'],
          fontSize: 7,
          color: 'rgba(0,0,0,0.6)',
          fontWeight: 900,
          lineHeight: 1,
          transition: 'filter 0.1s',
          padding: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.85)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.filter = ''; }}
      >
        {groupHover ? symbol : ''}
      </button>
    );

    return (
      <div
        data-tauri-drag-region
        onMouseEnter={() => setGroupHover(true)}
        onMouseLeave={() => setGroupHover(false)}
        style={{
          height: 32,
          minHeight: 32,
          background: '#090912',
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          WebkitAppRegion: 'drag' as CSSProperties['WebkitAppRegion'],
          userSelect: 'none',
          paddingLeft: 12,
          paddingRight: 12,
          gap: 0,
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* Traffic lights — left side (macOS convention) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' as CSSProperties['WebkitAppRegion'] }}>
          {dot('window_close',    '#ff5f57', '✕', 'Zamknij')}
          {dot('window_minimize', '#ffbd2e', '−', 'Minimalizuj')}
          {dot('window_maximize', '#28c840', '⛶', 'Pełny ekran')}
        </div>

        {/* Centered app name */}
        <span
          style={{
            color: '#475569',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
          }}
        >
          Cordyn
        </span>

        {/* Help + Blog buttons (macOS right side) */}
        <div style={{ display: 'flex', gap: 4, WebkitAppRegion: 'no-drag' as CSSProperties['WebkitAppRegion'] }}>
          <button title="Centrum pomocy" onClick={() => openExternalLink('https://cordyn.pl/support')}
            style={{ width: 26, height: 26, borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
          <button title="Co nowego" onClick={() => openExternalLink('https://cordyn.pl/blog')}
            style={{ width: 26, height: 26, borderRadius: 7, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'color 0.15s, background 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </button>
        </div>
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

      {/* Help + Blog + Window controls — not draggable */}
      <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag' as CSSProperties['WebkitAppRegion'] }}>
        <button title="Centrum pomocy" onClick={() => openExternalLink('https://cordyn.pl/support')}
          style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>
        <button title="Co nowego" onClick={() => openExternalLink('https://cordyn.pl/blog')}
          style={{ width: 32, height: 32, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', transition: 'color 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#475569'; }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
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
