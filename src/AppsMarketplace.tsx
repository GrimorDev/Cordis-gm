/**
 * Cordyn Apps — public bot marketplace
 * Route: /apps
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { appsApi, devApi, PublicApp, MyServer } from './developer/developerApi';

// ===== ICONS =====
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const BotIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

const ServerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const VerifiedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#4ade80" stroke="none">
    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

// ===== ADD TO SERVER MODAL =====
interface AddModalProps {
  app: PublicApp;
  onClose: () => void;
}

function AddToServerModal({ app, onClose }: AddModalProps) {
  const [servers, setServers] = useState<MyServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  useEffect(() => {
    devApi.getMyServers()
      .then(setServers)
      .catch((err) => {
        if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
          setNotLoggedIn(true);
        } else {
          setError('Nie udało się załadować serwerów');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (serverId: string) => {
    setAdding(serverId);
    setError('');
    try {
      await devApi.addBotToServer(app.client_id, serverId);
      setDone(prev => new Set([...prev, serverId]));
    } catch (err: any) {
      setError(err.message || 'Błąd dodawania bota');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 20,
    }}>
      <div style={{
        background: '#18181b', border: '1px solid #27272a', borderRadius: 16,
        width: '100%', maxWidth: 480, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Modal header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #27272a' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f4f4f5' }}>
              Dodaj do serwera
            </h3>
            <button onClick={onClose} style={{ padding: 6, background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
              <XIcon />
            </button>
          </div>
          {/* Bot info row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#09090b', borderRadius: 10 }}>
            {app.bot_avatar ? (
              <img src={app.bot_avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff', fontSize: 16 }}>
                {app.name[0]}
              </div>
            )}
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f4f4f5' }}>
                {app.name}
                <span style={{ marginLeft: 6, fontSize: 11, padding: '1px 5px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4, color: '#818cf8' }}>BOT</span>
              </div>
              <div style={{ fontSize: 12, color: '#71717a' }}>@{app.bot_username} · {app.server_count} serwerów</div>
            </div>
          </div>
        </div>

        {/* Server list */}
        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {notLoggedIn ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ color: '#71717a', fontSize: 14, marginBottom: 16 }}>
                Musisz być zalogowany, aby dodać bota do serwera.
              </p>
              <a
                href="/"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#6366f1', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}
              >
                Zaloguj się
              </a>
            </div>
          ) : loading ? (
            <p style={{ color: '#52525b', fontSize: 13 }}>Ładowanie serwerów...</p>
          ) : servers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <p style={{ color: '#71717a', fontSize: 13, marginBottom: 0 }}>
                Nie jesteś właścicielem ani adminem żadnego serwera.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: '#71717a' }}>
                Wybierz serwer, do którego chcesz dodać bota:
              </p>
              {servers.map(server => {
                const isDone = done.has(server.id);
                const isAdding = adding === server.id;
                return (
                  <div key={server.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', background: '#09090b',
                    border: `1px solid ${isDone ? 'rgba(74,222,128,0.3)' : '#27272a'}`,
                    borderRadius: 10, transition: 'border-color 0.2s',
                  }}>
                    {server.icon_url ? (
                      <img src={server.icon_url} alt={server.name} style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                        {server.name[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</div>
                      <div style={{ fontSize: 11, color: '#71717a' }}>{server.member_count} członków · {server.role_name}</div>
                    </div>
                    {isDone ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4ade80', fontWeight: 600, flexShrink: 0 }}>
                        <CheckIcon /> Dodano!
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(server.id)}
                        disabled={isAdding || !!adding}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '6px 14px', background: '#6366f1', color: '#fff',
                          border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          cursor: (isAdding || (!!adding && !isAdding)) ? 'not-allowed' : 'pointer',
                          opacity: (isAdding || (!!adding && !isAdding)) ? 0.6 : 1,
                          flexShrink: 0,
                        }}
                      >
                        {isAdding ? 'Dodawanie...' : 'Dodaj'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== BOT CARD =====
interface BotCardProps {
  app: PublicApp;
  onAddClick: (app: PublicApp) => void;
}

function BotCard({ app, onAddClick }: BotCardProps) {
  return (
    <div style={{
      background: '#111113',
      border: '1px solid #1c1c1f',
      borderRadius: 14,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      transition: 'border-color 0.2s, transform 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.35)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#1c1c1f'; }}
    >
      {/* Bot avatar + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {app.bot_avatar ? (
          <img src={app.bot_avatar} alt="" style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: '#fff',
          }}>
            {app.name[0]}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>{app.name}</span>
            {app.is_verified && (
              <span title="Zweryfikowana aplikacja" style={{ flexShrink: 0 }}><VerifiedIcon /></span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>@{app.bot_username}</div>
        </div>
      </div>

      {/* Description */}
      <p style={{
        margin: 0, fontSize: 13, color: '#a1a1aa', lineHeight: 1.6,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any,
        overflow: 'hidden',
        minHeight: 60,
      }}>
        {app.description || 'Brak opisu.'}
      </p>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#52525b' }}>
          <ServerIcon />
          {app.server_count} {app.server_count === 1 ? 'serwer' : 'serwerów'}
        </span>
        <button
          onClick={() => onAddClick(app)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', background: '#6366f1', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#4f46e5')}
          onMouseLeave={e => (e.currentTarget.style.background = '#6366f1')}
        >
          Dodaj do serwera
        </button>
      </div>
    </div>
  );
}

// ===== MAIN PAGE =====
export default function AppsMarketplace() {
  const [apps, setApps] = useState<PublicApp[]>([]);
  const [filtered, setFiltered] = useState<PublicApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<PublicApp | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await appsApi.list();
      setApps(list);
      setFiltered(list);
    } catch {
      /* ignore — empty list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    const q = search.trim().toLowerCase();
    if (!q) {
      setFiltered(apps);
      return;
    }
    searchRef.current = setTimeout(() => {
      setFiltered(apps.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q) ||
        a.bot_username.toLowerCase().includes(q)
      ));
    }, 200);
  }, [search, apps]);

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #18181b',
        background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15, color: '#fff' }}>
              C
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#f4f4f5' }}>Cordyn</span>
            <span style={{ color: '#27272a', fontSize: 18, margin: '0 2px' }}>/</span>
            <span style={{ fontSize: 14, color: '#71717a', fontWeight: 500 }}>Apps</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href="/developer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#71717a', textDecoration: 'none', padding: '6px 12px', border: '1px solid #27272a', borderRadius: 8 }}
            >
              Portal deweloperów
            </a>
            <a
              href="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#71717a', textDecoration: 'none', padding: '6px 12px', border: '1px solid #27272a', borderRadius: 8 }}
            >
              <ExternalLinkIcon /> Aplikacja
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(99,102,241,0.08) 0%, transparent 100%)',
        borderBottom: '1px solid #18181b',
        padding: '48px 24px 40px',
        textAlign: 'center',
      }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60, borderRadius: 18, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', marginBottom: 16 }}>
          <BotIcon />
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: 30, fontWeight: 800, color: '#f4f4f5', letterSpacing: '-0.5px' }}>
          Cordyn Apps
        </h1>
        <p style={{ margin: '0 0 28px', fontSize: 16, color: '#71717a', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          Odkryj boty i aplikacje rozszerzające możliwości Twoich serwerów. Dodaj je jednym kliknięciem.
        </p>

        {/* Search */}
        <div style={{ maxWidth: 440, margin: '0 auto', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#52525b', pointerEvents: 'none' }}>
            <SearchIcon />
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj botów..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#18181b', border: '1px solid #3f3f46',
              borderRadius: 10, padding: '11px 14px 11px 42px',
              fontSize: 14, color: '#f4f4f5', outline: 'none',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.target.style.borderColor = '#6366f1')}
            onBlur={e => (e.target.style.borderColor = '#3f3f46')}
          />
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>
        {/* Stats bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, color: '#71717a' }}>
            {loading ? 'Ładowanie...' : (
              <>
                <span style={{ color: '#f4f4f5', fontWeight: 600 }}>{filtered.length}</span>
                {search ? ` wyników dla "${search}"` : ` dostępnych ${filtered.length === 1 ? 'bota' : filtered.length < 5 ? 'boty' : 'botów'}`}
              </>
            )}
          </div>
          {!loading && apps.length === 0 && (
            <div style={{ fontSize: 12, color: '#52525b' }}>
              Brak publicznych aplikacji. Bądź pierwszy!{' '}
              <a href="/developer" style={{ color: '#818cf8', textDecoration: 'none' }}>Opublikuj swojego bota</a>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ background: '#111113', border: '1px solid #1c1c1f', borderRadius: 14, padding: 20, height: 200, opacity: 0.4 + i * 0.1 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: '#27272a' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ width: '60%', height: 14, background: '#27272a', borderRadius: 4, marginBottom: 6 }} />
                    <div style={{ width: '40%', height: 11, background: '#27272a', borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ width: '100%', height: 11, background: '#27272a', borderRadius: 4, marginBottom: 6 }} />
                <div style={{ width: '80%', height: 11, background: '#27272a', borderRadius: 4 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.2 }}>
              <BotIcon />
            </div>
            <p style={{ fontSize: 16, color: '#52525b', margin: '0 0 8px' }}>
              {search ? `Brak wyników dla "${search}"` : 'Brak dostępnych aplikacji'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ padding: '6px 14px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 8, color: '#a1a1aa', cursor: 'pointer', fontSize: 13 }}
              >
                Wyczyść wyszukiwanie
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(app => (
              <BotCard key={app.client_id} app={app} onAddClick={setSelectedApp} />
            ))}
          </div>
        )}

        {/* CTA for developers */}
        {!loading && (
          <div style={{
            marginTop: 64, padding: '32px 40px', textAlign: 'center',
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 16,
          }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#f4f4f5' }}>
              Tworzysz bota?
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a' }}>
              Opublikuj go w Cordyn Apps i dotrzyj do tysięcy użytkowników. Portal deweloperów daje Ci pełną kontrolę nad API i tokenami.
            </p>
            <a
              href="/developer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', background: '#6366f1', color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
            >
              Otwórz Portal Deweloperów
            </a>
          </div>
        )}
      </div>

      {/* Add to server modal */}
      {selectedApp && (
        <AddToServerModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        @media (max-width: 640px) {
          h1 { font-size: 22px !important; }
        }
      `}</style>
    </div>
  );
}
