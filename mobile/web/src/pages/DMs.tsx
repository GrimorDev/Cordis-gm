import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dmsApi } from '../api';
import { useStore } from '../store';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

const C = {
  bg: '#09090b',
  bgCard: '#18181b',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textSub: '#a1a1aa',
  textMuted: '#52525b',
  accent: '#6366f1',
  success: '#22c55e',
};

function StatusDot({ status }: { status: string }) {
  const color = status === 'online' ? C.success : status === 'idle' ? '#f59e0b' : status === 'dnd' ? '#ef4444' : C.textMuted;
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color,
        border: '2px solid #09090b',
        position: 'absolute',
        bottom: 0,
        right: 0,
      }}
    />
  );
}

function Avatar({ name, status, size = 46 }: { name: string; status: string; size?: number }) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: C.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.38,
          fontWeight: 700,
          color: '#fff',
        }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <StatusDot status={status} />
    </div>
  );
}

function Spinner() {
  return (
    <>
      <div style={{ width: 28, height: 28, border: `3px solid rgba(99,102,241,0.2)`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}

export default function DMs() {
  const navigate = useNavigate();
  const { dmConversations, setDmConversations } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dmsApi
      .conversations()
      .then(setDmConversations)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>
      <div style={{ padding: '16px', background: C.bgCard, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>Wiadomości prywatne</h2>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <Spinner />
          </div>
        ) : dmConversations.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: '48px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💌</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.textSub, marginBottom: 8 }}>Brak wiadomości</div>
            <div style={{ fontSize: 14 }}>Zacznij rozmowę ze znajomymi</div>
          </div>
        ) : (
          dmConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => navigate(`/dm/${conv.other_user_id}`)}
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
              <Avatar name={conv.other_username} status={conv.other_status} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                  <span style={{ color: C.text, fontWeight: 600, fontSize: 15 }}>{conv.other_username}</span>
                  {conv.last_message_at && (
                    <span style={{ color: C.textMuted, fontSize: 11 }}>
                      {format(new Date(conv.last_message_at), 'HH:mm', { locale: pl })}
                    </span>
                  )}
                </div>
                {conv.last_message && (
                  <div style={{ color: C.textMuted, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.last_message}
                  </div>
                )}
              </div>
              {conv.unread_count != null && conv.unread_count > 0 && (
                <div style={{ background: C.accent, borderRadius: 10, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', padding: '0 6px' }}>
                  {conv.unread_count}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
