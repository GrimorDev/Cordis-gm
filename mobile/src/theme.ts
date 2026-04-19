export const C = {
  bg:          '#09090b',
  bgCard:      '#111118',
  bgElevated:  '#18181f',
  bgInput:     'rgba(255,255,255,0.05)',
  border:      'rgba(255,255,255,0.08)',
  borderFocus: 'rgba(99,102,241,0.5)',
  text:        '#ffffff',
  textSub:     '#a1a1aa',
  textMuted:   '#52525b',
  accent:      '#6366f1',
  accentDark:  '#4f46e5',
  danger:      '#ef4444',
  success:     '#22c55e',
  warning:     '#f59e0b',
  online:      '#22c55e',
  idle:        '#f59e0b',
  dnd:         '#ef4444',
  offline:     '#6b7280',
} as const;

export const STATUS_COLOR: Record<string, string> = {
  online:  C.online,
  idle:    C.idle,
  dnd:     C.dnd,
  offline: C.offline,
};
