import React, { useState, useEffect } from 'react';

interface AppInfo {
  client_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  is_verified: boolean;
  redirect_uris: string[];
  requested_scopes: string[];
}

interface ScopeInfo {
  id: string;
  label: string;
  description: string;
  icon: string;
  sensitive?: boolean;
}

const SCOPE_INFO: Record<string, ScopeInfo> = {
  identify: {
    id: 'identify',
    label: 'Podstawowe dane konta',
    description: 'Dostęp do Twojej nazwy użytkownika, avatara i ID konta',
    icon: '👤',
  },
  email: {
    id: 'email',
    label: 'Adres e-mail',
    description: 'Dostęp do Twojego adresu e-mail powiązanego z kontem',
    icon: '✉️',
    sensitive: true,
  },
  guilds: {
    id: 'guilds',
    label: 'Lista serwerów',
    description: 'Widok serwerów, do których należysz (bez dostępu do treści)',
    icon: '🏠',
  },
  'guilds.join': {
    id: 'guilds.join',
    label: 'Dołączanie do serwerów',
    description: 'Aplikacja może dołączyć Cię do serwera w Twoim imieniu',
    icon: '➕',
    sensitive: true,
  },
  bot: {
    id: 'bot',
    label: 'Instalacja bota',
    description: 'Dodanie bota aplikacji do wybranego przez Ciebie serwera',
    icon: '🤖',
  },
  'messages.read': {
    id: 'messages.read',
    label: 'Odczyt wiadomości',
    description: 'Aplikacja może odczytywać wiadomości z kanałów, do których masz dostęp',
    icon: '💬',
    sensitive: true,
  },
  connections: {
    id: 'connections',
    label: 'Powiązane konta',
    description: 'Dostęp do listy powiązanych kont zewnętrznych (np. GitHub, Twitter)',
    icon: '🔗',
  },
};

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

