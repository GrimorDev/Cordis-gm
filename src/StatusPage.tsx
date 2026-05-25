import { useState, useEffect, useCallback, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

interface DayHistory {
  day: string;
  status: string;
  avg_ms: number | null;
  checks: number;
}

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  status: 'operational' | 'degraded' | 'outage';
  response_ms: number | null;
  uptime_90d: number;
  last_check: string | null;
  history: DayHistory[];
}

interface IncidentUpdate {
  id: string;
  status: string;
  message: string;
  created_at: string;
}

interface Incident {
  id: string;
  title: string;
  service: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  updates: IncidentUpdate[] | null;
}

interface SparklinePoint {
  hour: string;
  avg_ms: number;
}

interface PlatformStatus {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'outage';
}

interface VoiceRegion {
  id: string;
  name: string;
  flag: string;
  status: 'operational' | 'degraded' | 'outage';
  latency_ms: number | null;
}

interface StatusData {
  overall: 'operational' | 'degraded' | 'outage';
  services: ServiceStatus[];
  sparkline: SparklinePoint[];
  incidents: Incident[];
  generated_at: string;
  platforms?: PlatformStatus[];
  regions?: VoiceRegion[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 10 * 60;

const DEFAULT_PLATFORMS: PlatformStatus[] = [
  { id: 'web',     name: 'Web',           status: 'operational' },
  { id: 'windows', name: 'Desktop Win',   status: 'operational' },
  { id: 'macos',   name: 'Desktop Mac',   status: 'operational' },
  { id: 'linux',   name: 'Desktop Linux', status: 'operational' },
  { id: 'android', name: 'Android',       status: 'operational' },
  { id: 'ios',     name: 'iOS',           status: 'operational' },
];

const DEFAULT_REGIONS: VoiceRegion[] = [
  { id: 'warsaw',    name: 'Warszawa',   flag: '🇵🇱', status: 'operational', latency_ms: 12  },
  { id: 'frankfurt', name: 'Frankfurt',  flag: '🇩🇪', status: 'operational', latency_ms: 28  },
  { id: 'amsterdam', name: 'Amsterdam',  flag: '🇳🇱', status: 'operational', latency_ms: 34  },
  { id: 'london',    name: 'Londyn',     flag: '🇬🇧', status: 'operational', latency_ms: 45  },
  { id: 'paris',     name: 'Paryż',      flag: '🇫🇷', status: 'operational', latency_ms: 39  },
  { id: 'stockholm', name: 'Sztokholm',  flag: '🇸🇪', status: 'operational', latency_ms: 52  },
  { id: 'us-east',   name: 'US East',    flag: '🇺🇸', status: 'operational', latency_ms: 110 },
  { id: 'us-west',   name: 'US West',    flag: '🇺🇸', status: 'operational', latency_ms: 148 },
  { id: 'brazil',    name: 'Brazylia',   flag: '🇧🇷', status: 'operational', latency_ms: 210 },
  { id: 'singapore', name: 'Singapur',   flag: '🇸🇬', status: 'operational', latency_ms: 175 },
  { id: 'japan',     name: 'Japonia',    flag: '🇯🇵', status: 'operational', latency_ms: 190 },
  { id: 'australia', name: 'Australia',  flag: '🇦🇺', status: 'operational', latency_ms: 230 },
];

// Service grouping — matches IDs/keywords from the API
const SERVICE_GROUPS: { label: string; icon: string; color: string; ids: string[] }[] = [
  { label: 'Rdzeń',         icon: 'core',    color: '#6366f1', ids: ['api', 'gateway', 'auth', 'websocket', 'realtime'] },
  { label: 'Głos i media',  icon: 'voice',   color: '#0ea5e9', ids: ['voice', 'video', 'media', 'streaming', 'stream', 'screen'] },
  { label: 'Dostarczanie',  icon: 'cdn',     color: '#10b981', ids: ['cdn', 'storage', 'upload', 'assets', 'files'] },
  { label: 'Powiadomienia', icon: 'push',    color: '#f59e0b', ids: ['push', 'notif', 'email', 'sms'] },
  { label: 'Infrastruktura',icon: 'infra',   color: '#8b5cf6', ids: ['db', 'database', 'redis', 'cache', 'queue'] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === 'operational') return 'emerald';
  if (s === 'degraded')    return 'amber';
  return 'rose';
}
function statusLabel(s: string) {
  if (s === 'operational') return 'Sprawny';
  if (s === 'degraded')    return 'Spowolniony';
  return 'Awaria';
}
function statusDot(s: string) {
  if (s === 'operational') return 'bg-emerald-500';
  if (s === 'degraded')    return 'bg-amber-400';
  return 'bg-rose-500';
}
function statusBarColor(s: string) {
  if (s === 'operational') return '#10b981';
  if (s === 'degraded')    return '#f59e0b';
  return '#f43f5e';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit' });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function groupIncidentsByDate(incidents: Incident[]): Record<string, Incident[]> {
  const groups: Record<string, Incident[]> = {};
  for (const inc of incidents) {
    const key = formatDate(inc.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(inc);
  }
  return groups;
}

function build90Days(history: DayHistory[]) {
  const map: Record<string, DayHistory> = {};
  for (const h of history) map[h.day.slice(0, 10)] = h;
  const days: Array<{ day: string; status: string; avg_ms: number | null }> = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ day: key, status: map[key]?.status ?? 'operational', avg_ms: map[key]?.avg_ms ?? null });
  }
  return days;
}

