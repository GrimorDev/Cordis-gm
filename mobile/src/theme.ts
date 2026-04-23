export const C = {
  // Backgrounds
  bg:           '#070709',
  bgCard:       '#0f0f14',
  bgElevated:   '#161620',
  bgInput:      'rgba(255,255,255,0.06)',
  bgGlass:      'rgba(255,255,255,0.04)',

  // Borders
  border:       'rgba(255,255,255,0.07)',
  borderFocus:  'rgba(99,102,241,0.6)',
  borderAccent: 'rgba(99,102,241,0.25)',

  // Text
  text:         '#f4f4f8',
  textSub:      '#a0a0b0',
  textMuted:    '#4a4a60',

  // Accent (Indigo)
  accent:       '#6366f1',
  accentLight:  '#818cf8',
  accentDark:   '#4f46e5',
  accentGlow:   'rgba(99,102,241,0.18)',
  accentMuted:  'rgba(99,102,241,0.12)',

  // Semantic
  danger:       '#ef4444',
  dangerMuted:  'rgba(239,68,68,0.15)',
  success:      '#22c55e',
  successMuted: 'rgba(34,197,94,0.15)',
  warning:      '#f59e0b',
  warningMuted: 'rgba(245,158,11,0.15)',

  // Status
  online:       '#22c55e',
  idle:         '#f59e0b',
  dnd:          '#ef4444',
  offline:      '#4b5563',
} as const;

export const STATUS_COLOR: Record<string, string> = {
  online:  C.online,
  idle:    C.idle,
  dnd:     C.dnd,
  offline: C.offline,
};

export const STATUS_LABEL: Record<string, string> = {
  online:  'Online',
  idle:    'Bezczynny',
  dnd:     'Nie przeszkadzać',
  offline: 'Offline',
};
