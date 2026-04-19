import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { messagesApi } from '../api';
import { useStore } from '../store';
import { getSocket } from '../socket';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import type { Message } from '../api';

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

interface ContextMenu {
  msg: Message;
  x: number;
  y: number;
}

export default function Channel() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { messages, setMessages, addMessage, updateMessage, removeMessage, typingUsers, setTyping, currentUser, activeServer } = useStore();

  const channelId = id!;
  const msgs = messages[channelId] ?? [];

  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [channelName, setChannelName] = useState('Kanał');

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => {
    const { channels } = useStore.getState();
    const ch = channels.find((c) => c.id === channelId);
    if (ch) setChannelName(ch.name);
  }, [channelId]);

  useEffect(() => {
    setLoading(true);
    messagesApi
      .list(channelId)
      .then((data) => {
        setMessages(channelId, data);
        scrollToBottom();
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    const socket = getSocket();
    if (socket) {
      socket.emit('join_channel', channelId);

      const onTyping = ({ channel_id, username }: { channel_id: string; username: string }) => {
        if (channel_id !== channelId) return;
        const current = useStore.getState().typingUsers[channelId] ?? [];
        if (!current.includes(username)) setTyping(channelId, [...current, username]);
      };
      const onTypingStop = ({ channel_id, username }: { channel_id: string; username: string }) => {
        if (channel_id !== channelId) return;
        const current = useStore.getState().typingUsers[channelId] ?? [];
        setTyping(channelId, current.filter((u) => u !== username));
      };

      socket.on('user_typing', onTyping);
      socket.on('user_typing_stop', onTypingStop);

      return () => {
        socket.emit('leave_channel', channelId);
        socket.off('user_typing', onTyping);
        socket.off('user_typing_stop', onTypingStop);
      };
    }
  }, [channelId]);

  useEffect(() => {
    scrollToBottom();
  }, [msgs.length]);

  const sendTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing_start', { channel_id: channelId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { channel_id: channelId });
    }, 3000);
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const content = text.trim();
    setText('');
    setReplyTo(null);
    setSending(true);
    try {
      const msg = await messagesApi.send(channelId, content, replyTo?.id);
      addMessage(channelId, msg);
      scrollToBottom();
    } catch (e) {
      console.error(e);
      setText(content);
    } finally {
      setSending(false);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    getSocket()?.emit('typing_stop', { channel_id: channelId });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const openContextMenu = (e: React.MouseEvent | React.TouchEvent, msg: Message) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ msg, x: rect.left, y: rect.top });
  };

  const handleDelete = async (msg: Message) => {
    setContextMenu(null);
    try {
      await messagesApi.delete(msg.id);
      removeMessage(channelId, msg.id);
    } catch (e) {
      console.error(e);
    }
  };

  const typing = typingUsers[channelId] ?? [];

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg }}
      onClick={() => setContextMenu(null)}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px', background: C.bgCard, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: C.textSub, cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: 0 }}>←</button>
        <span style={{ color: C.textMuted, fontSize: 18 }}>#</span>
        <span style={{ color: C.text, fontWeight: 700, fontSize: 16, flex: 1 }}>{channelName}</span>
      </div>

      {/* Messages */}
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
            <Spinner />
          </div>
        ) : msgs.length === 0 ? (
          <div style={{ textAlign: 'center', color: C.textMuted, padding: '48px 24px' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 14 }}>Brak wiadomości. Napisz coś!</div>
          </div>
        ) : (
          msgs.map((msg, idx) => {
            const prev = idx > 0 ? msgs[idx - 1] : null;
            const grouped = prev && prev.sender_id === msg.sender_id;
            const isOwn = msg.sender_id === currentUser?.id;

            return (
              <div
                key={msg.id}
                style={{ padding: grouped ? '2px 16px' : '10px 16px 2px', display: 'flex', gap: 10 }}
                onContextMenu={(e) => openContextMenu(e, msg)}
              >
                <div style={{ width: 36, flexShrink: 0 }}>
                  {!grouped && <Avatar name={msg.sender_username} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {!grouped && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
                      <span style={{ color: C.text, fontWeight: 600, fontSize: 14 }}>{msg.sender_username}</span>
                      <span style={{ color: C.textMuted, fontSize: 11 }}>
                        {format(new Date(msg.created_at), 'HH:mm', { locale: pl })}
                      </span>
                    </div>
                  )}
                  {msg.reply_to_id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, padding: '4px 8px', background: C.bgCard, borderLeft: `2px solid ${C.accent}`, borderRadius: '0 4px 4px 0', fontSize: 12, color: C.textSub }}>
                      <span style={{ fontWeight: 600 }}>{msg.reply_to_username}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg.reply_to_content}</span>
                    </div>
                  )}
                  <div style={{ color: C.text, fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {msg.content}
                    {msg.is_edited && <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 6 }}>(edytowane)</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typing.length > 0 && (
          <div style={{ padding: '4px 62px', color: C.textSub, fontSize: 12, fontStyle: 'italic' }}>
            {typing.join(', ')} {typing.length === 1 ? 'pisze...' : 'piszą...'}
          </div>
        )}
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div style={{ padding: '8px 16px', background: C.bgCard, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ color: C.textSub, fontSize: 12 }}>Odpowiadasz </span>
            <span style={{ color: C.accent, fontSize: 12, fontWeight: 600 }}>{replyTo.sender_username}</span>
            <div style={{ color: C.textMuted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{replyTo.content}</div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 12px', background: C.bgCard, borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'flex-end', flexShrink: 0, paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => { setText(e.target.value); sendTyping(); }}
          onKeyDown={handleKeyDown}
          placeholder="Napisz wiadomość..."
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
            transition: 'background 0.15s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: Math.min(contextMenu.y, window.innerHeight - 160),
            left: Math.min(contextMenu.x, window.innerWidth - 180),
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            overflow: 'hidden',
            zIndex: 200,
            minWidth: 160,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: C.text, fontSize: 14, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => { navigator.clipboard.writeText(contextMenu.msg.content); setContextMenu(null); }}
          >
            Kopiuj
          </button>
          <button
            style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: C.text, fontSize: 14, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => { setReplyTo(contextMenu.msg); setContextMenu(null); inputRef.current?.focus(); }}
          >
            Odpowiedz
          </button>
          {contextMenu.msg.sender_id === currentUser?.id && (
            <button
              style={{ display: 'block', width: '100%', padding: '12px 16px', background: 'none', border: 'none', color: C.danger, fontSize: 14, textAlign: 'left', cursor: 'pointer' }}
              onClick={() => handleDelete(contextMenu.msg)}
            >
              Usuń
            </button>
          )}
        </div>
      )}
    </div>
  );
}
