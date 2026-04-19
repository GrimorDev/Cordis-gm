import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { serversApi, channelsApi } from '../api';
import { useStore } from '../store';
import type { Server, Channel } from '../api';

const C = {
  bg: '#09090b',
  bgCard: '#18181b',
  bgInput: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textSub: '#a1a1aa',
  textMuted: '#52525b',
  accent: '#6366f1',
  danger: '#ef4444',
  success: '#22c55e',
};

function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        background: C.accent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function Servers() {
  const navigate = useNavigate();
  const { servers, setServers, channels, setChannels, activeServer, setActiveServer } = useStore();
  const [loading, setLoading] = useState(true);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    serversApi
      .list()
      .then(setServers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openServer = async (server: Server) => {
    setActiveServer(server);
    setChannelsLoading(true);
    try {
      const chs = await channelsApi.list(server.id);
      setChannels(chs);
    } catch (e) {
      console.error(e);
    } finally {
      setChannelsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinError('');
    setJoinLoading(true);
    try {
      const server = await serversApi.join(joinCode.trim());
      setServers([...servers, server]);
      setJoinModal(false);
      setJoinCode('');
      openServer(server);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Błąd dołączania');
    } finally {
      setJoinLoading(false);
    }
  };

  const groupedChannels = React.useMemo(() => {
    const groups: Record<string, Channel[]> = {};
    for (const ch of channels) {
      const key = ch.category_name ?? 'Kanały';
      if (!groups[key]) groups[key] = [];
      groups[key].push(ch);
    }
    return groups;
  }, [channels]);

  if (activeServer) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
        {/* Header */}
        <div
          style={{
            padding: '14px 16px',
            background: C.bgCard,
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button
            onClick={() => setActiveServer(null)}
            style={{ background: 'none', border: 'none', color: C.textSub, cursor: 'pointer', padding: '4px 0', fontSize: 22, lineHeight: 1 }}
          >
            ←
          </button>
          <Avatar name={activeServer.name} size={36} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {activeServer.name}
            </div>
            {activeServer.member_count != null && (
              <div style={{ color: C.textMuted, fontSize: 12 }}>{activeServer.member_count} członków</div>
            )}
          </div>
        </div>

        {/* Channel list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {channelsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <Spinner />
            </div>
          ) : (
            Object.entries(groupedChannels).map(([category, chs]) => (
              <div key={category}>
                <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {category}
                </div>
                {chs.map((ch) => {
                  const isVoice = ch.type === 'voice';
                  return (
                    <button
                      key={ch.id}
                      onClick={() => !isVoice && navigate(`/channel/${ch.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '10px 16px',
                        background: 'none',
                        border: 'none',
                        cursor: isVoice ? 'default' : 'pointer',
                        color: isVoice ? C.textMuted : C.textSub,
                        fontSize: 15,
                        textAlign: 'left',
                        opacity: isVoice ? 0.5 : 1,
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{isVoice ? '🔊' : '#'}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
                      {isVoice && <span style={{ fontSize: 11, color: C.textMuted }}>głosowy</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      {/* Header */}
      <div
        style={{
          padding: '16px',
          background: C.bgCard,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Serwery</h2>
        <button
          onClick={() => setJoinModal(true)}
          style={{
            background: C.accent,
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + Dołącz
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <Spinner />
          </div>
        ) : servers.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: '48px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>Brak serwerów</div>
            <div style={{ fontSize: 14 }}>Dołącz do serwera używając kodu zaproszenia</div>
          </div>
        ) : (
          servers.map((server) => (
            <button
              key={server.id}
              onClick={() => openServer(server)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                borderBottom: `1px solid ${C.border}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <Avatar name={server.name} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: C.text, fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {server.name}
                </div>
                {server.member_count != null && (
                  <div style={{ color: C.textMuted, fontSize: 12 }}>{server.member_count} członków</div>
                )}
              </div>
              <span style={{ color: C.textMuted, fontSize: 18 }}>›</span>
            </button>
          ))
        )}
      </div>

      {/* Join Modal */}
      {joinModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'flex-end',
            zIndex: 100,
          }}
          onClick={() => setJoinModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              margin: '0 auto',
              background: C.bgCard,
              borderRadius: '16px 16px 0 0',
              padding: '24px',
              border: `1px solid ${C.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ color: C.text, fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Dołącz do serwera</h3>
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="Kod zaproszenia..."
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                autoFocus
                style={{
                  background: C.bgInput,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: '12px 14px',
                  color: C.text,
                  fontSize: 15,
                  outline: 'none',
                }}
              />
              {joinError && <div style={{ color: C.danger, fontSize: 13 }}>{joinError}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setJoinModal(false)}
                  style={{ flex: 1, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 0', color: C.textSub, fontSize: 14, cursor: 'pointer' }}
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={joinLoading}
                  style={{ flex: 1, background: C.accent, border: 'none', borderRadius: 8, padding: '12px 0', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  {joinLoading ? 'Dołączanie...' : 'Dołącz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <>
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid rgba(99,102,241,0.2)',
          borderTopColor: C.accent,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}