export default function OAuthConsent() {
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const scope = params.get('scope') || 'identify';
  const state = params.get('state') || '';
  const responseType = params.get('response_type') || 'code';

  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authorizing, setAuthorizing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const requestedScopes = scope.split(' ').filter(Boolean);

  useEffect(() => {
    const token =
      localStorage.getItem('cordyn_token') ||
      sessionStorage.getItem('cordyn_token');
    setIsLoggedIn(!!token);

    if (!clientId) {
      setError('Brakujący parametr client_id');
      setLoading(false);
      return;
    }

    const fetchAppInfo = async () => {
      try {
        const qs = new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          response_type: responseType,
          ...(state ? { state } : {}),
        });
        const token =
          localStorage.getItem('cordyn_token') ||
          sessionStorage.getItem('cordyn_token');
        const res = await fetch(`/api/oauth2/authorize?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        setAppInfo(data);
      } catch (err: any) {
        setError(err.message || 'Błąd ładowania informacji o aplikacji');
      } finally {
        setLoading(false);
      }
    };

    fetchAppInfo();
  }, [clientId]);

  const handleAuthorize = async () => {
    setAuthorizing(true);
    try {
      const token =
        localStorage.getItem('cordyn_token') ||
        sessionStorage.getItem('cordyn_token');
      const res = await fetch('/api/oauth2/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state,
          response_type: responseType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else if (data.code) {
        const url = new URL(redirectUri);
        url.searchParams.set('code', data.code);
        if (state) url.searchParams.set('state', state);
        window.location.href = url.toString();
      }
    } catch (err: any) {
      setError(err.message || 'Błąd autoryzacji');
      setAuthorizing(false);
    }
  };

  const handleDeny = () => {
    if (!redirectUri) {
      window.location.href = '/';
      return;
    }
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    url.searchParams.set('error_description', 'The user denied access');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#09090b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#f4f4f5',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    background: '#111113',
    border: '1px solid #1c1c1f',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
  };

  // Loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', color: '#52525b' }}>
          <div style={{ marginBottom: 12, animation: 'spin 1s linear infinite' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: 14 }}>Ładowanie...</p>
        </div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ padding: '28px 28px 0', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: '#fff', margin: '0 auto 16px' }}>
              C
            </div>
            <h1 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#f4f4f5' }}>
              Zaloguj się do Cordyn
            </h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#71717a', lineHeight: 1.5 }}>
              Musisz być zalogowany, żeby autoryzować dostęp dla aplikacji zewnętrznych.
            </p>
          </div>
          <div style={{ padding: '0 28px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href={`/?redirect=${encodeURIComponent(window.location.href)}`}
              style={{
                display: 'block', textAlign: 'center', padding: '10px 16px',
                background: '#6366f1', color: '#fff', borderRadius: 8,
                textDecoration: 'none', fontSize: 14, fontWeight: 600,
              }}
            >
              Zaloguj się
            </a>
            <button
              onClick={handleDeny}
              style={{
                padding: '10px 16px', background: 'transparent',
                border: '1px solid #27272a', borderRadius: 8, color: '#71717a',
                cursor: 'pointer', fontSize: 14,
              }}
            >
              Anuluj
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !appInfo) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ color: '#f87171', marginBottom: 12 }}>
              <AlertIcon />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#f4f4f5' }}>
              Błąd autoryzacji
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#71717a' }}>{error}</p>
            <a href="/" style={{
              display: 'inline-block', padding: '8px 20px',
              background: '#27272a', color: '#d4d4d8', borderRadius: 8,
              textDecoration: 'none', fontSize: 13,
            }}>
              Wróć do Cordyn
            </a>
          </div>
        </div>
      </div>
    );
  }

  const app = appInfo;
  const hasSensitiveScopes = requestedScopes.some(s => SCOPE_INFO[s]?.sensitive);

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* App header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid #1c1c1f', textAlign: 'center' }}>
          {app?.icon_url ? (
            <img src={app.icon_url} alt={app?.name} style={{ width: 60, height: 60, borderRadius: 14, margin: '0 auto 12px', display: 'block' }} />
          ) : (
            <div style={{
              width: 60, height: 60, borderRadius: 14, margin: '0 auto 12px',
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: '#fff',
            }}>
              {(app?.name || '?')[0].toUpperCase()}
            </div>
          )}
          <h1 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#f4f4f5' }}>
            {app?.name || clientId}
            {app?.is_verified && (
              <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle', color: '#4ade80' }}>
                <CheckIcon />
              </span>
            )}
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#71717a' }}>
            prosi o dostęp do Twojego konta Cordyn
          </p>
          {app?.description && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#52525b', fontStyle: 'italic' }}>
              {app.description}
            </p>
          )}
        </div>

        {/* Scopes */}
        <div style={{ padding: '20px 28px' }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Żądane uprawnienia
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {requestedScopes.map(scopeId => {
              const info = SCOPE_INFO[scopeId];
              if (!info) {
                return (
                  <div key={scopeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}>
                    <span style={{ fontSize: 18 }}>🔑</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#d4d4d8', fontFamily: 'monospace' }}>{scopeId}</div>
                      <div style={{ fontSize: 11, color: '#52525b' }}>Nieznany zakres uprawnień</div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={scopeId} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', background: '#18181b',
                  border: `1px solid ${info.sensitive ? 'rgba(234,179,8,0.15)' : '#27272a'}`,
                  borderRadius: 8,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{info.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>
                      {info.label}
                      {info.sensitive && (
                        <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 4, color: '#ca8a04' }}>
                          WRAŻLIWE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#71717a', marginTop: 2, lineHeight: 1.4 }}>{info.description}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {hasSensitiveScopes && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              marginTop: 12, padding: '10px 12px',
              background: 'rgba(234,179,8,0.06)',
              border: '1px solid rgba(234,179,8,0.2)',
              borderRadius: 8,
            }}>
              <span style={{ color: '#facc15', flexShrink: 0, marginTop: 1 }}><AlertIcon /></span>
              <p style={{ margin: 0, fontSize: 12, color: '#ca8a04', lineHeight: 1.5 }}>
                Ta aplikacja żąda wrażliwych uprawnień. Autoryzuj tylko jeśli ufasz tej aplikacji.
              </p>
            </div>
          )}
        </div>

        {/* Security note */}
        <div style={{ padding: '0 28px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#52525b' }}>
            <span style={{ color: '#3f3f46' }}><ShieldIcon /></span>
            Cordyn nigdy nie udostępni Twojego hasła aplikacjom zewnętrznym.
          </div>
        </div>

        {/* Redirect URI info */}
        {redirectUri && (
          <div style={{ padding: '0 28px 16px' }}>
            <div style={{ fontSize: 11, color: '#52525b' }}>
              Zostaniesz przekierowany do:{' '}
              <span style={{ fontFamily: 'monospace', color: '#3f3f46', wordBreak: 'break-all' }}>
                {redirectUri}
              </span>
            </div>
          </div>
        )}

        {/* Error in auth flow */}
        {error && (
          <div style={{ padding: '0 28px 16px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, color: '#f87171', fontSize: 13,
            }}>
              <AlertIcon /> {error}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ padding: '4px 28px 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleAuthorize}
            disabled={authorizing}
            style={{
              width: '100%', padding: '11px 16px',
              background: authorizing ? '#4f4fa0' : '#6366f1',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 700, cursor: authorizing ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {authorizing ? 'Autoryzuję...' : `Autoryzuj ${app?.name || 'aplikację'}`}
          </button>
          <button
            onClick={handleDeny}
            disabled={authorizing}
            style={{
              width: '100%', padding: '10px 16px',
              background: 'transparent',
              color: '#71717a', border: '1px solid #27272a', borderRadius: 8,
              fontSize: 14, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Odmów dostępu
          </button>
        </div>
      </div>

      {/* Footer */}
      <p style={{ marginTop: 20, fontSize: 12, color: '#3f3f46', textAlign: 'center' }}>
        <a href="/" style={{ color: '#52525b', textDecoration: 'none' }}>Cordyn</a>
        {' · '}
        <a href="/privacy" style={{ color: '#52525b', textDecoration: 'none' }}>Polityka prywatności</a>
        {' · '}
        <a href="/terms" style={{ color: '#52525b', textDecoration: 'none' }}>Warunki użytkowania</a>
      </p>

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:not(:disabled):hover { opacity: 0.88; }
      `}</style>
    </div>
  );
}
