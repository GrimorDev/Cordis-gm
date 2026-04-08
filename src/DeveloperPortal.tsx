import React, { useState, useEffect, useCallback, useRef } from 'react';
import { devApi, DevApplication, BotServer } from './developer/developerApi';

// ===== INLINE SVG ICONS =====
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const CodeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
  </svg>
);

const KeyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>
);

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const BotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/>
    <path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
);

const ServerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
    <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// ===== UTILITY =====
function useCopyToClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }, []);
  return { copy, copiedKey };
}

// ===== SUB-COMPONENTS =====

interface CopyButtonProps {
  text: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}

function CopyButton({ text, copyKey, copiedKey, onCopy }: CopyButtonProps) {
  const copied = copiedKey === copyKey;
  return (
    <button
      onClick={() => onCopy(text, copyKey)}
      title="Kopiuj"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        background: copied ? 'rgba(99,102,241,0.15)' : 'rgba(63,63,70,0.5)',
        border: `1px solid ${copied ? 'rgba(99,102,241,0.4)' : 'rgba(63,63,70,0.8)'}`,
        borderRadius: 6,
        color: copied ? '#818cf8' : '#a1a1aa',
        cursor: 'pointer',
        fontSize: 12,
        transition: 'all 0.15s',
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Skopiowano' : 'Kopiuj'}
    </button>
  );
}

interface SecretFieldProps {
  label: string;
  value: string;
  fieldKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  onRegenerate?: () => void;
  regenLabel?: string;
}

function SecretField({ label, value, fieldKey, copiedKey, onCopy, onRegenerate, regenLabel }: SecretFieldProps) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          flex: 1,
          fontFamily: 'monospace',
          fontSize: 13,
          background: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: 8,
          padding: '8px 12px',
          color: '#f4f4f5',
          letterSpacing: revealed ? 'normal' : '0.15em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {revealed ? value : '●'.repeat(Math.min(value.length, 40))}
        </div>
        <button
          onClick={() => setRevealed(r => !r)}
          title={revealed ? 'Ukryj' : 'Pokaż'}
          style={{
            padding: '8px 10px',
            background: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: 8,
            color: '#a1a1aa',
            cursor: 'pointer',
          }}
        >
          {revealed ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        {revealed && (
          <CopyButton text={value} copyKey={fieldKey} copiedKey={copiedKey} onCopy={onCopy} />
        )}
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 10px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              color: '#f87171',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            <RefreshIcon />
            {regenLabel || 'Regeneruj'}
          </button>
        )}
      </div>
    </div>
  );
}

// ===== MODALS =====
interface NewAppModalProps {
  onClose: () => void;
  onCreate: (name: string, desc: string) => Promise<void>;
}

function NewAppModal({ onClose, onCreate }: NewAppModalProps) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Nazwa jest wymagana'); return; }
    setLoading(true);
    setError('');
    try {
      await onCreate(name.trim(), desc.trim());
    } catch (err: any) {
      setError(err.message || 'Błąd tworzenia aplikacji');
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#18181b', border: '1px solid #27272a', borderRadius: 12,
        padding: 28, width: '100%', maxWidth: 440,
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#f4f4f5' }}>
          Nowa aplikacja
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
              NAZWA APLIKACJI *
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Moja aplikacja"
              autoFocus
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6 }}>
              OPIS
            </label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Krótki opis aplikacji..."
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
            />
          </div>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 16 }}>
              <AlertIcon /> {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Anuluj</button>
            <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Tworzenie...' : 'Utwórz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface SecretRevealModalProps {
  secret: string;
  title: string;
  message: string;
  onClose: () => void;
}

function SecretRevealModal({ secret, title, message, onClose }: SecretRevealModalProps) {
  const { copy, copiedKey } = useCopyToClipboard();
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16,
    }}>
      <div style={{
        background: '#18181b', border: '1px solid #27272a', borderRadius: 12,
        padding: 28, width: '100%', maxWidth: 480,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ padding: 8, background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, color: '#facc15' }}>
            <AlertIcon />
          </div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f4f4f5' }}>{title}</h2>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: '#a1a1aa', lineHeight: 1.5 }}>{message}</p>
        <div style={{
          fontFamily: 'monospace', fontSize: 13, background: '#09090b',
          border: '1px solid #3f3f46', borderRadius: 8, padding: '10px 12px',
          color: '#f4f4f5', wordBreak: 'break-all', marginBottom: 16,
        }}>
          {secret}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <CopyButton text={secret} copyKey="modal-secret" copiedKey={copiedKey} onCopy={copy} />
          <button onClick={onClose} style={btnPrimary}>Zamknij i kontynuuj</button>
        </div>
      </div>
    </div>
  );
}