function groupServices(services: ServiceStatus[]) {
  const grouped: Record<string, ServiceStatus[]> = {};
  const used = new Set<string>();

  for (const group of SERVICE_GROUPS) {
    const matched = services.filter(s => {
      const idLower = s.id.toLowerCase();
      const nameLower = s.name.toLowerCase();
      return group.ids.some(kw => idLower.includes(kw) || nameLower.includes(kw));
    });
    if (matched.length > 0) {
      grouped[group.label] = matched;
      matched.forEach(s => used.add(s.id));
    }
  }

  const rest = services.filter(s => !used.has(s.id));
  if (rest.length > 0) grouped['Pozostałe'] = rest;

  return grouped;
}

// ── Platform Icons ───────────────────────────────────────────────────────────

function PlatformIcon({ id, size = 20 }: { id: string; size?: number }) {
  const s = size;
  if (id === 'web') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
  if (id === 'windows') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5.5L10.5 4.5V11.5H3V5.5ZM3 12.5H10.5V19.5L3 18.5V12.5ZM11.5 4.3L21 3V11.5H11.5V4.3ZM11.5 12.5H21V21L11.5 19.7V12.5Z"/>
    </svg>
  );
  if (id === 'macos') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.15-2.18 1.27-2.16 3.8.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.73M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  );
  if (id === 'linux') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );
  if (id === 'android') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.523 15.344l1.046-1.812a.329.329 0 0 0-.119-.449.328.328 0 0 0-.449.12l-1.06 1.836A6.923 6.923 0 0 0 12 14.13a6.92 6.92 0 0 0-2.942.709l-1.06-1.836a.329.329 0 0 0-.449-.12.33.33 0 0 0-.12.449l1.046 1.812C6.6 16.426 5.372 18.17 5.25 20.25h13.5c-.122-2.08-1.35-3.824-3.227-4.906zM9.75 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zm4.5 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM12 3.75c3.728 0 6.75 3.022 6.75 6.75 0 .828-.15 1.621-.422 2.357A8.04 8.04 0 0 0 12 11.25a8.04 8.04 0 0 0-6.328 1.607A6.718 6.718 0 0 1 5.25 10.5C5.25 6.772 8.272 3.75 12 3.75zm-2.25-2.25a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5H12v.75h-.75V2.25A.75.75 0 0 1 9.75 1.5z"/>
    </svg>
  );
  if (id === 'ios') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 1.5H7A2.5 2.5 0 0 0 4.5 4v16A2.5 2.5 0 0 0 7 22.5h10a2.5 2.5 0 0 0 2.5-2.5V4A2.5 2.5 0 0 0 17 1.5zm-5 18a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5-3H7V5h10z"/>
    </svg>
  );
  return null;
}

