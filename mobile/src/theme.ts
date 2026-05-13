export const C = {
  // ── Backgrounds ──────────────────────────────────────────────────────────────
  bg:           '#070709',
  bgCard:       '#0f0f16',
  bgElevated:   '#181824',
  bgInput:      'rgba(255,255,255,0.07)',
  bgGlass:      'rgba(255,255,255,0.05)',
  bgFloating:   '#0d0d18',        // Tab bar / floating overlays
  bgSurface:    '#141420',        // Slightly elevated surfaces
  bgHighlight:  'rgba(99,102,241,0.08)',  // Hover / pressed highlight

  // ── Borders ───────────────────────────────────────────────────────────────────
  border:       'rgba(255,255,255,0.08)',
  borderSubtle: 'rgba(255,255,255,0.05)',
  borderFocus:  'rgba(99,102,241,0.65)',
  borderAccent: 'rgba(99,102,241,0.28)',
  borderAccentStrong: 'rgba(99,102,241,0.5)',

  // ── Text ──────────────────────────────────────────────────────────────────────
  text:         '#f0f0f8',
  textSub:      '#9898b4',
  textMuted:    '#44445a',
  textPlaceholder: '#3a3a50',

  // ── Accent (Indigo) ───────────────────────────────────────────────────────────
  accent:       '#6366f1',
  accentLight:  '#818cf8',
  accentDark:   '#4f46e5',
  accentVibrant: '#7c3aed',       // Purple variant for gradients
  accentGlow:   'rgba(99,102,241,0.18)',
  accentGlowStrong: 'rgba(99,102,241,0.35)',
  accentMuted:  'rgba(99,102,241,0.12)',
  accentMutedStrong: 'rgba(99,102,241,0.22)',

  // ── Semantic ─────────────────────────────────────────────────────────────────
  danger:       '#ef4444',
  dangerMuted:  'rgba(239,68,68,0.15)',
  success:      '#22c55e',
  successMuted: 'rgba(34,197,94,0.15)',
  warning:      '#f59e0b',
  warningMuted: 'rgba(245,158,11,0.15)',

  // ── Status ───────────────────────────────────────────────────────────────────
  online:       '#22c55e',
  idle:         '#f59e0b',
  dnd:          '#ef4444',
  offline:      '#4b5563',

  // ── Shadows ──────────────────────────────────────────────────────────────────
  shadowDark:   '#000000',
  shadowAccent: '#6366f1',
} as const;

export const STATUS_COLOR: Record<string, string> = {
  online:  C.online,
  idle:    C.idle,
  dnd:     C.dnd,
  offline: C.offline,
};

/** @deprecated Use t.statusLabels from i18n instead (language-aware). */
export const STATUS_LABEL: Record<string, string> = {
  online:  'Online',
  idle:    'Idle',
  dnd:     'Do not disturb',
  offline: 'Offline',
};