// ===== TABS =====
type Tab = 'general' | 'bot' | 'oauth2' | 'docs';

interface GeneralTabProps {
  app: DevApplication;
  onUpdate: (updated: DevApplication) => void;
}

function GeneralTab({ app, onUpdate }: GeneralTabProps) {
  const [name, setName] = useState(app.name);
  const [desc, setDesc] = useState(app.description || '');
  const [redirectInput, setRedirectInput] = useState('');
  const [redirectUris, setRedirectUris] = useState<string[]>(app.redirect_uris || []);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [secret, setSecret] = useState(app.client_secret || '');
  const [revealedSecret, setRevealedSecret] = useState(false);
  const [secretModal, setSecretModal] = useState<string | null>(null);
  const { copy, copiedKey } = useCopyToClipboard();

  useEffect(() => {
    setName(app.name);
    setDesc(app.description || '');
    setRedirectUris(app.redirect_uris || []);
    setSecret(app.client_secret || '');
  }, [app.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await devApi.updateApp(app.id, {
        name: name.trim(),
        description: desc.trim() || null,
        redirect_uris: redirectUris,
      });
      onUpdate(updated);
      setSaveMsg('Zapisano!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Błąd: ' + (err.message || 'Nieznany'));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenSecret = async () => {
    const ok = window.confirm('Czy na pewno chcesz zregenerować Client Secret?\n\nStary secret przestanie działać natychmiast. Upewnij się, że zaktualizujesz go we wszystkich miejscach gdzie jest używany.');
    if (!ok) return;
    try {
      const result = await devApi.regenerateSecret(app.id);
      setSecret(result.client_secret);
      setSecretModal(result.client_secret);
    } catch (err: any) {
      alert('Błąd regeneracji: ' + err.message);
    }
  };

  const addRedirectUri = () => {
    const trimmed = redirectInput.trim();
    if (!trimmed) return;
    if (redirectUris.includes(trimmed)) return;
    setRedirectUris(prev => [...prev, trimmed]);
    setRedirectInput('');
  };

  const removeRedirectUri = (uri: string) => {
    setRedirectUris(prev => prev.filter(u => u !== uri));
  };

  return (
    <div>
      {secretModal && (
        <SecretRevealModal
          secret={secretModal}
          title="Nowy Client Secret"
          message="Zapisz ten secret teraz — nie zostanie pokazany ponownie po zamknięciu tego okna."
          onClose={() => setSecretModal(null)}
        />
      )}

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>NAZWA APLIKACJI</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>OPIS</label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={3}
          placeholder="Opcjonalny opis aplikacji..."
          style={{ ...inputStyle, resize: 'vertical', minHeight: 72 }}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>CLIENT ID</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1, fontFamily: 'monospace', fontSize: 13,
            background: '#18181b', border: '1px solid #3f3f46',
            borderRadius: 8, padding: '8px 12px', color: '#a1a1aa',
          }}>
            {app.client_id}
          </div>
          <CopyButton text={app.client_id} copyKey="client_id" copiedKey={copiedKey} onCopy={copy} />
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>CLIENT SECRET</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 200, fontFamily: 'monospace', fontSize: 13,
            background: '#18181b', border: '1px solid #3f3f46',
            borderRadius: 8, padding: '8px 12px', color: '#f4f4f5',
            letterSpacing: revealedSecret ? 'normal' : '0.15em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {secret
              ? (revealedSecret ? secret : '●'.repeat(Math.min(secret.length, 40)))
              : <span style={{ color: '#52525b', fontStyle: 'italic' }}>Nie wygenerowany lub ukryty z bezpieczeństwa</span>
            }
          </div>
          {secret && (
            <button
              onClick={() => setRevealedSecret(r => !r)}
              style={{ padding: '8px 10px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 8, color: '#a1a1aa', cursor: 'pointer' }}
            >
              {revealedSecret ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          )}
          {secret && revealedSecret && (
            <CopyButton text={secret} copyKey="client_secret" copiedKey={copiedKey} onCopy={copy} />
          )}
          <button
            onClick={handleRegenSecret}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            <RefreshIcon />
            Regeneruj secret
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: '#52525b' }}>
          Client Secret jest wyświetlany tylko raz po wygenerowaniu. Nie udostępniaj go publiczne.
        </p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>REDIRECT URIS</label>
        <div style={{ marginBottom: 8 }}>
          {redirectUris.length === 0 ? (
            <p style={{ color: '#52525b', fontSize: 13, fontStyle: 'italic', margin: '0 0 8px' }}>Brak dodanych redirect URIs</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              {redirectUris.map(uri => (
                <div key={uri} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1, fontFamily: 'monospace', fontSize: 12,
                    background: '#18181b', border: '1px solid #3f3f46',
                    borderRadius: 6, padding: '6px 10px', color: '#d4d4d8',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {uri}
                  </div>
                  <button
                    onClick={() => removeRedirectUri(uri)}
                    style={{ padding: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', cursor: 'pointer' }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={redirectInput}
              onChange={e => setRedirectInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addRedirectUri())}
              placeholder="https://example.com/callback"
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={addRedirectUri} style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <PlusIcon /> Dodaj
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
        </button>
        {saveMsg && (
          <span style={{ fontSize: 13, color: saveMsg.startsWith('Błąd') ? '#f87171' : '#4ade80' }}>
            {saveMsg}
          </span>
        )}
      </div>
    </div>
  );
}

interface BotTabProps {
  app: DevApplication;
  onUpdate: (updated: DevApplication) => void;
}

function BotTab({ app, onUpdate }: BotTabProps) {
  const [botToken, setBotToken] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [botServers, setBotServers] = useState<BotServer[]>([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [tokenModal, setTokenModal] = useState<string | null>(null);
  const [creatingBot, setCreatingBot] = useState(false);
  const { copy, copiedKey } = useCopyToClipboard();
  const hasBot = !!app.bot_user_id;

  useEffect(() => {
    if (hasBot) {
      loadServers();
      loadInviteUrl();
    }
  }, [app.id, hasBot]);

  const loadServers = async () => {
    setLoadingServers(true);
    try {
      const servers = await devApi.getBotServers(app.id);
      setBotServers(servers);
    } catch { setBotServers([]); }
    finally { setLoadingServers(false); }
  };

  const loadInviteUrl = async () => {
    try {
      const result = await devApi.getInviteUrl(app.id);
      setInviteUrl(result.invite_url);
    } catch { setInviteUrl(''); }
  };

  const handleCreateBot = async () => {
    setCreatingBot(true);
    try {
      await devApi.createBot(app.id);
      const updated = await devApi.getApp(app.id);
      onUpdate(updated);
    } catch (err: any) {
      alert('Błąd tworzenia bota: ' + err.message);
    } finally {
      setCreatingBot(false);
    }
  };

  const handleDeleteBot = async () => {
    const ok = window.confirm('Czy na pewno chcesz usunąć bota?\n\nBot zostanie wyrzucony ze wszystkich serwerów, a wszystkie tokeny przestaną działać natychmiast.');
    if (!ok) return;
    try {
      await devApi.deleteBot(app.id);
      const updated = await devApi.getApp(app.id);
      onUpdate(updated);
      setBotToken('');
      setBotServers([]);
    } catch (err: any) {
      alert('Błąd usuwania bota: ' + err.message);
    }
  };

  const handleRegenToken = async () => {
    const ok = window.confirm('Czy na pewno chcesz zregenerować token bota?\n\nStary token przestanie działać natychmiast. Bot straci połączenie do czasu restartu z nowym tokenem.');
    if (!ok) return;
    try {
      const result = await devApi.regenerateToken(app.id);
      setBotToken(result.token);
      setTokenModal(result.token);
    } catch (err: any) {
      alert('Błąd regeneracji tokenu: ' + err.message);
    }
  };

  if (!hasBot) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ marginBottom: 16, color: '#52525b' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
            <rect x="3" y="11" width="18" height="10" rx="2"/>
            <circle cx="12" cy="5" r="2"/>
            <path d="M12 7v4"/>
            <line x1="8" y1="16" x2="8" y2="16"/>
            <line x1="16" y1="16" x2="16" y2="16"/>
          </svg>
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#f4f4f5' }}>
          Ta aplikacja nie ma jeszcze bota
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#71717a', maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
          Utwórz bota, aby móc dołączyć go do serwerów Cordyn i automatyzować działania.
        </p>
        <button
          onClick={handleCreateBot}
          disabled={creatingBot}
          style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6, opacity: creatingBot ? 0.6 : 1 }}
        >
          <PlusIcon />
          {creatingBot ? 'Tworzenie...' : 'Utwórz bota'}
        </button>
      </div>
    );
  }

  return (
    <div>
      {tokenModal && (
        <SecretRevealModal
          secret={tokenModal}
          title="Nowy token bota"
          message="Zapisz ten token teraz — nie zostanie pokazany ponownie po zamknięciu tego okna. Użyj go w konfiguracji swojego bota."
          onClose={() => setTokenModal(null)}
        />
      )}

      {/* Bot info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#18181b', border: '1px solid #27272a', borderRadius: 10, marginBottom: 24 }}>
        {app.bot_avatar ? (
          <img src={app.bot_avatar} alt="Bot avatar" style={{ width: 40, height: 40, borderRadius: '50%' }} />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#3730a3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>
            {(app.bot_username || 'B')[0].toUpperCase()}
          </div>
        )}
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f4f4f5' }}>
            {app.bot_username || 'Bot'}
            <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 6px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4, color: '#818cf8' }}>BOT</span>
          </div>
          <div style={{ fontSize: 12, color: '#71717a' }}>ID: {app.bot_user_id}</div>
        </div>
      </div>

      {/* Bot token */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>BOT TOKEN</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{
            flex: 1, minWidth: 200, fontFamily: 'monospace', fontSize: 12,
            background: '#18181b', border: '1px solid #3f3f46',
            borderRadius: 8, padding: '8px 12px', color: '#f4f4f5',
            letterSpacing: botToken ? 'normal' : '0.15em',
          }}>
            {botToken ? botToken : '●'.repeat(32)}
          </div>
          {botToken && (
            <CopyButton text={botToken} copyKey="bot_token" copiedKey={copiedKey} onCopy={copy} />
          )}
          <button
            onClick={handleRegenToken}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
          >
            <RefreshIcon />
            Regeneruj token
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8, padding: '8px 12px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 6 }}>
          <span style={{ color: '#facc15', flexShrink: 0, marginTop: 1 }}><AlertIcon /></span>
          <p style={{ margin: 0, fontSize: 12, color: '#ca8a04', lineHeight: 1.5 }}>
            Token bota jest jak hasło — nie udostępniaj go publicznie ani nie wgrywaj do publicznych repozytoriów.
          </p>
        </div>
      </div>

      {/* Invite URL */}
      {inviteUrl && (
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>LINK ZAPROSZENIA</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              flex: 1, fontFamily: 'monospace', fontSize: 12,
              background: '#18181b', border: '1px solid #3f3f46',
              borderRadius: 8, padding: '8px 12px', color: '#a1a1aa',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {inviteUrl}
            </div>
            <CopyButton text={inviteUrl} copyKey="invite_url" copiedKey={copiedKey} onCopy={copy} />
            <a
              href={inviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 8, color: '#a1a1aa', textDecoration: 'none', fontSize: 12 }}
            >
              <ExternalLinkIcon /> Otwórz
            </a>
          </div>
        </div>
      )}

      {/* Bot servers */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <label style={{ ...labelStyle, margin: 0 }}>
            SERWERY ({botServers.length})
          </label>
          <button
            onClick={loadServers}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'transparent', border: '1px solid #3f3f46', borderRadius: 6, color: '#71717a', cursor: 'pointer', fontSize: 11 }}
          >
            <RefreshIcon /> Odśwież
          </button>
        </div>
        {loadingServers ? (
          <p style={{ color: '#52525b', fontSize: 13 }}>Ładowanie...</p>
        ) : botServers.length === 0 ? (
          <p style={{ color: '#52525b', fontSize: 13, fontStyle: 'italic' }}>Bot nie jest zainstalowany na żadnym serwerze.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {botServers.map(server => (
              <div key={server.server_id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: '#18181b',
                border: '1px solid #27272a', borderRadius: 8,
              }}>
                {server.icon_url ? (
                  <img src={server.icon_url} alt={server.name} style={{ width: 32, height: 32, borderRadius: '50%' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontWeight: 700, fontSize: 14 }}>
                    {server.name[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>{server.name}</div>
                  <div style={{ fontSize: 11, color: '#71717a' }}>{server.member_count} członków</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete bot */}
      <div style={{ paddingTop: 20, borderTop: '1px solid #27272a' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#f87171' }}>Strefa zagrożenia</h4>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#71717a' }}>
          Usunięcie bota jest nieodwracalne. Bot zostanie wyrzucony ze wszystkich serwerów.
        </p>
        <button onClick={handleDeleteBot} style={btnDanger}>
          <TrashIcon /> Usuń bota
        </button>
      </div>
    </div>
  );
}

interface OAuth2TabProps {
  app: DevApplication;
}

const OAUTH2_SCOPES = [
  { id: 'identify', label: 'identify', desc: 'Dostęp do nazwy użytkownika, avatara i ID', recommended: true },
  { id: 'email', label: 'email', desc: 'Dostęp do adresu email (weryfikowanego)', recommended: false },
  { id: 'guilds', label: 'guilds', desc: 'Lista serwerów użytkownika', recommended: false },
  { id: 'guilds.join', label: 'guilds.join', desc: 'Dołączanie do serwerów w imieniu użytkownika', recommended: false },
  { id: 'bot', label: 'bot', desc: 'Dodawanie bota do serwera', recommended: false },
  { id: 'messages.read', label: 'messages.read', desc: 'Odczyt wiadomości z kanałów', recommended: false },
  { id: 'connections', label: 'connections', desc: 'Powiązane konta (Twitter, GitHub, etc.)', recommended: false },
];

function OAuth2Tab({ app }: OAuth2TabProps) {
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['identify']);
  const { copy, copiedKey } = useCopyToClipboard();

  const toggleScope = (id: string) => {
    setSelectedScopes(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const authUrl = `${window.location.origin}/oauth2/authorize?client_id=${app.client_id}&response_type=code&scope=${encodeURIComponent(selectedScopes.join(' '))}`;
  const tokenEndpoint = `${window.location.origin}/api/oauth2/token`;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>ZAKRESY (SCOPES)</label>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#71717a' }}>
          Wybierz zakresy dostępu, których potrzebuje Twoja aplikacja.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OAUTH2_SCOPES.map(scope => (
            <label key={scope.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 14px', background: '#18181b',
              border: `1px solid ${selectedScopes.includes(scope.id) ? 'rgba(99,102,241,0.4)' : '#27272a'}`,
              borderRadius: 8, cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}>
              <input
                type="checkbox"
                checked={selectedScopes.includes(scope.id)}
                onChange={() => toggleScope(scope.id)}
                style={{ marginTop: 2, accentColor: '#6366f1' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#f4f4f5' }}>{scope.label}</span>
                  {scope.recommended && (
                    <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4, color: '#818cf8' }}>
                      ZALECANY
                    </span>
                  )}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#71717a' }}>{scope.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>WYGENEROWANY AUTHORIZATION URL</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <div style={{
            flex: 1, fontFamily: 'monospace', fontSize: 12,
            background: '#18181b', border: '1px solid #3f3f46',
            borderRadius: 8, padding: '10px 12px', color: '#a1a1aa',
            wordBreak: 'break-all', lineHeight: 1.6,
          }}>
            {authUrl}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <CopyButton text={authUrl} copyKey="auth_url" copiedKey={copiedKey} onCopy={copy} />
          <a
            href={authUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, color: '#a1a1aa', textDecoration: 'none', fontSize: 12 }}
          >
            <ExternalLinkIcon /> Testuj
          </a>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>TOKEN ENDPOINT</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            flex: 1, fontFamily: 'monospace', fontSize: 12,
            background: '#18181b', border: '1px solid #3f3f46',
            borderRadius: 8, padding: '8px 12px', color: '#a1a1aa',
          }}>
            {tokenEndpoint}
          </div>
          <CopyButton text={tokenEndpoint} copyKey="token_endpoint" copiedKey={copiedKey} onCopy={copy} />
        </div>
      </div>

      <div style={{ padding: '16px', background: '#18181b', border: '1px solid #27272a', borderRadius: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ color: '#818cf8' }}><KeyIcon /></span>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>PKCE (Proof Key for Code Exchange)</h4>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>
          Dla aplikacji SPA i mobilnych zalecamy używanie PKCE zamiast client_secret. Dodaj parametry:
        </p>
        <div style={{ fontFamily: 'monospace', fontSize: 12, background: '#09090b', borderRadius: 6, padding: '10px 12px', color: '#a1a1aa', lineHeight: 1.7 }}>
          code_challenge=&lt;base64url(sha256(verifier))&gt;<br />
          code_challenge_method=S256
        </div>
      </div>
    </div>
  );
}

interface DocsTabProps {
  app: DevApplication;
}

function DocsTab({ app }: DocsTabProps) {
  const { copy, copiedKey } = useCopyToClipboard();
  const origin = window.location.origin;

  const codeBlockStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 12,
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: 8,
    padding: '12px 14px',
    color: '#d4d4d8',
    lineHeight: 1.7,
    overflowX: 'auto',
    whiteSpace: 'pre',
    margin: '8px 0 16px',
  };

  const endpointStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 14px', background: '#18181b',
    border: '1px solid #27272a', borderRadius: 8,
    marginBottom: 6,
  };

  const methodBadge = (method: string) => {
    const colors: Record<string, string> = {
      GET: '#4ade80', POST: '#818cf8', PATCH: '#fbbf24', DELETE: '#f87171', PUT: '#fb923c',
    };
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
        color: colors[method] || '#a1a1aa',
        minWidth: 48, textAlign: 'center',
      }}>
        {method}
      </span>
    );
  };

  const jsExample = `// Przykład autoryzacji OAuth2 (JavaScript)
const CLIENT_ID = '${app.client_id}';
const REDIRECT_URI = 'https://twoja-aplikacja.com/callback';
const SCOPES = ['identify', 'guilds'];

// 1. Przekieruj użytkownika do autoryzacji
const authUrl = new URL('${origin}/oauth2/authorize');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPES.join(' '));
window.location.href = authUrl.toString();

// 2. Po powrocie na redirect_uri, wymień code na token
const code = new URLSearchParams(window.location.search).get('code');
const response = await fetch('${origin}/api/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: CLIENT_ID,
    client_secret: 'TWÓJ_CLIENT_SECRET',
    code,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }),
});
const { access_token, token_type } = await response.json();

// 3. Użyj tokenu do zapytań API
const me = await fetch('${origin}/api/users/me', {
  headers: { Authorization: \`Bearer \${access_token}\` },
});`;

  const curlExample = `# Pobierz info o zalogowanym użytkowniku
curl -H "Authorization: Bearer ACCESS_TOKEN" \\
  ${origin}/api/users/me

# Pobierz serwery użytkownika
curl -H "Authorization: Bearer ACCESS_TOKEN" \\
  ${origin}/api/servers

# Wymień code na access_token
curl -X POST ${origin}/api/oauth2/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "client_id": "${app.client_id}",
    "client_secret": "CLIENT_SECRET",
    "code": "AUTHORIZATION_CODE",
    "redirect_uri": "REDIRECT_URI",
    "grant_type": "authorization_code"
  }'`;

  return (
    <div>
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#818cf8' }}><GlobeIcon /></span>
          Pierwsze kroki
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>
          Cordyn API używa OAuth2 do autoryzacji. Twoja aplikacja otrzymuje token dostępu, którym autoryzuje wszystkie dalsze zapytania.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'CLIENT ID', value: app.client_id },
            { label: 'BASE URL', value: origin + '/api' },
            { label: 'AUTH URL', value: origin + '/oauth2/authorize' },
            { label: 'TOKEN URL', value: origin + '/api/oauth2/token' },
          ].map(item => (
            <div key={item.label} style={{ padding: '10px 12px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#d4d4d8', wordBreak: 'break-all' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#818cf8' }}><CodeIcon /></span>
          Przykład JavaScript
        </h3>
        <div style={{ position: 'relative' }}>
          <pre style={codeBlockStyle}>{jsExample}</pre>
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <CopyButton text={jsExample} copyKey="js_example" copiedKey={copiedKey} onCopy={copy} />
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#818cf8' }}><CodeIcon /></span>
          Przykład cURL
        </h3>
        <div style={{ position: 'relative' }}>
          <pre style={codeBlockStyle}>{curlExample}</pre>
          <div style={{ position: 'absolute', top: 8, right: 8 }}>
            <CopyButton text={curlExample} copyKey="curl_example" copiedKey={copiedKey} onCopy={copy} />
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#818cf8' }}><ServerIcon /></span>
          Endpointy API
        </h3>
        {[
          { method: 'GET', path: '/api/users/me', desc: 'Dane zalogowanego użytkownika' },
          { method: 'GET', path: '/api/users/:id', desc: 'Dane użytkownika po ID' },
          { method: 'GET', path: '/api/servers', desc: 'Lista serwerów użytkownika' },
          { method: 'POST', path: '/api/servers', desc: 'Utwórz nowy serwer' },
          { method: 'GET', path: '/api/servers/:id', desc: 'Dane serwera' },
          { method: 'GET', path: '/api/channels/:id/messages', desc: 'Wiadomości z kanału' },
          { method: 'POST', path: '/api/channels/:id/messages', desc: 'Wyślij wiadomość' },
          { method: 'GET', path: '/api/dms/conversations', desc: 'Lista konwersacji DM' },
          { method: 'GET', path: '/api/friends', desc: 'Lista znajomych' },
          { method: 'POST', path: '/api/oauth2/token', desc: 'Wymiana code na token' },
          { method: 'POST', path: '/api/oauth2/token/refresh', desc: 'Odśwież access token' },
          { method: 'DELETE', path: '/api/oauth2/token', desc: 'Unieważnij token' },
        ].map((ep, i) => (
          <div key={i} style={endpointStyle}>
            {methodBadge(ep.method)}
            <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#d4d4d8' }}>{ep.path}</span>
            <span style={{ fontSize: 12, color: '#71717a', marginLeft: 'auto' }}>{ep.desc}</span>
          </div>
        ))}
      </section>

      <section style={{ padding: '16px', background: '#18181b', border: '1px solid #27272a', borderRadius: 10 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Rate Limiting</h4>
        <p style={{ margin: 0, fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>
          Twoja aplikacja jest na planie <strong style={{ color: '#818cf8' }}>{app.rate_limit_tier}</strong>.
          Limity są zwracane w nagłówkach: <code style={{ fontFamily: 'monospace', color: '#d4d4d8' }}>X-RateLimit-Limit</code>,{' '}
          <code style={{ fontFamily: 'monospace', color: '#d4d4d8' }}>X-RateLimit-Remaining</code>,{' '}
          <code style={{ fontFamily: 'monospace', color: '#d4d4d8' }}>X-RateLimit-Reset</code>.
          Po przekroczeniu limitu API zwraca status <code style={{ fontFamily: 'monospace', color: '#f87171' }}>429 Too Many Requests</code>.
        </p>
      </section>
    </div>
  );
}

// ===== STYLES =====
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 14,
  color: '#f4f4f5',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 6,
};

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

const btnSecondary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#27272a',
  color: '#d4d4d8',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(239,68,68,0.08)',
  color: '#f87171',
  border: '1px solid rgba(239,68,68,0.2)',
  borderRadius: 8,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};

// ===== MAIN COMPONENT =====
export default function DeveloperPortal() {
  const [apps, setApps] = useState<DevApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<DevApplication | null>(null);
  const [tab, setTab] = useState<Tab>('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await devApi.listApps();
      setApps(list);
      if (list.length > 0 && !selectedApp) {
        setSelectedApp(list[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Błąd ładowania aplikacji');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  const handleCreate = async (name: string, desc: string) => {
    const created = await devApi.createApp(name, desc);
    setApps(prev => [...prev, created]);
    setSelectedApp(created);
    setShowNewModal(false);
    setCreatedSecret(created.client_secret || null);
    setSidebarOpen(false);
  };

  const handleSelectApp = (app: DevApplication) => {
    setSelectedApp(app);
    setTab('general');
    setSidebarOpen(false);
  };

  const handleUpdateApp = (updated: DevApplication) => {
    setApps(prev => prev.map(a => a.id === updated.id ? updated : a));
    setSelectedApp(updated);
  };

  const handleDeleteApp = async () => {
    if (!selectedApp) return;
    const ok = window.confirm(`Czy na pewno chcesz usunąć aplikację "${selectedApp.name}"?\n\nWszystkie tokeny i secrety przestaną działać natychmiast. Ta akcja jest nieodwracalna.`);
    if (!ok) return;
    try {
      await devApi.deleteApp(selectedApp.id);
      const remaining = apps.filter(a => a.id !== selectedApp.id);
      setApps(remaining);
      setSelectedApp(remaining[0] || null);
    } catch (err: any) {
      alert('Błąd usuwania: ' + err.message);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'Ogólne', icon: <GlobeIcon /> },
    { id: 'bot', label: 'Bot', icon: <BotIcon /> },
    { id: 'oauth2', label: 'OAuth2', icon: <KeyIcon /> },
    { id: 'docs', label: 'Dokumentacja', icon: <CodeIcon /> },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{
        height: 56, borderBottom: '1px solid #18181b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', position: 'sticky', top: 0,
        background: 'rgba(9,9,11,0.9)', backdropFilter: 'blur(8px)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ display: 'none', padding: 6, background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}
            className="mobile-menu-btn"
          >
            {sidebarOpen ? <XIcon /> : <MenuIcon />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg,#6366f1,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#fff' }}>
              C
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Cordyn</span>
            <span style={{ color: '#27272a', fontSize: 16, margin: '0 2px' }}>/</span>
            <span style={{ fontSize: 14, color: '#71717a' }}>Developer Portal</span>
          </div>
        </div>
        <a
          href="/"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#71717a', textDecoration: 'none', padding: '6px 10px', border: '1px solid #27272a', borderRadius: 6 }}
        >
          <ExternalLinkIcon /> Do aplikacji
        </a>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
        {/* Sidebar overlay for mobile */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, top: 56 }}
          />
        )}

        {/* Sidebar */}
        <aside style={{
          width: 240,
          minWidth: 240,
          borderRight: '1px solid #18181b',
          background: '#09090b',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          position: 'sticky',
          top: 56,
          height: 'calc(100vh - 56px)',
          zIndex: 50,
          transform: sidebarOpen ? 'translateX(0)' : undefined,
        }}>
          <div style={{ padding: '16px 12px 8px' }}>
            <button
              onClick={() => setShowNewModal(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', background: 'rgba(99,102,241,0.12)',
                border: '1px solid rgba(99,102,241,0.25)', borderRadius: 8,
                color: '#818cf8', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              <PlusIcon />
              Nowa aplikacja
            </button>
          </div>

          <div style={{ padding: '8px 12px', flex: 1 }}>
            {loading ? (
              <div style={{ padding: '16px 4px', color: '#52525b', fontSize: 13 }}>Ładowanie...</div>
            ) : error ? (
              <div style={{ padding: '12px 4px', color: '#f87171', fontSize: 12 }}>{error}</div>
            ) : apps.length === 0 ? (
              <div style={{ padding: '16px 4px', color: '#52525b', fontSize: 13 }}>
                Brak aplikacji. Utwórz pierwszą!
              </div>
            ) : (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 4px 8px' }}>
                  Twoje aplikacje
                </div>
                {apps.map(app => (
                  <button
                    key={app.id}
                    onClick={() => handleSelectApp(app)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                      background: selectedApp?.id === app.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                      border: selectedApp?.id === app.id ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                      color: selectedApp?.id === app.id ? '#818cf8' : '#a1a1aa',
                      fontSize: 13, fontWeight: selectedApp?.id === app.id ? 600 : 400,
                      marginBottom: 2, textAlign: 'left',
                      transition: 'all 0.1s',
                    }}
                  >
                    {app.icon_url ? (
                      <img src={app.icon_url} alt="" style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        background: selectedApp?.id === app.id ? 'rgba(99,102,241,0.25)' : '#27272a',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, color: selectedApp?.id === app.id ? '#818cf8' : '#71717a',
                      }}>
                        {app.name[0].toUpperCase()}
                      </div>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.name}
                    </span>
                    {app.is_verified && (
                      <span style={{ marginLeft: 'auto', flexShrink: 0, color: '#4ade80' }}><CheckIcon /></span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', maxWidth: 900 }}>
          {!selectedApp ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 16 }}>
              <div style={{ fontSize: 48, color: '#27272a' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 9h6M9 12h6M9 15h4"/>
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#71717a' }}>Wybierz aplikację</h2>
                <p style={{ margin: '0 0 20px', fontSize: 14, color: '#3f3f46' }}>Wybierz aplikację z listy lub utwórz nową.</p>
                <button onClick={() => setShowNewModal(true)} style={{ ...btnPrimary, display: 'inline-flex' }}>
                  <PlusIcon /> Utwórz pierwszą aplikację
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* App header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {selectedApp.icon_url ? (
                    <img src={selectedApp.icon_url} alt="" style={{ width: 52, height: 52, borderRadius: 12 }} />
                  ) : (
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                      {selectedApp.name[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>{selectedApp.name}</h1>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: '#71717a' }}>
                      {selectedApp.description || 'Brak opisu'}
                      {selectedApp.is_verified && (
                        <span style={{ marginLeft: 8, color: '#4ade80' }}><CheckIcon /></span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDeleteApp}
                  style={{ ...btnDanger, fontSize: 12, padding: '6px 12px' }}
                >
                  <TrashIcon /> Usuń aplikację
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #18181b', marginBottom: 24, gap: 2 }}>
                {tabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '9px 14px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                      color: tab === t.id ? '#818cf8' : '#71717a',
                      background: 'transparent', border: 'none',
                      borderBottom: `2px solid ${tab === t.id ? '#6366f1' : 'transparent'}`,
                      cursor: 'pointer', marginBottom: -1,
                      transition: 'all 0.15s',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ background: '#111113', border: '1px solid #1c1c1f', borderRadius: 12, padding: '24px' }}>
                {tab === 'general' && <GeneralTab app={selectedApp} onUpdate={handleUpdateApp} />}
                {tab === 'bot' && <BotTab app={selectedApp} onUpdate={handleUpdateApp} />}
                {tab === 'oauth2' && <OAuth2Tab app={selectedApp} />}
                {tab === 'docs' && <DocsTab app={selectedApp} />}
              </div>
            </>
          )}
        </main>
      </div>

      {/* Modals */}
      {showNewModal && (
        <NewAppModal onClose={() => setShowNewModal(false)} onCreate={handleCreate} />
      )}
      {createdSecret && (
        <SecretRevealModal
          secret={createdSecret}
          title="Aplikacja utworzona — zapisz Client Secret"
          message="Ten Client Secret zostanie pokazany tylko raz. Zapisz go w bezpiecznym miejscu — nie będziesz mógł go odzyskać."
          onClose={() => setCreatedSecret(null)}
        />
      )}

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, textarea:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
        }
        button:not(:disabled):hover { opacity: 0.85; }
        @media (max-width: 640px) {
          .mobile-menu-btn { display: flex !important; }
          aside {
            position: fixed !important;
            top: 56px !important;
            left: 0;
            height: calc(100vh - 56px) !important;
            transform: translateX(-100%) !important;
            transition: transform 0.2s ease !important;
          }
          aside[style*="translateX(0)"] {
            transform: translateX(0) !important;
          }
          main { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