function ServiceGroupIcon({ icon, color, size = 18 }: { icon: string; color: string; size?: number }) {
  const s = size;
  if (icon === 'core') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
  if (icon === 'voice') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
  if (icon === 'cdn') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  );
  if (icon === 'push') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
  if (icon === 'infra') return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UptimeBars({ history }: { history: DayHistory[] }) {
  const [tooltip, setTooltip] = useState<{ idx: number; text: string } | null>(null);
  const days = build90Days(history);
  return (
    <div className="relative">
      <div className="flex gap-[2px] items-end h-6">
        {days.map((d, idx) => (
          <div
            key={d.day}
            className="flex-1 rounded-[1px] cursor-default transition-opacity duration-150 hover:opacity-70"
            style={{ height: '100%', backgroundColor: statusBarColor(d.status) }}
            onMouseEnter={() => setTooltip({ idx, text: `${formatDateShort(d.day)} — ${statusLabel(d.status)}${d.avg_ms ? ` (${d.avg_ms}ms)` : ''}` })}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </div>
      {tooltip && (
        <div
          className="absolute bottom-8 pointer-events-none z-50 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-white whitespace-nowrap"
          style={{ left: `${(tooltip.idx / 90) * 100}%`, transform: 'translateX(-50%)' }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="flex justify-between text-xs text-zinc-600 mt-1">
        <span>90 dni temu</span>
        <span>Dziś</span>
      </div>
    </div>
  );
}

function SparklineChart({ data }: { data: SparklinePoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  if (!data || data.length < 2) {
    return <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">Brak danych o czasie odpowiedzi</div>;
  }
  const maxMs = Math.max(...data.map(d => d.avg_ms), 1);
  const minMs = Math.min(...data.map(d => d.avg_ms));
  const range = maxMs - minMs || 1;
  const W = 600; const H = 80; const PAD = 8;
  const points = data.map((d, i) => ({
    x: PAD + (i / (data.length - 1)) * (W - PAD * 2),
    y: PAD + ((maxMs - d.avg_ms) / range) * (H - PAD * 2),
    ms: d.avg_ms, hour: d.hour,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${H} L ${points[0].x.toFixed(1)} ${H} Z`;
  return (
    <div className="relative w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0"/>
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)"/>
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hovered === i ? 4 : 2.5}
            fill={hovered === i ? '#818cf8' : '#6366f1'}
            className="cursor-pointer transition-all duration-100"
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {hovered !== null && points[hovered] && (
        <div className="absolute pointer-events-none z-10 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-white whitespace-nowrap"
          style={{ bottom: '100%', left: `${(points[hovered].x / W) * 100}%`, transform: 'translateX(-50%)', marginBottom: 4 }}
        >
          {formatTime(points[hovered].hour)} — {points[hovered].ms}ms
        </div>
      )}
      <div className="flex justify-between text-xs text-zinc-600 mt-1 px-1">
        <span>24h temu</span><span>Teraz</span>
      </div>
    </div>
  );
}

function ServiceRow({ service }: { service: ServiceStatus }) {
  const color = statusColor(service.status);
  const badgeBg = color === 'emerald'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : color === 'amber'
    ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  return (
    <div className="group py-3 px-4 rounded-lg hover:bg-zinc-800/40 transition-colors duration-150">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="min-w-0">
          <span className="text-white text-sm font-medium">{service.name}</span>
          <span className="text-zinc-500 text-xs ml-2 hidden sm:inline">{service.description}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {service.response_ms !== null && (
            <span className="text-zinc-500 text-xs font-mono">{service.response_ms}ms</span>
          )}
          <span className="text-zinc-400 text-xs hidden md:block">{service.uptime_90d.toFixed(2)}%</span>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${badgeBg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot(service.status)} ${service.status === 'operational' ? 'animate-pulse' : ''}`}/>
            {statusLabel(service.status)}
          </div>
        </div>
      </div>
      <UptimeBars history={service.history}/>
    </div>
  );
}

function PlatformCard({ platform }: { platform: PlatformStatus }) {
  const color = statusColor(platform.status);
  const ringColor = color === 'emerald' ? 'ring-emerald-500/20' : color === 'amber' ? 'ring-amber-400/20' : 'ring-rose-500/20';
  const iconColor = color === 'emerald' ? '#10b981' : color === 'amber' ? '#f59e0b' : '#f43f5e';
  const dotColor = color === 'emerald' ? '#10b981' : color === 'amber' ? '#f59e0b' : '#f43f5e';

  return (
    <div className={`flex flex-col items-center gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60 ring-1 ${ringColor} hover:bg-zinc-800/60 transition-colors duration-150`}>
      <div style={{ color: iconColor }}>
        <PlatformIcon id={platform.id} size={22}/>
      </div>
      <span className="text-zinc-300 text-xs font-medium text-center leading-tight">{platform.name}</span>
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }}/>
        <span className="text-xs" style={{ color: dotColor }}>{statusLabel(platform.status)}</span>
      </div>
    </div>
  );
}

function VoiceRegionRow({ region }: { region: VoiceRegion }) {
  const color = statusColor(region.status);
  const dotClass = color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-400' : 'bg-rose-500';
  const latencyColor = region.latency_ms === null ? '#52525b'
    : region.latency_ms < 50 ? '#10b981'
    : region.latency_ms < 120 ? '#f59e0b'
    : '#f43f5e';

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/40 transition-colors duration-150 group">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-base leading-none">{region.flag}</span>
        <span className="text-zinc-300 text-sm">{region.name}</span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {region.latency_ms !== null && (
          <span className="text-xs font-mono" style={{ color: latencyColor }}>{region.latency_ms}ms</span>
        )}
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${dotClass} ${region.status === 'operational' ? 'animate-pulse' : ''}`}/>
          <span className={`text-xs hidden sm:block ${color === 'emerald' ? 'text-emerald-400' : color === 'amber' ? 'text-amber-400' : 'text-rose-400'}`}>
            {statusLabel(region.status)}
          </span>
        </div>
      </div>
    </div>
  );
}

function IncidentBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    investigating: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    identified:    'bg-amber-400/10 text-amber-400 border-amber-400/20',
    monitoring:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
    resolved:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  const labels: Record<string, string> = {
    investigating: 'Badamy', identified: 'Zidentyfikowano', monitoring: 'Monitorujemy', resolved: 'Rozwiązano',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${cfg[status] ?? 'bg-zinc-700/30 text-zinc-400 border-zinc-600'}`}>
      {labels[status] ?? status}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: StatusData = await res.json();
      setData(json);
      setCountdown(REFRESH_INTERVAL);
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania danych');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, REFRESH_INTERVAL * 1000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(prev => prev <= 1 ? REFRESH_INTERVAL : prev - 1);
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const overall = data?.overall ?? 'operational';

  const overallConfig = {
    operational: {
      bg: 'from-emerald-950/70 via-emerald-900/30 to-transparent',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      glow: 'bg-emerald-400',
      title: 'Wszystkie systemy działają prawidłowo',
      iconBg: 'bg-emerald-500/20 border-emerald-500/40',
      icon: (
        <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
        </svg>
      ),
    },
    degraded: {
      bg: 'from-amber-950/70 via-amber-900/30 to-transparent',
      border: 'border-amber-400/30',
      text: 'text-amber-400',
      glow: 'bg-amber-400',
      title: 'Spowolnienie usług',
      iconBg: 'bg-amber-400/20 border-amber-400/40',
      icon: (
        <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        </svg>
      ),
    },
    outage: {
      bg: 'from-rose-950/70 via-rose-900/30 to-transparent',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      glow: 'bg-rose-500',
      title: 'Awaria systemu',
      iconBg: 'bg-rose-500/20 border-rose-500/40',
      icon: (
        <svg className="w-7 h-7 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
        </svg>
      ),
    },
  };

  const cfg = overallConfig[overall];
  const incidentGroups = data ? groupIncidentsByDate(data.incidents) : {};
  const hasIncidents = data && data.incidents.length > 0;
  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = countdown % 60;

  const platforms = data?.platforms ?? DEFAULT_PLATFORMS.map(p => ({
    ...p, status: overall === 'outage' ? 'outage' as const : overall === 'degraded' ? ('degraded' as const) : p.status,
  }));
  const allRegions = data?.regions ?? DEFAULT_REGIONS;
  const visibleRegions = showAllRegions ? allRegions : allRegions.slice(0, 6);

  const serviceGroups = data ? groupServices(data.services) : {};
  const serviceGroupKeys = Object.keys(serviceGroups);

  // Overall stats
  const totalServices = data?.services.length ?? 0;
  const operationalCount = data?.services.filter(s => s.status === 'operational').length ?? 0;
  const avgUptime = data && data.services.length > 0
    ? (data.services.reduce((acc, s) => acc + s.uptime_90d, 0) / data.services.length).toFixed(2)
    : '100.00';

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* ── Top bar ── */}
      <nav className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow shrink-0">
              <img src="/cordyn.png" alt="Cordyn" className="w-full h-full object-contain"/>
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">Cordyn</span>
              <span className="text-zinc-500 text-sm ml-2">/ Status</span>
            </div>
          </a>
          <div className="flex items-center gap-4">
            {data && (
              <span className="text-zinc-500 text-xs font-mono hidden sm:block">
                {countdownMin > 0 ? `${countdownMin}m ` : ''}{countdownSec.toString().padStart(2, '0')}s
              </span>
            )}
            <a href="/" className="text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Wróć do aplikacji
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"/>
              <p className="text-zinc-400 text-sm">Pobieranie statusu usług…</p>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 text-rose-400">
            <p className="font-medium">Nie udało się pobrać danych</p>
            <p className="text-sm text-rose-400/70 mt-1">{error}</p>
            <button onClick={fetchStatus} className="mt-3 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-sm transition-colors">
              Spróbuj ponownie
            </button>
          </div>
        )}

        {/* ── Hero banner ── */}
        {!loading && (
          <div className={`relative rounded-2xl border bg-gradient-to-b ${cfg.bg} ${cfg.border} p-8 shadow-2xl overflow-hidden`}>
            <div className={`absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-10 blur-3xl ${cfg.glow}`}/>
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${cfg.iconBg}`}>
                  {cfg.icon}
                </div>
                <div>
                  <h1 className={`text-2xl font-bold ${cfg.text}`}>{cfg.title}</h1>
                  {data && (
                    <p className="text-zinc-400 text-sm mt-1">
                      Aktualizacja: <span className="text-zinc-300">{formatDateTime(data.generated_at)}</span>
                      {' · '}
                      <button onClick={fetchStatus} className="text-indigo-400 hover:text-indigo-300 transition-colors">Odśwież</button>
                    </p>
                  )}
                </div>
              </div>

              {/* Quick stats */}
              {data && (
                <div className="flex gap-6 shrink-0">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{operationalCount}/{totalServices}</p>
                    <p className="text-zinc-500 text-xs">Usługi sprawne</p>
                  </div>
                  <div className="w-px bg-zinc-800"/>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{avgUptime}%</p>
                    <p className="text-zinc-500 text-xs">Avg dostępność</p>
                  </div>
                  <div className="w-px bg-zinc-800"/>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{allRegions.filter(r => r.status === 'operational').length}/{allRegions.length}</p>
                    <p className="text-zinc-500 text-xs">Regiony głosowe</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Platform status ── */}
        <section>
          <h2 className="text-zinc-400 font-semibold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Platformy
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {platforms.map(p => <PlatformCard key={p.id} platform={p}/>)}
          </div>
        </section>

        {/* ── Services grouped ── */}
        {data && serviceGroupKeys.length > 0 && (
          <section>
            <h2 className="text-zinc-400 font-semibold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Usługi
            </h2>
            <div className="space-y-3">
              {serviceGroupKeys.map(groupName => {
                const services = serviceGroups[groupName];
                const groupConfig = SERVICE_GROUPS.find(g => g.label === groupName);
                const groupStatus = services.some(s => s.status === 'outage') ? 'outage'
                  : services.some(s => s.status === 'degraded') ? 'degraded' : 'operational';
                const isExpanded = expandedGroup === groupName;
                const statusBadgeClass = groupStatus === 'operational'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : groupStatus === 'degraded'
                  ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

                return (
                  <div key={groupName} className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
                    {/* Group header */}
                    <button
                      onClick={() => setExpandedGroup(isExpanded ? null : groupName)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/40 transition-colors duration-150 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <ServiceGroupIcon icon={groupConfig?.icon ?? 'core'} color={groupConfig?.color ?? '#6366f1'} size={18}/>
                        <span className="text-white font-semibold text-sm">{groupName}</span>
                        <span className="text-zinc-500 text-xs">{services.length} {services.length === 1 ? 'usługa' : 'usługi'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${statusBadgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusDot(groupStatus)} ${groupStatus === 'operational' ? 'animate-pulse' : ''}`}/>
                          {statusLabel(groupStatus)}
                        </div>
                        <svg
                          className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                        </svg>
                      </div>
                    </button>

                    {/* Service rows */}
                    {isExpanded && (
                      <div className="border-t border-zinc-800/60 divide-y divide-zinc-800/40">
                        {services.map(s => <ServiceRow key={s.id} service={s}/>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Voice & Streaming ── */}
        <section>
          <h2 className="text-zinc-400 font-semibold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            </svg>
            Głos i Streaming
          </h2>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
            {/* Quick status row */}
            {[
              { label: 'Serwery głosowe', icon: '🎙️', status: overall },
              { label: 'Udostępnianie ekranu', icon: '🖥️', status: overall },
              { label: 'Wideo / Kamery', icon: '📹', status: overall },
              { label: 'Nagrywanie',  icon: '⏺️', status: overall === 'outage' ? 'degraded' as const : overall },
              { label: 'Live Stream', icon: '📡', status: overall },
              { label: 'Proxy mediów', icon: '🔀', status: overall },
            ].map((item, idx) => {
              const dotClass = statusDot(item.status);
              const textClass = item.status === 'operational' ? 'text-emerald-400' : item.status === 'degraded' ? 'text-amber-400' : 'text-rose-400';
              return (
                <div key={idx} className={`flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30 transition-colors ${idx < 5 ? 'border-b border-zinc-800/40' : ''}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-base leading-none">{item.icon}</span>
                    <span className="text-zinc-300 text-sm">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${dotClass} ${item.status === 'operational' ? 'animate-pulse' : ''}`}/>
                    <span className={`text-xs ${textClass}`}>{statusLabel(item.status)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Voice regions ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-zinc-400 font-semibold text-xs uppercase tracking-widest flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              Regiony głosowe
            </h2>
            <span className="text-zinc-500 text-xs">{allRegions.filter(r => r.status === 'operational').length}/{allRegions.length} sprawnych</span>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
            <div className="grid grid-cols-1 sm:grid-cols-2">
              {visibleRegions.map((region, idx) => {
                const isRight = idx % 2 === 1;
                const isLastRow = idx >= visibleRegions.length - (visibleRegions.length % 2 === 0 ? 2 : 1);
                return (
                  <div
                    key={region.id}
                    className={`${!isLastRow ? 'border-b border-zinc-800/40' : ''} ${isRight ? 'sm:border-l border-zinc-800/40' : ''}`}
                  >
                    <VoiceRegionRow region={region}/>
                  </div>
                );
              })}
            </div>
            {allRegions.length > 6 && (
              <button
                onClick={() => setShowAllRegions(!showAllRegions)}
                className="w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800/40 hover:bg-zinc-800/30"
              >
                {showAllRegions ? 'Zwiń ↑' : `Pokaż wszystkie (${allRegions.length}) ↓`}
              </button>
            )}
          </div>
        </section>

        {/* ── API Response Time chart ── */}
        {data && (
          <section>
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-white font-semibold text-sm">Czas odpowiedzi API</h2>
                  <p className="text-zinc-500 text-xs mt-0.5">Ostatnie 24h · średnia na godzinę</p>
                </div>
                {data.sparkline.length > 0 && (
                  <span className="text-indigo-400 font-mono text-sm">{data.sparkline[data.sparkline.length - 1]?.avg_ms}ms</span>
                )}
              </div>
              <SparklineChart data={data.sparkline}/>
            </div>
          </section>
        )}

        {/* ── Incidents ── */}
        <section>
          <h2 className="text-zinc-400 font-semibold text-xs uppercase tracking-widest mb-3 flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            </svg>
            Incydenty — ostatnie 30 dni
          </h2>

          {!hasIncidents ? (
            <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p className="text-zinc-300 font-medium">Brak incydentów</p>
              <p className="text-zinc-500 text-sm mt-1">Żadnych awarii w ciągu ostatnich 30 dni.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(incidentGroups).map(([date, incidents]) => (
                <div key={date}>
                  <h3 className="text-zinc-500 text-xs font-medium mb-3 flex items-center gap-2">
                    <span className="h-px flex-1 bg-zinc-800"/>{date}<span className="h-px flex-1 bg-zinc-800"/>
                  </h3>
                  <div className="space-y-3">
                    {incidents.map(inc => (
                      <div key={inc.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/50 p-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h4 className="text-white font-medium">{inc.title}</h4>
                          <IncidentBadge status={inc.status}/>
                        </div>
                        {inc.service && (
                          <p className="text-zinc-500 text-xs mb-3">Dotyczy: <span className="text-zinc-400">{inc.service}</span></p>
                        )}
                        {inc.updates && inc.updates.length > 0 && (
                          <div className="border-l-2 border-zinc-700/60 ml-2 pl-4 space-y-3">
                            {inc.updates.map(update => (
                              <div key={update.id}>
                                <div className="flex items-center gap-2 mb-1">
                                  <IncidentBadge status={update.status}/>
                                  <span className="text-zinc-500 text-xs">{formatDateTime(update.created_at)}</span>
                                </div>
                                <p className="text-zinc-300 text-sm">{update.message}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {inc.resolved_at && (
                          <p className="text-emerald-400/70 text-xs mt-3">Rozwiązano: {formatDateTime(inc.resolved_at)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800/40 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <div className="w-5 h-5 rounded-md overflow-hidden shrink-0">
              <img src="/cordyn.png" alt="Cordyn" className="w-full h-full object-contain"/>
            </div>
            <span>Powered by Cordyn</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-600">
            <span>{allRegions.length} regionów głosowych</span>
            <span>·</span>
            <span>Odświeżenie co 10 min</span>
            <span>·</span>
            <a href="/" className="hover:text-zinc-300 transition-colors">Otwórz aplikację →</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
