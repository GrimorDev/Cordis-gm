import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dmsApi, usersApi } from '../api';
import { useStore } from '../store';
import { getSocket } from '../socket';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { DmMessage } from '../api';

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
};

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
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
        flexShrink: 0,
      }}
    >
      {name.charAt(0).toUpperCase()}
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

export default function DM() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { dmMessages, setDmMessages, addDmMessage, currentUser } = useStore();
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUsername, setOtherUsername] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const msgs = dmMessages[userId!] ?? [];

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => {
    if (!userId) return;

    // Get username from conversations or fetch from API
    const { dmConversations } = useStore.getState();
    const conv = dmConversations.find((c) => c.other_user_id === userId);
    if (conv) {
      setOtherUsername(conv.other_username);
    } else {
      usersApi.get(userId).then((u) => setOtherUsername(u.username)).catch(console.error);
    }

    dmsApi
      .messages(userId)
      .then((data) => {
        setDmMessages(userId, data);
        scrollToBottom();
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    const socket = getSocket();
    if (socket) {
      const onNewDm = (msg: DmMessage) => {
        const myId = currentUser?.id;
        const isRelevant =
          (msg.sender_id === userId && msg.sender_id !== myId) ||
          (msg.sender_id === myId);
        if (isRelevant) {
          addDmMessage(userId, msg);
          scrollToBottom();
        }
      };
      socket.on('new_dm', onNewDm);
      return () => { socket.off('new_dm', onNewDm); };
    }
  }, [userId]);

  useEffect(() => { scrollToBottom(); }, [msgs.length]);

  const handleSend = async () => {
    if (!text.trim() || sending || !userId) return;
    const content = text.trim();
    setText('');
    setSending(true);
    try {
      const msg = await dmsApi.send(userId, content);
      addDmMessage(userId, msg);
      scrollToBottom();
    } catch (e) {
      console.error(e);
      setText(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', background: C.bgCard, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: C.textSub, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>←</button>
        {otherUsername && <Avatar name={otherUsername} size={34} />}
        <span style={{ color: C.text, fontWeight: 700, fontSize: 16, flex: 1 }}>{otherUsername || '...'}</span>
      </div>

      {/* Messages */}
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><Spinner /></div>
        ) : msgs.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: '48px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👋</div>
            <div style={{ fontSize: 14 }}>Zacznij rozmowę z {otherUsername}</div>
          </div>
        ) : (
          msgs.map((msg, idx) => {
            const prev = idx > 0 ? msgs[idx - 1] : null;
            const grouped = prev && prev.sender_id === msg.sender_id;
            const isOwn = msg.sender_id === currentUser?.id;

            return (
              <div
                key={msg.id}
                style={{
                  padding: grouped ? '2px 16px' : '10px 16px 2px',
                  display: 'flex',
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                  gap: 10,
                }}
              >
                {!isOwn && (
                  <div style={{ width: 36, flexShrink: 0 }}>
                    {!grouped && <Avatar name={msg.sender_username} />}
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '75%',
                    background: isOwn ? C.accent : C.bgCard,
                    borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '8px 12px',
                  }}
                >
                  {!grouped && !isOwn && (
                    <div style={{ color: C.textSub, fontWeight: 600, fontSize: 12, marginBottom: 2 }}>{msg.sender_username}</div>
                  )}
                  <div style={{ color: C.text, fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.content}</div>
                  <div style={{ color: isOwn ? 'rgba(255,255,255,0.5)' : C.textMuted, fontSize: 10, textAlign: isOwn ? 'right' : 'left', marginTop: 2 }}>
                    {format(new Date(msg.created_at), 'HH:mm', { locale: pl })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', background: C.bgCard, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0, paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Wiadomość do ${otherUsername}...`}
          rows={1}
          style={{
            flex: 1,
            background: C.bgInput,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: '10px 14px',
            color: C.text,
            fontSize: 15,
            resize: 'none',
            outline: 'none',
            lineHeight: 1.4,
            maxHeight: 120,
            overflow: 'auto',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: text.trim() && !sending ? C.accent : 'rgba(99,102,241,0.2)',
            border: 'none',
            cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
