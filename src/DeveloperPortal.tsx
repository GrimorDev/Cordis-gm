import React, { useState, useEffect, useCallback, useRef } from 'react';
import { devApi, DevApplication, BotServer, MyServer } from './developer/developerApi';

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
  const [isPublic, setIsPublic] = useState(app.is_public ?? false);
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
    setIsPublic(app.is_public ?? false);
  }, [app.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await devApi.updateApp(app.id, {
        name: name.trim(),
        description: desc.trim() || null,
        redirect_uris: redirectUris,
        is_public: isPublic,
      } as any);
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

      {/* is_public toggle */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>WIDOCZNOŚĆ W CORDYN APPS</label>
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '12px 16px', background: '#18181b',
          border: `1px solid ${isPublic ? 'rgba(99,102,241,0.4)' : '#27272a'}`,
          borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s',
        }}>
          <div
            onClick={() => setIsPublic(p => !p)}
            style={{
              width: 40, height: 22, borderRadius: 11, flexShrink: 0,
              background: isPublic ? '#6366f1' : '#3f3f46',
              position: 'relative', cursor: 'pointer', transition: 'background 0.2s', marginTop: 1,
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: isPublic ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', marginBottom: 2 }}>
              Publiczna aplikacja
              {isPublic && (
                <span style={{ marginLeft: 8, fontSize: 11, padding: '1px 6px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4, color: '#818cf8' }}>
                  WIDOCZNA W CORDYN APPS
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#71717a', lineHeight: 1.5 }}>
              {isPublic
                ? 'Bot jest widoczny w katalogu Cordyn Apps. Każdy właściciel serwera może go dodać.'
                : 'Bot jest prywatny. Tylko Ty możesz go dodawać do serwerów.'}
            </p>
          </div>
        </label>
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
      <AuditLogSection appId={app.id} />
    </div>
  );
}

// ===== ADD TO SERVER MODAL =====
interface AddToServerModalProps {
  clientId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function AddToServerModal({ clientId, onClose, onSuccess }: AddToServerModalProps) {
  const [servers, setServers] = useState<MyServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    devApi.getMyServers()
      .then(setServers)
      .catch(() => setError('Nie udało się załadować serwerów'))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (serverId: string) => {
    setAdding(serverId);
    setError('');
    try {
      await devApi.addBotToServer(clientId, serverId);
      setDone(serverId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Błąd dodawania bota');
    } finally {
      setAdding(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 20,
    }}>
      <div style={{
        background: '#18181b', border: '1px solid #27272a', borderRadius: 14,
        padding: 24, width: '100%', maxWidth: 480, maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f4f4f5' }}>
            Dodaj bota do serwera
          </h3>
          <button onClick={onClose} style={{ padding: 6, background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer' }}>
            <XIcon />
          </button>
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#71717a' }}>
          Wybierz serwer, do którego chcesz dodać bota. Musisz być właścicielem lub adminem.
        </p>

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: '#52525b', fontSize: 13 }}>Ładowanie serwerów...</p>
          ) : servers.length === 0 ? (
            <p style={{ color: '#52525b', fontSize: 13, fontStyle: 'italic' }}>
              Nie jesteś właścicielem ani adminem żadnego serwera.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {servers.map(server => {
                const isDone = done === server.id;
                const isAdding = adding === server.id;
                return (
                  <div key={server.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: '#09090b',
                    border: `1px solid ${isDone ? 'rgba(74,222,128,0.3)' : '#27272a'}`,
                    borderRadius: 10, transition: 'border-color 0.15s',
                  }}>
                    {server.icon_url ? (
                      <img src={server.icon_url} alt={server.name} style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71717a', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                        {server.name[0]}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.name}</div>
                      <div style={{ fontSize: 11, color: '#71717a' }}>{server.member_count} członków · {server.role_name}</div>
                    </div>
                    {isDone ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4ade80', fontWeight: 600 }}>
                        <CheckIcon /> Dodano
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(server.id)}
                        disabled={isAdding || !!adding}
                        style={{ ...btnPrimary, padding: '5px 12px', fontSize: 12, opacity: (isAdding || (!!adding && !isAdding)) ? 0.6 : 1 }}
                      >
                        {isAdding ? '...' : 'Dodaj'}
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
  const [showAddModal, setShowAddModal] = useState(false);
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
      {showAddModal && (
        <AddToServerModal
          clientId={app.client_id}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { loadServers(); }}
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

      {/* Invite URL + Quick Add */}
      {inviteUrl && (
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>LINK ZAPROSZENIA</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              flex: 1, minWidth: 180, fontFamily: 'monospace', fontSize: 12,
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
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowAddModal(true)}
              style={{ ...btnPrimary, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ServerIcon />
              Dodaj do mojego serwera
            </button>
            <span style={{ marginLeft: 10, fontSize: 12, color: '#71717a' }}>
              Szybkie dodanie bez opuszczania portalu
            </span>
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

      {/* Webhook */}
      <WebhookSection app={app} onUpdate={onUpdate} />

      {/* Rate Limit Dashboard */}
      <RateLimitSection appId={app.id} />

      {/* Bot Analytics */}
      <AnalyticsSection appId={app.id} />

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

// ── Webhook Section ───────────────────────────────────────────────────────────
function WebhookSection({ app, onUpdate }: { app: DevApplication; onUpdate: (u: DevApplication) => void }) {
  const [webhookUrl, setWebhookUrl] = useState((app as any).webhook_url || '');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [loadingSecret, setLoadingSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const { copy, copiedKey } = useCopyToClipboard();

  const revealSecret = async () => {
    if (webhookSecret) { setShowSecret(s => !s); return; }
    setLoadingSecret(true);
    try {
      const r = await devApi.getWebhookSecret(app.id);
      setWebhookSecret(r.webhook_secret);
      setShowSecret(true);
    } catch { /* ignore */ } finally { setLoadingSecret(false); }
  };

  const regenerateSecret = async () => {
    if (!confirm('Zregenerować webhook secret? Stary przestanie działać natychmiast.')) return;
    try {
      const r = await devApi.regenerateWebhookSecret(app.id);
      setWebhookSecret(r.webhook_secret);
      setShowSecret(true);
    } catch (e: any) { alert('Błąd: ' + e.message); }
  };

  const saveUrl = async () => {
    setSaving(true);
    try {
      const updated = await devApi.updateApp(app.id, { webhook_url: webhookUrl } as any);
      onUpdate(updated);
    } catch (e: any) { alert('Błąd: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ marginBottom: 28, paddingTop: 20, borderTop: '1px solid #27272a' }}>
      <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: '#f4f4f5' }}>Webhook</h4>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: '#71717a' }}>
        Cordyn wyśle zdarzenia (MESSAGE_CREATE, itp.) na ten URL z nagłówkiem <code style={{ color: '#818cf8', fontFamily: 'monospace' }}>X-Cordyn-Signature-256</code>.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://twój-serwer.pl/webhook"
          style={{ flex: 1, background: '#09090b', border: '1px solid #27272a', borderRadius: 6, padding: '8px 12px', color: '#f4f4f5', fontSize: 13 }} />
        <button onClick={saveUrl} disabled={saving} style={btnPrimary}>{saving ? '...' : 'Zapisz'}</button>
      </div>
      <label style={labelStyle}>WEBHOOK SECRET</label>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
        <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, padding: '8px 12px', background: '#09090b', border: '1px solid #27272a', borderRadius: 6, color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {webhookSecret && showSecret ? webhookSecret : '••••••••••••••••••••••••••••••••'}
        </div>
        <button onClick={revealSecret} style={btnSecondary}>{loadingSecret ? '...' : showSecret ? 'Ukryj' : 'Pokaż'}</button>
        {webhookSecret && showSecret && <button onClick={() => copy(webhookSecret, 'wh_secret')} style={btnSecondary}>{copiedKey === 'wh_secret' ? '✓' : 'Kopiuj'}</button>}
        <button onClick={regenerateSecret} style={btnSecondary} title="Regeneruj">↺</button>
      </div>
    </div>
  );
}

// ── Rate Limit Dashboard ──────────────────────────────────────────────────────
function RateLimitSection({ appId }: { appId: string }) {
  const [data, setData] = useState<{ today: number; this_hour: number; hourly: { hour: string; count: number }[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (data) return;
    setLoading(true);
    try { setData(await devApi.getRateLimits(appId)); } catch { /* ignore */ } finally { setLoading(false); }
  };

  const toggle = () => { if (!open) load(); setOpen(o => !o); };
  const maxCount = data ? Math.max(...data.hourly.map(h => h.count), 1) : 1;

  return (
    <div style={{ marginBottom: 28, paddingTop: 20, borderTop: '1px solid #27272a' }}>
      <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#f4f4f5', fontSize: 13, fontWeight: 700, padding: 0 }}>
        <span style={{ fontSize: 10, color: '#71717a' }}>{open ? '▼' : '▶'}</span> Użycie API (ostatnie 24h)
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {loading ? <p style={{ color: '#52525b', fontSize: 13 }}>Ładowanie...</p> : data ? (
            <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                {[{ label: 'Dziś', val: data.today }, { label: 'Ta godzina', val: data.this_hour }].map(({ label, val }) => (
                  <div key={label} style={{ flex: 1, background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#818cf8' }}>{val.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60, background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 8px 4px' }}>
                {data.hourly.map((h, i) => (
                  <div key={i} title={`${h.hour.slice(-2)}:00 — ${h.count} req`} style={{ flex: 1, minWidth: 0, background: h.count > 0 ? '#6366f1' : '#27272a', borderRadius: 2, height: `${Math.max(4, (h.count / maxCount) * 100)}%`, transition: 'height 0.2s' }} />
                ))}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: '#52525b', textAlign: 'center' }}>Ostatnie 24 godziny (każdy słupek = 1h)</p>
            </>
          ) : <p style={{ color: '#52525b', fontSize: 13 }}>Brak danych.</p>}
        </div>
      )}
    </div>
  );
}

// ── Bot Analytics Section ─────────────────────────────────────────────────────
function AnalyticsSection({ appId }: { appId: string }) {
  const [data, setData] = useState<{ days: any[]; totals: { messages: number; commands: number } } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (data) return;
    setLoading(true);
    try { setData(await devApi.getAnalytics(appId)); } catch { /* ignore */ } finally { setLoading(false); }
  };

  const toggle = () => { if (!open) load(); setOpen(o => !o); };
  const maxMsg = data ? Math.max(...data.days.map(d => d.messages_processed), 1) : 1;

  return (
    <div style={{ marginBottom: 28, paddingTop: 20, borderTop: '1px solid #27272a' }}>
      <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#f4f4f5', fontSize: 13, fontWeight: 700, padding: 0 }}>
        <span style={{ fontSize: 10, color: '#71717a' }}>{open ? '▼' : '▶'}</span> Statystyki bota (ostatnie 30 dni)
      </button>
      {open && (
        <div style={{ marginTop: 12 }}>
          {loading ? <p style={{ color: '#52525b', fontSize: 13 }}>Ładowanie...</p> : data ? (
            <>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                {[
                  { label: 'Wiadomości łącznie', val: data.totals.messages },
                  { label: 'Komendy łącznie', val: data.totals.commands },
                  { label: 'Aktywnych dni', val: data.days.filter(d => d.messages_processed > 0).length },
                ].map(({ label, val }) => (
                  <div key={label} style={{ flex: 1, background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#818cf8' }}>{val.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
              {data.days.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60, background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '8px 8px 4px' }}>
                    {data.days.map((d, i) => (
                      <div key={i} title={`${d.date}: ${d.messages_processed} wiad.`} style={{ flex: 1, minWidth: 0, background: d.messages_processed > 0 ? '#6366f1' : '#27272a', borderRadius: 2, height: `${Math.max(4, (d.messages_processed / maxMsg) * 100)}%`, transition: 'height 0.2s' }} />
                    ))}
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 10, color: '#52525b', textAlign: 'center' }}>Wiadomości dziennie — ostatnie 30 dni</p>
                </>
              )}
            </>
          ) : <p style={{ color: '#52525b', fontSize: 13 }}>Brak danych analitycznych.</p>}
        </div>
      )}
    </div>
  );
}

// ── Audit Log Section (for GeneralTab) ───────────────────────────────────────
function AuditLogSection({ appId }: { appId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (logs.length) return;
    setLoading(true);
    try { const r = await devApi.getAuditLogs(appId); setLogs(r.logs); } catch { /* ignore */ } finally { setLoading(false); }
  };

  const toggle = () => { if (!open) load(); setOpen(o => !o); };

  const actionColors: Record<string, string> = {
    app_created: '#4ade80', app_updated: '#818cf8', app_deleted: '#f87171',
    secret_regenerated: '#fb923c', webhook_secret_regenerated: '#fb923c',
    bot_created: '#34d399', bot_deleted: '#f87171', bot_token_regenerated: '#fb923c',
    bot_added_to_server: '#60a5fa',
  };

  return (
    <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #27272a' }}>
      <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#f4f4f5', fontSize: 13, fontWeight: 700, padding: 0 }}>
        <span style={{ fontSize: 10, color: '#71717a' }}>{open ? '▼' : '▶'}</span> Logi audytu
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {loading ? <p style={{ color: '#52525b', fontSize: 13 }}>Ładowanie...</p> : logs.length === 0 ? (
            <p style={{ color: '#52525b', fontSize: 13, fontStyle: 'italic' }}>Brak wpisów w logu audytu.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {logs.map(log => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', background: '#18181b', border: '1px solid #27272a', borderRadius: 6, fontSize: 12 }}>
                  <span style={{ padding: '2px 6px', borderRadius: 4, background: `${actionColors[log.action] || '#71717a'}20`, color: actionColors[log.action] || '#71717a', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{log.action}</span>
                  <span style={{ color: '#71717a', flexShrink: 0 }}>{log.actor_username}</span>
                  <span style={{ color: '#3f3f46', flexShrink: 0 }}>{new Date(log.created_at).toLocaleString('pl-PL')}</span>
                  {log.ip && <span style={{ color: '#3f3f46', marginLeft: 'auto', flexShrink: 0 }}>{log.ip}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface OAuth2TabProps {
  app: DevApplication;
  onUpdate: (updated: DevApplication) => void;
}

const OAUTH2_SCOPES = [
  { id: 'identify',      label: 'identify',      desc: 'Dostęp do nazwy użytkownika, avatara i ID',       group: 'Podstawowe',   recommended: true  },
  { id: 'email',         label: 'email',          desc: 'Dostęp do adresu email (weryfikowanego)',           group: 'Podstawowe',   recommended: false },
  { id: 'guilds',        label: 'guilds',         desc: 'Lista serwerów użytkownika (nazwy, ikony, ID)',     group: 'Serwery',      recommended: false },
  { id: 'guilds.join',   label: 'guilds.join',    desc: 'Dołączanie do serwerów w imieniu użytkownika',     group: 'Serwery',      recommended: false },
  { id: 'guilds.members.read', label: 'guilds.members.read', desc: 'Odczyt listy członków serwerów',         group: 'Serwery',      recommended: false },
  { id: 'bot',           label: 'bot',            desc: 'Dodawanie bota do serwera (wymaga scope=bot)',      group: 'Bot',          recommended: false },
  { id: 'messages.read', label: 'messages.read',  desc: 'Odczyt wiadomości z kanałów tekstowych',           group: 'Wiadomości',   recommended: false },
  { id: 'messages.send', label: 'messages.send',  desc: 'Wysyłanie wiadomości w imieniu użytkownika',       group: 'Wiadomości',   recommended: false },
  { id: 'connections',   label: 'connections',    desc: 'Powiązane konta zewnętrzne (GitHub, Steam, etc.)', group: 'Inne',         recommended: false },
  { id: 'dm.read',       label: 'dm.read',        desc: 'Odczyt wiadomości prywatnych',                     group: 'Wiadomości',   recommended: false },
];

function OAuth2Tab({ app, onUpdate }: OAuth2TabProps) {
  const scopeKey = `cordyn_oauth2_scopes_${app.id}`;
  const [selectedScopes, setSelectedScopes] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(scopeKey) || '["identify"]'); } catch { return ['identify']; }
  });
  const [redirectUris, setRedirectUris] = useState<string[]>(app.redirect_uris || []);
  const [redirectInput, setRedirectInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const { copy, copiedKey } = useCopyToClipboard();

  useEffect(() => {
    setRedirectUris(app.redirect_uris || []);
  }, [app.id]);

  const toggleScope = (id: string) => {
    setSelectedScopes(prev => {
      const next = prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id];
      localStorage.setItem(scopeKey, JSON.stringify(next));
      return next;
    });
  };

  const addUri = () => {
    const t = redirectInput.trim();
    if (!t || redirectUris.includes(t)) return;
    setRedirectUris(p => [...p, t]);
    setRedirectInput('');
  };

  const handleSave = async () => {
    setSaving(true); setSaveMsg('');
    try {
      const updated = await devApi.updateApp(app.id, { redirect_uris: redirectUris } as any);
      onUpdate(updated);
      setSaveMsg('Zapisano!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg('Błąd: ' + (err.message || 'Nieznany'));
    } finally { setSaving(false); }
  };

  const authUrl = `${window.location.origin}/oauth2/authorize?client_id=${app.client_id}&response_type=code&scope=${encodeURIComponent(selectedScopes.join(' '))}`;
  const tokenEndpoint = `${window.location.origin}/api/oauth2/token`;

  const groups = [...new Set(OAUTH2_SCOPES.map(s => s.group))];

  return (
    <div>
      {/* Redirect URIs */}
      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>REDIRECT URIS</label>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#71717a' }}>
          Adresy URL, na które Cordyn przekieruje użytkownika po autoryzacji. Muszą być dokładnie zgodne z <code style={{ fontFamily: 'monospace', color: '#d4d4d8' }}>redirect_uri</code> w zapytaniu.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {redirectUris.length === 0 ? (
            <p style={{ color: '#52525b', fontSize: 13, fontStyle: 'italic', margin: 0 }}>Brak redirect URIs — dodaj przynajmniej jeden.</p>
          ) : redirectUris.map(uri => (
            <div key={uri} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, background: '#18181b', border: '1px solid #3f3f46', borderRadius: 6, padding: '6px 10px', color: '#d4d4d8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {uri}
              </div>
              <button onClick={() => setRedirectUris(p => p.filter(u => u !== uri))}
                style={{ padding: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: '#f87171', cursor: 'pointer' }}>
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={redirectInput} onChange={e => setRedirectInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addUri())}
            placeholder="https://example.com/callback" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={addUri} style={{ ...btnPrimary, gap: 4 }}><PlusIcon /> Dodaj</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <button onClick={handleSave} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Zapisywanie...' : 'Zapisz redirect URIs'}
          </button>
          {saveMsg && <span style={{ fontSize: 13, color: saveMsg.startsWith('Błąd') ? '#f87171' : '#4ade80' }}>{saveMsg}</span>}
        </div>
      </div>

      {/* Scope selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>ZAKRESY (SCOPES)</label>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#71717a' }}>
          Wybierz uprawnienia potrzebne Twojej aplikacji. Zakresy są dołączane do URL autoryzacji poniżej.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{group}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {OAUTH2_SCOPES.filter(s => s.group === group).map(scope => (
                  <label key={scope.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '9px 14px', background: '#18181b',
                    border: `1px solid ${selectedScopes.includes(scope.id) ? 'rgba(99,102,241,0.4)' : '#27272a'}`,
                    borderRadius: 8, cursor: 'pointer', transition: 'border-color 0.15s',
                  }}>
                    <input type="checkbox" checked={selectedScopes.includes(scope.id)} onChange={() => toggleScope(scope.id)}
                      style={{ marginTop: 2, accentColor: '#6366f1' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: 'monospace', color: '#f4f4f5' }}>{scope.label}</span>
                        {scope.recommended && (
                          <span style={{ fontSize: 10, padding: '1px 6px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 4, color: '#818cf8' }}>ZALECANY</span>
                        )}
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#71717a' }}>{scope.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Auth URL builder */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>AUTHORIZATION URL (BUILDER)</label>
        <div style={{ fontFamily: 'monospace', fontSize: 12, background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, padding: '10px 12px', color: '#a1a1aa', wordBreak: 'break-all', lineHeight: 1.7, marginBottom: 8 }}>
          {authUrl}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CopyButton text={authUrl} copyKey="auth_url" copiedKey={copiedKey} onCopy={copy} />
          <a href={authUrl} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, color: '#a1a1aa', textDecoration: 'none', fontSize: 12 }}>
            <ExternalLinkIcon /> Testuj flow
          </a>
        </div>
      </div>

      {/* Endpoints */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Token Endpoint', val: `${window.location.origin}/api/oauth2/token`, key: 'tok_ep' },
          { label: 'Revoke Endpoint', val: `${window.location.origin}/api/oauth2/revoke`, key: 'rev_ep' },
        ].map(e => (
          <div key={e.key} style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{e.label}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#d4d4d8', wordBreak: 'break-all', marginBottom: 6 }}>{e.val}</div>
            <CopyButton text={e.val} copyKey={e.key} copiedKey={copiedKey} onCopy={copy} />
          </div>
        ))}
      </div>

      {/* PKCE info */}
      <div style={{ padding: '16px', background: '#18181b', border: '1px solid #27272a', borderRadius: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ color: '#818cf8' }}><KeyIcon /></span>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>PKCE — Proof Key for Code Exchange</h4>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#71717a', lineHeight: 1.6 }}>
          Dla aplikacji SPA i mobilnych (bez backendu) użyj PKCE zamiast <code style={{ fontFamily: 'monospace' }}>client_secret</code>. Wygeneruj losowy <code style={{ fontFamily: 'monospace' }}>code_verifier</code>, oblicz <code style={{ fontFamily: 'monospace' }}>code_challenge = BASE64URL(SHA256(verifier))</code>.
        </p>
        <div style={{ fontFamily: 'monospace', fontSize: 12, background: '#09090b', borderRadius: 6, padding: '10px 12px', color: '#a1a1aa', lineHeight: 1.8 }}>
          {`// Krok 1: Generuj weryfikator (128 znaków losowych)
const verifier = crypto.randomBytes(64).toString('base64url');

// Krok 2: Oblicz challenge
const challenge = crypto.createHash('sha256')
  .update(verifier).digest('base64url');

// Krok 3: Dodaj do auth URL
authUrl += '&code_challenge=' + challenge;
authUrl += '&code_challenge_method=S256';

// Krok 4: Przy wymianie code → token dołącz verifier
body.code_verifier = verifier; // zamiast client_secret`}
        </div>
      </div>

      {/* Grant types */}
      <div style={{ padding: '16px', background: '#18181b', border: '1px solid #27272a', borderRadius: 10 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Obsługiwane Grant Types</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { name: 'authorization_code', desc: 'Standardowy flow OAuth2 — redirect użytkownika, wymiana code na token' },
            { name: 'refresh_token', desc: 'Odnowienie access_token przy użyciu refresh_token (bez ponownego logowania)' },
          ].map(g => (
            <div key={g.name} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '8px 12px', background: '#09090b', borderRadius: 8 }}>
              <code style={{ fontFamily: 'monospace', fontSize: 12, color: '#818cf8', flexShrink: 0, marginTop: 1 }}>{g.name}</code>
              <span style={{ fontSize: 12, color: '#71717a' }}>{g.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== DOCS TAB =====
type DocLang = 'curl' | 'js' | 'node' | 'python' | 'php' | 'ruby' | 'go' | 'java';
type DocSection = 'quickstart' | 'auth' | 'oauth2' | 'users' | 'guilds' | 'channels' | 'messages' | 'bot' | 'errors';

const LANGS: { id: DocLang; label: string }[] = [
  { id: 'curl',   label: 'cURL'       },
  { id: 'js',     label: 'JavaScript' },
  { id: 'node',   label: 'Node.js'    },
  { id: 'python', label: 'Python'     },
  { id: 'php',    label: 'PHP'        },
  { id: 'ruby',   label: 'Ruby'       },
  { id: 'go',     label: 'Go'         },
  { id: 'java',   label: 'Java'       },
];

const DOC_SECTIONS: { id: DocSection; label: string }[] = [
  { id: 'quickstart', label: 'Pierwsze kroki'  },
  { id: 'auth',       label: 'Autentykacja'    },
  { id: 'oauth2',     label: 'OAuth2 Flow'     },
  { id: 'users',      label: 'Użytkownicy'     },
  { id: 'guilds',     label: 'Serwery'         },
  { id: 'channels',   label: 'Kanały'          },
  { id: 'messages',   label: 'Wiadomości'      },
  { id: 'bot',        label: 'Bot API'         },
  { id: 'errors',     label: 'Błędy & Limity' },
];

function codeSample(lang: DocLang, opts: {
  method?: string; url: string; token?: string; tokenType?: 'Bot' | 'Bearer';
  body?: Record<string, any>; comment?: string;
}): string {
  const m = opts.method || 'GET';
  const u = opts.url;
  const auth = opts.token ? `${opts.tokenType || 'Bot'} ${opts.token}` : 'Bot SEJ_TOKEN_BOTA';
  const bd = opts.body ? JSON.stringify(opts.body, null, 2) : null;

  switch (lang) {
    case 'curl': return [
      opts.comment ? `# ${opts.comment}` : '',
      `curl -X ${m} "${u}" \\`,
      `  -H "Authorization: ${auth}"`,
      ...(bd ? ['  -H "Content-Type: application/json" \\', `  -d '${bd}'`] : []),
    ].filter(Boolean).join('\n');

    case 'js': return [
      opts.comment ? `// ${opts.comment}` : '',
      `const res = await fetch('${u}', {`,
      `  method: '${m}',`,
      `  headers: {`,
      `    'Authorization': '${auth}',`,
      ...(bd ? [`    'Content-Type': 'application/json',`] : []),
      `  },`,
      ...(bd ? [`  body: JSON.stringify(${bd}),`] : []),
      `});`,
      `const data = await res.json();`,
      `console.log(data);`,
    ].filter(Boolean).join('\n');

    case 'node': return [
      opts.comment ? `// ${opts.comment}` : '',
      `const axios = require('axios');`,
      ``,
      `const { data } = await axios.${m.toLowerCase()}('${u}',`,
      ...(bd ? [`  ${bd},`] : []),
      `  { headers: { Authorization: '${auth}' } }`,
      `);`,
      `console.log(data);`,
    ].filter(Boolean).join('\n');

    case 'python': return [
      opts.comment ? `# ${opts.comment}` : '',
      `import requests`,
      ``,
      `headers = {'Authorization': '${auth}'}`,
      ...(bd ? [`payload = ${JSON.stringify(opts.body, null, 2).replace(/"/g, "'")}`] : []),
      `r = requests.${m.toLowerCase()}(`,
      `    '${u}',`,
      `    headers=headers,`,
      ...(bd ? [`    json=payload`] : []),
      `)`,
      `print(r.json())`,
    ].filter(Boolean).join('\n');

    case 'php': return [
      opts.comment ? `// ${opts.comment}` : '',
      `<?php`,
      `use GuzzleHttp\\Client;`,
      ``,
      `$client = new Client();`,
      `$response = $client->${m === 'GET' ? 'get' : m === 'POST' ? 'post' : m.toLowerCase()}('${u}', [`,
      `    'headers' => ['Authorization' => '${auth}'],`,
      ...(bd ? [`    'json'    => ${JSON.stringify(opts.body)},`] : []),
      `]);`,
      `$data = json_decode($response->getBody(), true);`,
      `print_r($data);`,
    ].filter(Boolean).join('\n');

    case 'ruby': return [
      opts.comment ? `# ${opts.comment}` : '',
      `require 'httparty'`,
      ``,
      `response = HTTParty.${m.toLowerCase()}(`,
      `  '${u}',`,
      `  headers: { 'Authorization' => '${auth}'${bd ? ", 'Content-Type' => 'application/json'" : ''} }${bd ? `,\n  body: ${JSON.stringify(opts.body)}.to_json` : ''}`,
      `)`,
      `puts response.parsed_response`,
    ].filter(Boolean).join('\n');

    case 'go': return [
      opts.comment ? `// ${opts.comment}` : '',
      `package main`,
      ``,
      `import (`,
      `    "fmt"; "io"; "net/http"${bd ? `; "strings"; "encoding/json"` : ''}`,
      `)`,
      ``,
      `func main() {`,
      ...(bd ? [
        `    payload, _ := json.Marshal(${JSON.stringify(opts.body)})`,
        `    req, _ := http.NewRequest("${m}", "${u}", strings.NewReader(string(payload)))`,
        `    req.Header.Set("Content-Type", "application/json")`,
      ] : [
        `    req, _ := http.NewRequest("${m}", "${u}", nil)`,
      ]),
      `    req.Header.Set("Authorization", "${auth}")`,
      `    resp, _ := http.DefaultClient.Do(req)`,
      `    body, _ := io.ReadAll(resp.Body)`,
      `    fmt.Println(string(body))`,
      `}`,
    ].filter(Boolean).join('\n');

    case 'java': return [
      opts.comment ? `// ${opts.comment}` : '',
      `import okhttp3.*;`,
      ``,
      `OkHttpClient client = new OkHttpClient();`,
      ...(bd ? [
        `MediaType JSON = MediaType.get("application/json");`,
        `RequestBody body = RequestBody.create(`,
        `    ${JSON.stringify(JSON.stringify(opts.body))}, JSON);`,
      ] : []),
      `Request request = new Request.Builder()`,
      `    .url("${u}")`,
      `    .addHeader("Authorization", "${auth}")`,
      ...(bd ? [`    .${m.toLowerCase()}(body)`] : [`    .${m === 'GET' ? 'get()' : m.toLowerCase() + '(body)'}`]),
      `    .build();`,
      `Response response = client.newCall(request).execute();`,
      `System.out.println(response.body().string());`,
    ].filter(Boolean).join('\n');

    default: return '';
  }
}

interface DocsTabProps {
  app: DevApplication;
}

function DocsTab({ app }: DocsTabProps) {
  const { copy, copiedKey } = useCopyToClipboard();
  const origin = window.location.origin;
  const [lang, setLang] = useState<DocLang>('curl');
  const [section, setSection] = useState<DocSection>('quickstart');

  const base = `${origin}/api/v1`;

  const CB = (code: string, key: string) => (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <pre style={{ fontFamily: 'monospace', fontSize: 12, background: '#09090b', border: '1px solid #27272a', borderRadius: 8, padding: '14px 14px 14px 14px', color: '#d4d4d8', lineHeight: 1.75, overflowX: 'auto', whiteSpace: 'pre', margin: 0 }}>
        {code}
      </pre>
      <div style={{ position: 'absolute', top: 8, right: 8 }}>
        <CopyButton text={code} copyKey={key} copiedKey={copiedKey} onCopy={copy} />
      </div>
    </div>
  );

  const M = (method: string) => {
    const c: Record<string, string> = { GET: '#4ade80', POST: '#818cf8', PATCH: '#fbbf24', DELETE: '#f87171', PUT: '#fb923c' };
    return <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: c[method] || '#a1a1aa', minWidth: 52, textAlign: 'center' as const, flexShrink: 0 }}>{method}</span>;
  };

  const EP = ({ method, path, desc, auth, params, body, resp }: {
    method: string; path: string; desc: string; auth?: string;
    params?: { name: string; type: string; req: boolean; desc: string }[];
    body?: { name: string; type: string; req: boolean; desc: string }[];
    resp?: string;
  }) => {
    const [open, setOpen] = useState(false);
    const fullUrl = `${origin}${path}`;
    const sampleCode = codeSample(lang, {
      method, url: fullUrl,
      tokenType: auth === 'Bot' ? 'Bot' : 'Bearer',
    });
    return (
      <div style={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
        <button onClick={() => setOpen(o => !o)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}>
          {M(method)}
          <code style={{ fontFamily: 'monospace', fontSize: 12, color: '#d4d4d8', flex: 1 }}>{path}</code>
          {auth && <span style={{ fontSize: 10, padding: '2px 6px', background: auth === 'Bot' ? 'rgba(99,102,241,0.12)' : 'rgba(74,222,128,0.1)', border: `1px solid ${auth === 'Bot' ? 'rgba(99,102,241,0.3)' : 'rgba(74,222,128,0.2)'}`, borderRadius: 4, color: auth === 'Bot' ? '#818cf8' : '#4ade80', flexShrink: 0 }}>{auth}</span>}
          <span style={{ fontSize: 12, color: '#52525b', flexShrink: 0 }}>{desc}</span>
          <span style={{ color: '#52525b', fontSize: 12, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div style={{ padding: '0 14px 14px', borderTop: '1px solid #27272a' }}>
            {params && params.length > 0 && (
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Parametry URL / Query</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #27272a' }}>
                      {['Nazwa','Typ','Wymagany','Opis'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: '#71717a', fontWeight: 600 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {params.map(p => (
                      <tr key={p.name} style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '6px 8px' }}><code style={{ fontFamily: 'monospace', color: '#818cf8' }}>{p.name}</code></td>
                        <td style={{ padding: '6px 8px', color: '#71717a' }}>{p.type}</td>
                        <td style={{ padding: '6px 8px', color: p.req ? '#4ade80' : '#52525b' }}>{p.req ? '✓' : '—'}</td>
                        <td style={{ padding: '6px 8px', color: '#a1a1aa' }}>{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {body && body.length > 0 && (
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Request Body (JSON)</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #27272a' }}>
                      {['Pole','Typ','Wymagane','Opis'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: '#71717a', fontWeight: 600 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map(f => (
                      <tr key={f.name} style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '6px 8px' }}><code style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{f.name}</code></td>
                        <td style={{ padding: '6px 8px', color: '#71717a' }}>{f.type}</td>
                        <td style={{ padding: '6px 8px', color: f.req ? '#4ade80' : '#52525b' }}>{f.req ? '✓' : '—'}</td>
                        <td style={{ padding: '6px 8px', color: '#a1a1aa' }}>{f.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Przykład — {LANGS.find(l => l.id === lang)?.label}</div>
              {CB(sampleCode, `ep_${method}_${path.replace(/\//g, '_')}`)}
            </div>
            {resp && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Przykład odpowiedzi</div>
                {CB(resp, `resp_${method}_${path.replace(/\//g, '_')}`)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const sectionContent: Record<DocSection, React.ReactNode> = {
    quickstart: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>Pierwsze kroki</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a', lineHeight: 1.7 }}>
          Cordyn API jest REST-owym API HTTP z JSON. Boty używają tokenu <code style={{ fontFamily: 'monospace', color: '#818cf8' }}>Authorization: Bot TOKEN</code>, aplikacje użytkownika — <code style={{ fontFamily: 'monospace', color: '#4ade80' }}>Authorization: Bearer OAUTH2_TOKEN</code>.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 24 }}>
          {[
            { l: 'Client ID',   v: app.client_id,                          k: 'qs_cid' },
            { l: 'Base URL',    v: `${origin}/api`,                         k: 'qs_base' },
            { l: 'V1 Base URL', v: `${origin}/api/v1`,                      k: 'qs_v1' },
            { l: 'Auth URL',    v: `${origin}/oauth2/authorize`,             k: 'qs_auth' },
            { l: 'Token URL',   v: `${origin}/api/oauth2/token`,            k: 'qs_tok' },
            { l: 'Rate limit',  v: `${app.rate_limit_tier} tier`,           k: 'qs_rl' },
          ].map(i => (
            <div key={i.k} style={{ padding: '10px 12px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{i.l}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#d4d4d8', wordBreak: 'break-all', marginBottom: 6 }}>{i.v}</div>
              <CopyButton text={i.v} copyKey={i.k} copiedKey={copiedKey} onCopy={copy} />
            </div>
          ))}
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Hello World — pierwsze zapytanie</h3>
        {CB(codeSample(lang, { url: `${origin}/api/v1/@me`, tokenType: 'Bot', comment: 'Pobierz info o własnym bocie' }), 'qs_hello')}
        <div style={{ padding: '14px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Format odpowiedzi</h4>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a' }}>Wszystkie odpowiedzi są JSON. Błędy zwracają pole <code style={{ fontFamily: 'monospace', color: '#f87171' }}>error</code>:</p>
          {CB(`// Sukces (2xx)\n{ "id": "...", "username": "...", ... }\n\n// Błąd (4xx/5xx)\n{ "error": "Opis błędu" }`, 'qs_fmt')}
        </div>
      </div>
    ),

    auth: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>Autentykacja</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a', lineHeight: 1.7 }}>
          API obsługuje dwa schematy autentykacji. Każde zapytanie musi zawierać nagłówek <code style={{ fontFamily: 'monospace', color: '#d4d4d8' }}>Authorization</code>.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {[
            { type: 'Bot TOKEN', color: '#818cf8', bg: 'rgba(99,102,241,0.08)', desc: 'Dla botów — token generowany w Developer Portal. Nie wygasa automatycznie.' },
            { type: 'Bearer TOKEN', color: '#4ade80', bg: 'rgba(74,222,128,0.06)', desc: 'Dla aplikacji OAuth2 — token dostępu uzyskany przez flow Authorization Code. Wygasa po 1h.' },
          ].map(a => (
            <div key={a.type} style={{ padding: '14px 16px', background: a.bg, border: `1px solid ${a.color}30`, borderRadius: 10 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: a.color, marginBottom: 6 }}>{`Authorization: ${a.type}`}</div>
              <p style={{ margin: 0, fontSize: 13, color: '#71717a' }}>{a.desc}</p>
            </div>
          ))}
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Przykład — nagłówek autentykacji</h3>
        {CB(codeSample(lang, { url: `${origin}/api/v1/@me`, comment: 'Bot token' }), 'auth_bot')}
        {CB(codeSample(lang, { url: `${origin}/api/v1/@me`, tokenType: 'Bearer', comment: 'OAuth2 Bearer token' }), 'auth_bearer')}
        <div style={{ padding: '12px 16px', background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#ca8a04' }}>⚠️ Nigdy nie umieszczaj tokenów w kodzie po stronie klienta ani publicznych repozytoriach. Użyj zmiennych środowiskowych (<code style={{ fontFamily: 'monospace' }}>process.env.BOT_TOKEN</code>).</p>
        </div>
      </div>
    ),

    oauth2: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>OAuth2 Flow</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a', lineHeight: 1.7 }}>Cordyn używa standardowego OAuth2 Authorization Code Flow. Poniżej kompletny przykład w wybranym języku.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {[
            { n: '1', t: 'Redirect do autoryzacji', d: `Przekieruj użytkownika na ${origin}/oauth2/authorize z client_id, redirect_uri, scope, response_type=code` },
            { n: '2', t: 'Odbiór code', d: 'Cordyn przekierowuje na Twój redirect_uri z parametrem ?code=AUTHORIZATION_CODE' },
            { n: '3', t: 'Wymiana code → token', d: `POST ${origin}/api/oauth2/token z code, client_id, client_secret (lub PKCE), grant_type=authorization_code` },
            { n: '4', t: 'Użycie tokenu', d: 'Użyj access_token w nagłówku Authorization: Bearer TOKEN. Odnawiaj przez refresh_token.' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12, padding: '12px 14px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#818cf8', flexShrink: 0 }}>{s.n}</div>
              <div><div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', marginBottom: 2 }}>{s.t}</div><div style={{ fontSize: 12, color: '#71717a' }}>{s.d}</div></div>
            </div>
          ))}
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Krok 1 — URL autoryzacji</h3>
        {CB(`${origin}/oauth2/authorize\n  ?client_id=${app.client_id}\n  &response_type=code\n  &redirect_uri=https%3A%2F%2Ftwoja-aplikacja.com%2Fcallback\n  &scope=identify%20guilds`, 'oauth_url')}
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Krok 3 — Wymiana code na token</h3>
        {CB(codeSample(lang, {
          method: 'POST', url: `${origin}/api/oauth2/token`,
          body: { client_id: app.client_id, client_secret: 'CLIENT_SECRET', code: 'AUTHORIZATION_CODE', redirect_uri: 'https://twoja-aplikacja.com/callback', grant_type: 'authorization_code' },
          comment: 'Wymień code na access_token',
        }), 'oauth_token')}
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Przykład odpowiedzi</h3>
        {CB(`{\n  "access_token": "eyJhbGciOiJIUzI1...",\n  "token_type": "Bearer",\n  "expires_in": 3600,\n  "refresh_token": "refresh_...",\n  "scope": "identify guilds"\n}`, 'oauth_resp')}
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Odnawianie tokenu (refresh)</h3>
        {CB(codeSample(lang, {
          method: 'POST', url: `${origin}/api/oauth2/token`,
          body: { client_id: app.client_id, client_secret: 'CLIENT_SECRET', refresh_token: 'REFRESH_TOKEN', grant_type: 'refresh_token' },
          comment: 'Odnów access_token bez ponownego logowania',
        }), 'oauth_refresh')}
      </div>
    ),

    users: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>Użytkownicy</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a' }}>Endpointy do pobierania danych użytkowników. Scope <code style={{ fontFamily: 'monospace', color: '#818cf8' }}>identify</code> wymagany dla /@me.</p>
        <EP method="GET" path="/api/v1/@me" desc="Własny profil bota/użytkownika" auth="Bot/Bearer"
          resp={`{\n  "id": "550e8400-e29b-41d4-a716-446655440000",\n  "username": "moj_bot",\n  "avatar_url": null,\n  "is_bot": true,\n  "custom_status": "Bot dla MojejAplikacji",\n  "created_at": "2025-01-01T00:00:00.000Z"\n}`} />
        <EP method="GET" path="/api/v1/@me/guilds" desc="Serwery do których należy bot/użytkownik" auth="Bot/Bearer"
          resp={`[\n  {\n    "id": "guild-id",\n    "name": "Nazwa Serwera",\n    "icon_url": null,\n    "member_count": 42,\n    "role_name": "Bot"\n  }\n]`} />
        <EP method="GET" path="/api/v1/users/:userId" desc="Publiczny profil użytkownika" auth="Bot"
          params={[{ name: 'userId', type: 'UUID', req: true, desc: 'ID użytkownika' }]}
          resp={`{\n  "id": "...",\n  "username": "graczek",\n  "avatar_url": "https://...",\n  "is_bot": false\n}`} />
      </div>
    ),

    guilds: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>Serwery (Guilds)</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a' }}>Bot ma dostęp tylko do serwerów, na których jest zainstalowany. Wszystkie zapytania sprawdzają przynależność.</p>
        <EP method="GET" path="/api/v1/guilds/:guildId" desc="Dane serwera" auth="Bot"
          params={[{ name: 'guildId', type: 'UUID', req: true, desc: 'ID serwera' }]}
          resp={`{\n  "id": "...",\n  "name": "Mój Serwer",\n  "icon_url": null,\n  "owner_id": "...",\n  "member_count": 150,\n  "created_at": "2025-01-01T00:00:00.000Z"\n}`} />
        <EP method="GET" path="/api/v1/guilds/:guildId/channels" desc="Lista kanałów serwera" auth="Bot"
          resp={`[\n  {\n    "id": "...",\n    "name": "general",\n    "type": "text",\n    "position": 0,\n    "category_id": null\n  }\n]`} />
        <EP method="GET" path="/api/v1/guilds/:guildId/members" desc="Lista członków (paginowana)" auth="Bot"
          params={[
            { name: 'guildId', type: 'UUID', req: true, desc: 'ID serwera' },
            { name: 'limit',   type: 'int',  req: false, desc: 'Max wyników (domyślnie 50, max 100)' },
            { name: 'after',   type: 'UUID', req: false, desc: 'Paginacja — pobierz po tym user_id' },
          ]}
          resp={`[\n  {\n    "user_id": "...",\n    "username": "graczek",\n    "avatar_url": null,\n    "role_name": "Member",\n    "joined_at": "2025-01-01T00:00:00.000Z"\n  }\n]`} />
        <EP method="GET" path="/api/v1/guilds/:guildId/roles" desc="Lista ról serwera" auth="Bot"
          resp={`[\n  {\n    "id": "...",\n    "name": "Moderator",\n    "color": "#ff0000",\n    "position": 2,\n    "permissions": ["kick_members","ban_members"]\n  }\n]`} />
      </div>
    ),

    channels: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>Kanały</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a' }}>Odczyt i zarządzanie kanałami. Bot musi być w serwerze, do którego należy kanał.</p>
        <EP method="GET" path="/api/v1/channels/:channelId" desc="Dane kanału" auth="Bot"
          params={[{ name: 'channelId', type: 'UUID', req: true, desc: 'ID kanału' }]}
          resp={`{\n  "id": "...",\n  "name": "general",\n  "type": "text",\n  "server_id": "...",\n  "topic": "Kanał ogólny",\n  "slowmode_seconds": 0\n}`} />
        <EP method="GET" path="/api/v1/channels/:channelId/messages" desc="Historia wiadomości" auth="Bot"
          params={[
            { name: 'channelId', type: 'UUID', req: true,  desc: 'ID kanału' },
            { name: 'limit',     type: 'int',  req: false, desc: 'Max wiadomości (domyślnie 50, max 100)' },
            { name: 'before',    type: 'UUID', req: false, desc: 'Pobierz wiadomości przed tym ID' },
            { name: 'after',     type: 'UUID', req: false, desc: 'Pobierz wiadomości po tym ID' },
          ]}
          resp={`[\n  {\n    "id": "...",\n    "content": "Cześć!",\n    "author": { "id": "...", "username": "graczek" },\n    "created_at": "2025-01-01T12:00:00.000Z",\n    "attachments": [],\n    "reactions": []\n  }\n]`} />
      </div>
    ),

    messages: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>Wiadomości</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a' }}>Wysyłanie, edycja i usuwanie wiadomości. Scope <code style={{ fontFamily: 'monospace', color: '#818cf8' }}>messages.send</code> wymagany dla botów OAuth2.</p>
        <EP method="POST" path="/api/v1/channels/:channelId/messages" desc="Wyślij wiadomość" auth="Bot"
          body={[
            { name: 'content',    type: 'string', req: false, desc: 'Treść wiadomości (max 2000 znaków)' },
            { name: 'embed',      type: 'object', req: false, desc: 'Rich embed — {title, description, color, fields[], footer}' },
            { name: 'reply_to',   type: 'UUID',   req: false, desc: 'ID wiadomości, na którą odpowiadasz' },
            { name: 'mentions',   type: 'UUID[]', req: false, desc: 'Tablica ID użytkowników do wzmianki' },
          ]}
          resp={`{\n  "id": "...",\n  "content": "Cześć ze strony bota!",\n  "author": { "id": "bot-id", "username": "moj_bot", "is_bot": true },\n  "created_at": "2025-01-01T12:00:00.000Z"\n}`} />
        <EP method="DELETE" path="/api/v1/channels/:channelId/messages/:messageId" desc="Usuń wiadomość bota" auth="Bot"
          params={[
            { name: 'channelId', type: 'UUID', req: true, desc: 'ID kanału' },
            { name: 'messageId', type: 'UUID', req: true, desc: 'ID wiadomości (musi być własnością bota)' },
          ]}
          resp={`{ "success": true }`} />
        <EP method="PUT"  path="/api/v1/channels/:channelId/messages/:messageId/reactions/:emoji" desc="Dodaj reakcję emoji" auth="Bot"
          params={[
            { name: 'channelId', type: 'UUID',   req: true, desc: 'ID kanału' },
            { name: 'messageId', type: 'UUID',   req: true, desc: 'ID wiadomości' },
            { name: 'emoji',     type: 'string', req: true, desc: 'Emoji URL-encoded, np. %F0%9F%91%8D (👍)' },
          ]}
          resp={`{ "success": true }`} />
        <EP method="DELETE" path="/api/v1/channels/:channelId/messages/:messageId/reactions/:emoji" desc="Usuń reakcję bota" auth="Bot"
          resp={`{ "success": true }`} />
        <div style={{ marginTop: 20, padding: '14px 16px', background: '#18181b', border: '1px solid #27272a', borderRadius: 10 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Embed — pola obiektu</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ borderBottom: '1px solid #27272a' }}>{['Pole','Typ','Opis'].map(h => <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: '#71717a' }}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                { f: 'title',       t: 'string',   d: 'Tytuł embeda (max 256 znaków)' },
                { f: 'description', t: 'string',   d: 'Opis (max 4096 znaków, obsługa markdown)' },
                { f: 'color',       t: 'string',   d: 'Kolor paska bocznego w formacie #RRGGBB' },
                { f: 'url',         t: 'string',   d: 'URL linku na tytule' },
                { f: 'thumbnail',   t: 'string',   d: 'URL miniaturki (prawy górny róg)' },
                { f: 'image',       t: 'string',   d: 'URL obrazka w treści' },
                { f: 'fields',      t: 'Field[]',  d: '[{name, value, inline?}] — max 25 pól' },
                { f: 'footer',      t: 'object',   d: '{text, icon_url?} — stopka embeda' },
                { f: 'timestamp',   t: 'ISO 8601', d: 'Data wyświetlana w stopce' },
              ].map(r => (
                <tr key={r.f} style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '5px 8px' }}><code style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{r.f}</code></td>
                  <td style={{ padding: '5px 8px', color: '#71717a' }}>{r.t}</td>
                  <td style={{ padding: '5px 8px', color: '#a1a1aa' }}>{r.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),

    bot: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>Bot API</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a', lineHeight: 1.7 }}>
          Boty używają prefiksu <code style={{ fontFamily: 'monospace', color: '#818cf8' }}>/api/v1/</code> z tokenem <code style={{ fontFamily: 'monospace' }}>Authorization: Bot TOKEN</code>. Mają dostęp tylko do serwerów, na których są zainstalowane.
        </p>
        <div style={{ padding: '14px 16px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, marginBottom: 20 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Uprawnienia bota</h4>
          <p style={{ margin: '0 0 8px', fontSize: 13, color: '#71717a' }}>Bot po dodaniu do serwera automatycznie otrzymuje rolę <code style={{ fontFamily: 'monospace', color: '#818cf8' }}>Bot</code> i zakres <code style={{ fontFamily: 'monospace' }}>bot messages.read messages.send reactions</code>.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              { s: 'messages.read',  d: 'Odczyt wiadomości z kanałów' },
              { s: 'messages.send',  d: 'Wysyłanie wiadomości' },
              { s: 'reactions',      d: 'Dodawanie/usuwanie reakcji' },
              { s: 'members.read',   d: 'Odczyt listy członków' },
            ].map(p => (
              <div key={p.s} style={{ padding: '6px 10px', background: '#18181b', borderRadius: 6, fontSize: 12 }}>
                <code style={{ fontFamily: 'monospace', color: '#818cf8' }}>{p.s}</code>
                <span style={{ color: '#71717a', marginLeft: 8 }}>{p.d}</span>
              </div>
            ))}
          </div>
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Przykład — Bot wysyłający wiadomość powitalną</h3>
        {CB(codeSample(lang, {
          method: 'POST',
          url: `${origin}/api/v1/channels/CHANNEL_ID/messages`,
          body: {
            content: 'Cześć! 👋 Jestem botem. Wpisz /help aby zobaczyć komendy.',
            embed: { title: 'Witaj na serwerze!', description: 'Miło Cię widzieć.', color: '#6366f1' },
          },
          comment: 'Bot wysyła wiadomość powitalną',
        }), 'bot_hello')}
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Przykład — Pobierz ostatnie wiadomości i odpowiedz</h3>
        {CB(codeSample(lang, {
          url: `${origin}/api/v1/channels/CHANNEL_ID/messages?limit=10`,
          comment: 'Pobierz ostatnie 10 wiadomości z kanału',
        }), 'bot_msgs')}
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Wskazówki dla botów</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { t: 'Nie odpowiadaj na własne wiadomości', d: 'Sprawdzaj czy author.is_bot === false przed odpowiedzią — unikniesz pętli.' },
            { t: 'Przechowuj token bezpiecznie', d: 'Użyj zmiennych środowiskowych: process.env.BOT_TOKEN lub .env + dotenv.' },
            { t: 'Obsługuj rate limiting', d: 'Sprawdzaj nagłówki X-RateLimit-*. Przy 429 czekaj X-RateLimit-Reset ms.' },
            { t: 'Używaj webhook zamiast pollingu', d: 'Zamiast co chwilę pytać o nowe wiadomości, podłącz Socket.IO do zdarzeń realtime.' },
          ].map((t, i) => (
            <div key={i} style={{ padding: '10px 14px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5', marginBottom: 2 }}>{t.t}</div>
              <div style={{ fontSize: 12, color: '#71717a' }}>{t.d}</div>
            </div>
          ))}
        </div>
      </div>
    ),

    errors: (
      <div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#f4f4f5' }}>Błędy & Rate Limiting</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#71717a' }}>API używa standardowych kodów HTTP. Wszystkie błędy zwracają JSON z polem <code style={{ fontFamily: 'monospace', color: '#f87171' }}>error</code>.</p>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Kody odpowiedzi HTTP</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { code: 200, color: '#4ade80', desc: 'OK — zapytanie zakończone sukcesem' },
              { code: 201, color: '#4ade80', desc: 'Created — zasób utworzony pomyślnie' },
              { code: 204, color: '#4ade80', desc: 'No Content — sukces bez treści odpowiedzi' },
              { code: 400, color: '#fbbf24', desc: 'Bad Request — nieprawidłowe parametry lub body' },
              { code: 401, color: '#f87171', desc: 'Unauthorized — brak lub nieprawidłowy token' },
              { code: 403, color: '#f87171', desc: 'Forbidden — brak uprawnień do zasobu' },
              { code: 404, color: '#f87171', desc: 'Not Found — zasób nie istnieje lub bot nie ma do niego dostępu' },
              { code: 409, color: '#fb923c', desc: 'Conflict — zasób już istnieje (np. bot już na serwerze)' },
              { code: 422, color: '#fb923c', desc: 'Unprocessable Entity — błąd walidacji (szczegóły w errors[])' },
              { code: 429, color: '#f87171', desc: 'Too Many Requests — przekroczono limit zapytań' },
              { code: 500, color: '#f87171', desc: 'Internal Server Error — błąd po stronie serwera' },
            ].map(e => (
              <div key={e.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}>
                <code style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: e.color, minWidth: 36 }}>{e.code}</code>
                <span style={{ fontSize: 13, color: '#a1a1aa' }}>{e.desc}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#f4f4f5' }}>Rate Limiting</h3>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#71717a' }}>
            Twój plan: <strong style={{ color: '#818cf8' }}>{app.rate_limit_tier}</strong> — 50 req/s per aplikacja. Limity w nagłówkach odpowiedzi:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { h: 'X-RateLimit-Limit',     d: 'Maksymalna liczba zapytań w oknie' },
              { h: 'X-RateLimit-Remaining', d: 'Pozostałe zapytania w bieżącym oknie' },
              { h: 'X-RateLimit-Reset',     d: 'Unix timestamp (ms) resetu okna' },
              { h: 'Retry-After',           d: 'Sekundy oczekiwania przy 429' },
            ].map(r => (
              <div key={r.h} style={{ padding: '8px 12px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8 }}>
                <code style={{ fontFamily: 'monospace', fontSize: 11, color: '#818cf8' }}>{r.h}</code>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#71717a' }}>{r.d}</p>
              </div>
            ))}
          </div>
          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Obsługa 429 w kodzie</h4>
          {CB(codeSample(lang, { url: `${origin}/api/v1/@me`, comment: 'Przykład obsługi rate limit — retry po Retry-After' }), 'err_rl')}
        </div>
        <div style={{ padding: '14px 16px', background: '#18181b', border: '1px solid #27272a', borderRadius: 10 }}>
          <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Przykładowe odpowiedzi błędów</h4>
          {CB(`// 401 Unauthorized\n{ "error": "Invalid or expired token" }\n\n// 403 Forbidden\n{ "error": "Bot is not a member of this server" }\n\n// 422 Validation Error\n{ "error": "Validation failed", "errors": [{ "field": "content", "msg": "Content is required" }] }\n\n// 429 Rate Limited\n{ "error": "Too many requests, slow down" }`, 'err_examples')}
        </div>
      </div>
    ),
  };

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 500 }}>
      {/* Left nav */}
      <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid #1c1c1f' }}>
        <div style={{ padding: '8px 0' }}>
          <div style={{ padding: '4px 16px 8px', fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Sekcje
          </div>
          {DOC_SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              width: '100%', display: 'block', textAlign: 'left',
              padding: '7px 16px',
              background: section === s.id ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: 'none',
              borderLeft: `3px solid ${section === s.id ? '#6366f1' : 'transparent'}`,
              color: section === s.id ? '#a5b4fc' : '#71717a',
              fontSize: 13, fontWeight: section === s.id ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.1s',
            }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', minWidth: 0 }}>
        {/* Language tabs */}
        <div style={{
          display: 'flex', gap: 2, marginBottom: 24, flexWrap: 'wrap',
          borderBottom: '1px solid #1c1c1f', paddingBottom: 16,
        }}>
          <span style={{ fontSize: 12, color: '#52525b', alignSelf: 'center', marginRight: 8 }}>Język:</span>
          {LANGS.map(l => (
            <button key={l.id} onClick={() => setLang(l.id)} style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: lang === l.id ? '#6366f1' : 'transparent',
              border: `1px solid ${lang === l.id ? '#6366f1' : '#27272a'}`,
              color: lang === l.id ? '#fff' : '#71717a',
              cursor: 'pointer', transition: 'all 0.1s',
            }}>
              {l.label}
            </button>
          ))}
        </div>

        {sectionContent[section]}
      </div>
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
  const [viewMode, setViewMode] = useState<'app' | 'docs'>('app');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isLoggedIn = !!(localStorage.getItem('cordyn_token') || sessionStorage.getItem('cordyn_token'));

  const loadApps = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const list = await devApi.listApps();
      setApps(list);
      if (list.length > 0 && !selectedApp) setSelectedApp(list[0]);
    } catch (err: any) {
      setError(err.message || 'Błąd ładowania');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadApps(); }, [loadApps]);

  const handleCreate = async (name: string, desc: string) => {
    const created = await devApi.createApp(name, desc);
    setApps(prev => [...prev, created]);
    setSelectedApp(created);
    setViewMode('app');
    setShowNewModal(false);
    setCreatedSecret(created.client_secret || null);
    setSidebarOpen(false);
  };

  const handleSelectApp = (app: DevApplication) => {
    setSelectedApp(app);
    setViewMode('app');
    setTab('general');
    setSidebarOpen(false);
  };

  const handleUpdateApp = (updated: DevApplication) => {
    setApps(prev => prev.map(a => a.id === updated.id ? updated : a));
    setSelectedApp(updated);
  };

  const handleDeleteApp = async () => {
    if (!selectedApp) return;
    if (!window.confirm(`Usunąć aplikację "${selectedApp.name}"? Ta akcja jest nieodwracalna.`)) return;
    try {
      await devApi.deleteApp(selectedApp.id);
      const remaining = apps.filter(a => a.id !== selectedApp.id);
      setApps(remaining);
      setSelectedApp(remaining[0] || null);
    } catch (err: any) { alert('Błąd: ' + err.message); }
  };

  const appTabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'Ogólne'  },
    { id: 'bot',     label: 'Bot'     },
    { id: 'oauth2',  label: 'OAuth2'  },
  ];

  const sidebar = (
    <aside style={{
      width: 220, minWidth: 220, borderRight: '1px solid #18181b',
      background: '#09090b', display: 'flex', flexDirection: 'column',
      overflowY: 'auto', position: 'sticky', top: 56,
      height: 'calc(100vh - 56px)', zIndex: 50,
      transform: sidebarOpen ? 'translateX(0)' : undefined,
    }}>
      {/* Dokumentacja button */}
      <div style={{ padding: '12px 10px 4px' }}>
        <button
          onClick={() => { setViewMode('docs'); setSidebarOpen(false); }}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            background: viewMode === 'docs' ? 'rgba(99,102,241,0.12)' : 'transparent',
            border: viewMode === 'docs' ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
            color: viewMode === 'docs' ? '#818cf8' : '#71717a',
            fontSize: 13, fontWeight: viewMode === 'docs' ? 600 : 400,
            transition: 'all 0.1s',
          }}
        >
          <CodeIcon /> Dokumentacja API
        </button>
      </div>

      <div style={{ margin: '8px 10px', borderBottom: '1px solid #18181b' }} />

      {/* New app */}
      <div style={{ padding: '0 10px 8px' }}>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8,
            color: '#818cf8', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          <PlusIcon /> Nowa aplikacja
        </button>
      </div>

      {/* App list */}
      <div style={{ padding: '0 10px', flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#3f3f46', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '4px 4px 6px' }}>
          Twoje aplikacje
        </div>
        {loading ? (
          <div style={{ padding: '8px 4px', color: '#52525b', fontSize: 13 }}>Ładowanie...</div>
        ) : error ? (
          <div style={{ padding: '8px 4px', color: '#f87171', fontSize: 12 }}>{error}</div>
        ) : apps.length === 0 ? (
          <div style={{ padding: '8px 4px', color: '#52525b', fontSize: 13 }}>Brak aplikacji.</div>
        ) : apps.map(app => {
          const active = viewMode === 'app' && selectedApp?.id === app.id;
          return (
            <button key={app.id} onClick={() => handleSelectApp(app)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
              background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: active ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
              color: active ? '#a5b4fc' : '#a1a1aa',
              fontSize: 13, fontWeight: active ? 600 : 400,
              marginBottom: 1, textAlign: 'left', transition: 'all 0.1s',
            }}>
              {app.icon_url ? (
                <img src={app.icon_url} alt="" style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: active ? 'rgba(99,102,241,0.25)' : '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: active ? '#818cf8' : '#71717a' }}>
                  {app.name[0].toUpperCase()}
                </div>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{app.name}</span>
              {app.is_verified && <span style={{ color: '#4ade80', flexShrink: 0 }}><CheckIcon /></span>}
            </button>
          );
        })}
      </div>
    </aside>
  );

  if (!isLoggedIn) {
    return (
      <div style={{ background: '#09090b', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f4f4f5', margin: '0 0 10px' }}>Wymagane logowanie</h1>
          <p style={{ fontSize: 14, color: '#71717a', margin: '0 0 28px', lineHeight: 1.6 }}>
            Dostęp do portalu dla deweloperów wymaga zalogowanego konta Cordyn.
          </p>
          <a href="/" style={{ display: 'inline-block', padding: '10px 24px', background: '#6366f1', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            Przejdź do logowania
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#09090b', color: '#f4f4f5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{
        height: 52, borderBottom: '1px solid #18181b',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', position: 'sticky', top: 0,
        background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(8px)', zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setSidebarOpen(o => !o)}
            style={{ display: 'none', padding: 6, background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer' }}
            className="mobile-menu-btn">
            {sidebarOpen ? <XIcon /> : <MenuIcon />}
          </button>
          <img src="/cordyn.png" alt="Cordyn" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'contain' }}/>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#f4f4f5' }}>Cordyn</span>
          <span style={{ color: '#27272a', fontSize: 15 }}>/</span>
          <span style={{ fontSize: 13, color: '#52525b' }}>Developer Portal</span>
        </div>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#52525b', textDecoration: 'none', padding: '5px 10px', border: '1px solid #27272a', borderRadius: 6 }}>
          <ExternalLinkIcon /> Do aplikacji
        </a>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 49, top: 52 }} />
        )}

        {sidebar}

        {/* Main */}
        {viewMode === 'docs' ? (
          /* ── DOKUMENTACJA — pełna szerokość ── */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Docs header bar */}
            <div style={{ padding: '16px 32px', borderBottom: '1px solid #18181b', background: '#09090b', flexShrink: 0 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f4f4f5' }}>Dokumentacja API</h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#52525b' }}>
                Pełna dokumentacja Cordyn API — endpointy, autentykacja, przykłady kodu.
                {selectedApp && <> Client ID: <code style={{ fontFamily: 'monospace', color: '#a5b4fc' }}>{selectedApp.client_id}</code></>}
              </p>
            </div>
            {/* Docs content — takes remaining height */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
              <DocsTab app={selectedApp || { client_id: 'TWÓJ_CLIENT_ID', rate_limit_tier: 'free' } as any} />
            </div>
          </div>
        ) : (
          /* ── APP SETTINGS ── */
          <main style={{ flex: 1, overflowY: 'auto', padding: '28px 36px', maxWidth: 820 }}>
            {!selectedApp ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '55%', gap: 14, textAlign: 'center' }}>
                <div style={{ color: '#27272a' }}>
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
                  </svg>
                </div>
                <div>
                  <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#52525b' }}>Wybierz aplikację</h2>
                  <p style={{ margin: '0 0 18px', fontSize: 14, color: '#3f3f46' }}>Kliknij aplikację na liście lub utwórz nową.</p>
                  <button onClick={() => setShowNewModal(true)} style={{ ...btnPrimary }}>
                    <PlusIcon /> Utwórz aplikację
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* App header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {selectedApp.icon_url ? (
                      <img src={selectedApp.icon_url} alt="" style={{ width: 48, height: 48, borderRadius: 12 }} />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>
                        {selectedApp.name[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {selectedApp.name}
                        {selectedApp.is_verified && <span style={{ color: '#4ade80' }}><CheckIcon /></span>}
                      </h1>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#52525b' }}>
                        {selectedApp.description || 'Brak opisu'} · ID: <code style={{ fontFamily: 'monospace', color: '#3f3f46' }}>{selectedApp.client_id.slice(0, 16)}…</code>
                      </p>
                    </div>
                  </div>
                  <button onClick={handleDeleteApp} style={{ ...btnDanger, fontSize: 12, padding: '6px 12px' }}>
                    <TrashIcon /> Usuń aplikację
                  </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #18181b', marginBottom: 24, gap: 0 }}>
                  {appTabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} style={{
                      padding: '8px 18px', fontSize: 13,
                      fontWeight: tab === t.id ? 600 : 400,
                      color: tab === t.id ? '#a5b4fc' : '#71717a',
                      background: 'transparent', border: 'none',
                      borderBottom: `2px solid ${tab === t.id ? '#6366f1' : 'transparent'}`,
                      cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s',
                    }}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div style={{ background: '#0d0d10', border: '1px solid #1c1c1f', borderRadius: 12, padding: '24px' }}>
                  {tab === 'general' && <GeneralTab app={selectedApp} onUpdate={handleUpdateApp} />}
                  {tab === 'bot'     && <BotTab     app={selectedApp} onUpdate={handleUpdateApp} />}
                  {tab === 'oauth2'  && <OAuth2Tab  app={selectedApp} onUpdate={handleUpdateApp} />}
                </div>
              </>
            )}
          </main>
        )}
      </div>

      {showNewModal && <NewAppModal onClose={() => setShowNewModal(false)} onCreate={handleCreate} />}
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
        input:focus, textarea:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 2px rgba(99,102,241,0.12); }
        button:not(:disabled):hover { opacity: 0.85; }
        @media (max-width: 640px) {
          .mobile-menu-btn { display: flex !important; }
          aside { position: fixed !important; top: 52px !important; left: 0; height: calc(100vh - 52px) !important; transform: translateX(-100%) !important; transition: transform 0.2s ease !important; }
          aside[style*="translateX(0)"] { transform: translateX(0) !important; }
          main { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
