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

interface StatusData {
  overall: 'operational' | 'degraded' | 'outage';
  services: ServiceStatus[];
  sparkline: SparklinePoint[];
  incidents: Incident[];
  generated_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 10 * 60; // 10 minutes in seconds

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  if (status === 'operational') return 'emerald';
  if (status === 'degraded') return 'amber';
  return 'rose';
}

function statusLabel(status: string) {
  if (status === 'operational') return 'Sprawny';
  if (status === 'degraded') return 'Spowolniony';
  return 'Awaria';
}

function statusDot(status: string) {
  if (status === 'operational') return 'bg-emerald-500';
  if (status === 'degraded') return 'bg-amber-400';
  return 'bg-rose-500';
}

function statusBarColor(status: string) {
  if (status === 'operational') return '#10b981';
  if (status === 'degraded') return '#f59e0b';
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
  const d = new Date(iso);
  return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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

// Build a 90-day array with every day filled (most recent last)
function build90Days(history: DayHistory[]): Array<{ day: string; status: string; avg_ms: number | null }> {
  const map: Record<string, DayHistory> = {};
  for (const h of history) {
    const key = h.day.slice(0, 10); // YYYY-MM-DD
    map[key] = h;
  }
  const days: Array<{ day: string; status: string; avg_ms: number | null }> = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({
      day: key,
      status: map[key]?.status ?? 'operational',
      avg_ms: map[key]?.avg_ms ?? null,
    });
  }
  return days;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UptimeBars({ history }: { history: DayHistory[] }) {
  const [tooltip, setTooltip] = useState<{ idx: number; text: string } | null>(null);
  const days = build90Days(history);

  return (
    <div className="relative">
      <div className="flex gap-[2px] items-end h-8">
        {days.map((d, idx) => (
          <div
            key={d.day}
            className="flex-1 rounded-[1px] cursor-default transition-opacity duration-150 hover:opacity-80"
            style={{ height: '100%', backgroundColor: statusBarColor(d.status) }}
            onMouseEnter={() => setTooltip({
              idx,
              text: `${formatDateShort(d.day)} — ${statusLabel(d.status)}${d.avg_ms ? ` (${d.avg_ms}ms)` : ''}`,
            })}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </div>
      {tooltip && (
        <div
          className="absolute bottom-10 pointer-events-none z-50 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-white whitespace-nowrap"
          style={{
            left: `${(tooltip.idx / 90) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          {tooltip.text}
        </div>
      )}
      <div className="flex justify-between text-xs text-zinc-500 mt-1">
        <span>90 dni temu</span>
        <span>Dziś</span>
      </div>
    </div>
  );
}

function SparklineChart({ data }: { data: SparklinePoint[] }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
        Brak danych o czasie odpowiedzi
      </div>
    );
  }

  const maxMs = Math.max(...data.map(d => d.avg_ms), 1);
  const minMs = Math.min(...data.map(d => d.avg_ms));
  const range = maxMs - minMs || 1;
  const W = 600;
  const H = 80;
  const PAD = 8;

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + ((maxMs - d.avg_ms) / range) * (H - PAD * 2);
    return { x, y, ms: d.avg_ms, hour: d.hour };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${H} L ${points[0].x.toFixed(1)} ${H} Z`;

  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-24"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hovered === i ? 4 : 2.5}
            fill={hovered === i ? '#818cf8' : '#6366f1'}
            className="cursor-pointer transition-all duration-100"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
      </svg>
      {hovered !== null && points[hovered] && (
        <div
          className="absolute pointer-events-none z-10 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-white whitespace-nowrap"
          style={{
            bottom: '100%',
            left: `${(points[hovered].x / W) * 100}%`,
            transform: 'translateX(-50%)',
            marginBottom: 4,
          }}
        >
          {formatTime(points[hovered].hour)} — {points[hovered].ms}ms
        </div>
      )}
      <div className="flex justify-between text-xs text-zinc-500 mt-1 px-1">
        <span>24h temu</span>
        <span>Teraz</span>
      </div>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceStatus }) {
  const color = statusColor(service.status);
  const borderClass =
    color === 'emerald'
      ? 'border-emerald-500/20 hover:border-emerald-500/40'
      : color === 'amber'
      ? 'border-amber-400/20 hover:border-amber-400/40'
      : 'border-rose-500/20 hover:border-rose-500/40';

  const glowClass =
    color === 'emerald'
      ? 'shadow-emerald-500/5'
      : color === 'amber'
      ? 'shadow-amber-400/5'
      : 'shadow-rose-500/5';

  const badgeBg =
    color === 'emerald'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : color === 'amber'
      ? 'bg-amber-400/10 text-amber-400 border-amber-400/20'
      : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

  return (
    <div
      className={`relative rounded-xl border bg-zinc-900/60 backdrop-blur-sm p-5 transition-all duration-300 shadow-lg ${borderClass} ${glowClass}`}
    >
      {/* Service header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-base">{service.name}</h3>
          <p className="text-zinc-400 text-xs mt-0.5">{service.description}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${badgeBg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot(service.status)} ${service.status === 'operational' ? 'animate-pulse' : ''}`} />
          {statusLabel(service.status)}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 mb-4">
        <div>
          <p className="text-zinc-500 text-xs">Dostępność (90d)</p>
          <p className="text-white font-bold text-lg">{service.uptime_90d.toFixed(2)}%</p>
        </div>
        {service.response_ms !== null && (
          <div>
            <p className="text-zinc-500 text-xs">Czas odpowiedzi</p>
            <p className="text-white font-bold text-lg">{service.response_ms}ms</p>
          </div>
        )}
        {service.last_check && (
          <div className="ml-auto text-right">
            <p className="text-zinc-500 text-xs">Ostatni test</p>
            <p className="text-zinc-300 text-sm">{formatDateTime(service.last_check)}</p>
          </div>
        )}
      </div>

      {/* 90-day uptime bars */}
      <UptimeBars history={service.history} />
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
    investigating: 'Badamy',
    identified:    'Zidentyfikowano',
    monitoring:    'Monitorujemy',
    resolved:      'Rozwiązano',
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The main app sets overflow:hidden on body (to prevent chat scrollbars).
  // Reset it for this standalone page so the status page can scroll normally.
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

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchStatus();
    const refreshTimer = setInterval(fetchStatus, REFRESH_INTERVAL * 1000);
    return () => clearInterval(refreshTimer);
  }, [fetchStatus]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) return REFRESH_INTERVAL;
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const overallConfig = {
    operational: {
      bg: 'from-emerald-950/80 via-emerald-900/40 to-transparent',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      glow: 'shadow-emerald-500/10',
      title: 'Wszystkie systemy działają prawidłowo',
      icon: '✓',
      iconBg: 'bg-emerald-500/20 border-emerald-500/40',
    },
    degraded: {
      bg: 'from-amber-950/80 via-amber-900/40 to-transparent',
      border: 'border-amber-400/30',
      text: 'text-amber-400',
      glow: 'shadow-amber-400/10',
      title: 'Spowolnienie usług',
      icon: '⚠',
      iconBg: 'bg-amber-400/20 border-amber-400/40',
    },
    outage: {
      bg: 'from-rose-950/80 via-rose-900/40 to-transparent',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      glow: 'shadow-rose-500/10',
      title: 'Awaria systemu',
      icon: '✗',
      iconBg: 'bg-rose-500/20 border-rose-500/40',
    },
  };

  const overall = data?.overall ?? 'operational';
  const cfg = overallConfig[overall];
  const incidentGroups = data ? groupIncidentsByDate(data.incidents) : {};
  const hasIncidents = data && data.incidents.length > 0;

  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = countdown % 60;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* ── Top bar ── */}
      <nav className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow shrink-0">
              <img src="/cordyn.png" alt="Cordyn" className="w-full h-full object-contain"/>
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">Cordyn</span>
              <span className="text-zinc-500 text-sm ml-2">/ Status</span>
            </div>
          </a>
          <a
            href="/"
            className="text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Wróć do aplikacji
          </a>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        {/* ── Hero banner ── */}
        {!loading && (
          <div className={`relative rounded-2xl border bg-gradient-to-b ${cfg.bg} ${cfg.border} p-8 shadow-2xl ${cfg.glow} overflow-hidden`}>
            {/* Decorative glow blob */}
            <div
              className={`absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-10 blur-3xl ${
                overall === 'operational' ? 'bg-emerald-400' : overall === 'degraded' ? 'bg-amber-400' : 'bg-rose-500'
              }`}
            />
            <div className="relative flex items-center gap-5">
              <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl ${cfg.iconBg}`}>
                <span className={cfg.text}>{cfg.icon}</span>
              </div>
              <div>
                <h1 className={`text-2xl font-bold ${cfg.text}`}>{cfg.title}</h1>
                {data && (
                  <p className="text-zinc-400 text-sm mt-1">
                    Ostatnia aktualizacja:{' '}
                    <span className="text-zinc-300">{formatDateTime(data.generated_at)}</span>
                    {' · '}
                    <span className="text-zinc-400">
                      Odświeżenie za{' '}
                      <span className="text-zinc-200 font-mono">
                        {countdownMin > 0 ? `${countdownMin}m ` : ''}
                        {countdownSec.toString().padStart(2, '0')}s
                      </span>
                    </span>
                    {' · '}
                    <button
                      onClick={fetchStatus}
                      className="text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Odśwież teraz
                    </button>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <p className="text-zinc-400 text-sm">Pobieranie statusu usług…</p>
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-5 text-rose-400">
            <p className="font-medium">Nie udało się pobrać danych</p>
            <p className="text-sm text-rose-400/70 mt-1">{error}</p>
            <button
              onClick={fetchStatus}
              className="mt-3 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-sm transition-colors"
            >
              Spróbuj ponownie
            </button>
          </div>
        )}

        {data && (
          <>
            {/* ── Services grid ── */}
            <section>
              <h2 className="text-zinc-300 font-semibold text-sm uppercase tracking-wider mb-4">
                Usługi
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.services.map(service => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            </section>

            {/* ── API Response Time chart ── */}
            <section>
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 backdrop-blur-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-white font-semibold">Czas odpowiedzi API</h2>
                    <p className="text-zinc-400 text-xs mt-0.5">Ostatnie 24 godziny (avg. na godzinę)</p>
                  </div>
                  {data.sparkline.length > 0 && (
                    <span className="text-indigo-400 font-mono text-sm">
                      {data.sparkline[data.sparkline.length - 1]?.avg_ms}ms
                    </span>
                  )}
                </div>
                <SparklineChart data={data.sparkline} />
              </div>
            </section>

            {/* ── Incidents ── */}
            <section>
              <h2 className="text-zinc-300 font-semibold text-sm uppercase tracking-wider mb-4">
                Incydenty (ostatnie 30 dni)
              </h2>

              {!hasIncidents ? (
                <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-zinc-300 font-medium">Brak incydentów</p>
                  <p className="text-zinc-500 text-sm mt-1">Żadnych awarii w ciągu ostatnich 30 dni.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(incidentGroups).map(([date, incidents]) => (
                    <div key={date}>
                      <h3 className="text-zinc-400 text-sm font-medium mb-3 flex items-center gap-2">
                        <span className="h-px flex-1 bg-zinc-800" />
                        {date}
                        <span className="h-px flex-1 bg-zinc-800" />
                      </h3>
                      <div className="space-y-3">
                        {incidents.map(inc => (
                          <div
                            key={inc.id}
                            className="rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-5"
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <h4 className="text-white font-medium">{inc.title}</h4>
                              <IncidentBadge status={inc.status} />
                            </div>

                            {inc.service && (
                              <p className="text-zinc-500 text-xs mb-3">
                                Dotyczy: <span className="text-zinc-400">{inc.service}</span>
                              </p>
                            )}

                            {inc.updates && inc.updates.length > 0 && (
                              <div className="border-l-2 border-zinc-700/60 ml-2 pl-4 space-y-3">
                                {inc.updates.map(update => (
                                  <div key={update.id}>
                                    <div className="flex items-center gap-2 mb-1">
                                      <IncidentBadge status={update.status} />
                                      <span className="text-zinc-500 text-xs">
                                        {formatDateTime(update.created_at)}
                                      </span>
                                    </div>
                                    <p className="text-zinc-300 text-sm">{update.message}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {inc.resolved_at && (
                              <p className="text-emerald-400/70 text-xs mt-3">
                                Rozwiązano: {formatDateTime(inc.resolved_at)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800/40 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <div className="w-5 h-5 rounded-md overflow-hidden shrink-0">
              <img src="/cordyn.png" alt="Cordyn" className="w-full h-full object-contain"/>
            </div>
            <span>Powered by Cordyn</span>
          </div>
          <a
            href="/"
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            Otwórz aplikację →
          </a>
        </div>
      </footer>
    </div>
  );
}
