import React, { useEffect, useRef, useState } from 'react';
import {
  Hash, Users, Phone, Send, PhoneOff, Reply, SmilePlus, Pin, Pencil, Trash2, X, Paperclip,
} from 'lucide-react';
import type { NewLookShellProps } from './types';
import type { MessageFull, DmMessageFull } from '../api';

type Props = Pick<NewLookShellProps,
  'currentUser' | 'staticUrl' | 'renderMsgHTML' | 'activeView' | 'activeCh' |
  'dmConvs' | 'activeDmUserId' | 'channelMsgs' | 'dmMsgs' | 'msgInput' | 'setMsgInput' |
  'onSend' | 'sending' | 'onToggleReaction' | 'onDeleteMessage' | 'onEditMessage' | 'onPinMessage' |
  'replyTo' | 'setReplyTo' | 'inCall' | 'callSummary' | 'onOpenClassicForCall' | 'serverFull'
> & { onToggleInfo: () => void };

const QUICK_EMOJI = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

function isSameGroup(a: MessageFull | DmMessageFull, b: MessageFull | DmMessageFull) {
  if (a.sender_id !== b.sender_id) return false;
  return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60_000;
}

function MessageRow({
  msg, isOwn, showHeader, staticUrl, renderMsgHTML, onToggleReaction, onDeleteMessage,
  onEditMessage, onPinMessage, onReply, canPin,
}: {
  msg: MessageFull | DmMessageFull; isOwn: boolean; showHeader: boolean;
  staticUrl: (u: string | null | undefined) => string | null;
  renderMsgHTML: (t: string) => string;
  onToggleReaction: (id: string, emoji: string, evt?: React.MouseEvent) => void;
  onDeleteMessage: (msg: MessageFull | DmMessageFull) => void;
  onEditMessage: (msg: MessageFull | DmMessageFull, content: string) => void;
  onPinMessage: (id: string, pinned: boolean) => void;
  onReply: (msg: MessageFull | DmMessageFull) => void;
  canPin: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.content);
  const avatar = staticUrl(msg.sender_avatar);
  const reactions = 'reactions' in msg ? msg.reactions : undefined;
  const pinned = 'pinned' in msg ? !!msg.pinned : false;

  const commitEdit = () => {
    const trimmed = editVal.trim();
    if (trimmed && trimmed !== msg.content) onEditMessage(msg, trimmed);
    setEditing(false);
  };

  return (
    <div
      style={{ display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row', gap: 10, marginTop: showHeader ? 14 : 2, position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPicking(false); }}
    >
      <div style={{ width: 34, flexShrink: 0 }}>
        {showHeader && (
          <span style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 12, fontWeight: 700 }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : msg.sender_username.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ maxWidth: '62%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
        {showHeader && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 3, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: isOwn ? '#c7c7ff' : '#fff' }}>{isOwn ? 'Ty' : msg.sender_username}</span>
            <span style={{ fontSize: 10, color: '#6b6b82' }}>{new Date(msg.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
            {pinned && <Pin size={10} color="#818cf8" />}
          </div>
        )}

        {msg.reply_to_id && (
          <div style={{
            fontSize: 11, color: '#9797b0', marginBottom: 3, padding: '3px 8px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid rgba(255,255,255,0.15)',
          }}>
            <b style={{ color: '#b0b0c8' }}>{msg.reply_username ?? '?'}</b> {msg.reply_content ?? ''}
          </div>
        )}

        {editing ? (
          <div style={{ width: 260 }}>
            <textarea
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              autoFocus
              rows={2}
              style={{ width: '100%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: 10, color: '#fff', fontSize: 13.5, padding: 8, resize: 'none' }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setEditing(false); }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 4, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(false)} style={{ fontSize: 11, color: '#9797b0', background: 'none', border: 'none', cursor: 'pointer' }}>Anuluj</button>
              <button onClick={commitEdit} style={{ fontSize: 11, color: '#818cf8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Zapisz</button>
            </div>
          </div>
        ) : (
          <>
            {msg.content && (
              <div
                style={{
                  fontSize: 14, lineHeight: 1.5, color: isOwn ? '#fff' : '#e2e2ec', wordBreak: 'break-word',
                  padding: '9px 13px', borderRadius: 16,
                  borderBottomRightRadius: isOwn ? 4 : 16, borderBottomLeftRadius: isOwn ? 16 : 4,
                  background: isOwn ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : 'rgba(255,255,255,0.07)',
                  border: isOwn ? 'none' : '1px solid rgba(255,255,255,0.07)',
                }}
                dangerouslySetInnerHTML={{ __html: renderMsgHTML(msg.content) }}
              />
            )}
            {msg.attachment_url && (
              <img src={staticUrl(msg.attachment_url) ?? ''} alt="" style={{ maxWidth: 260, maxHeight: 220, borderRadius: 14, marginTop: 6, display: 'block' }} />
            )}
          </>
        )}

        {reactions && reactions.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
            {reactions.map(r => (
              <button
                key={r.emoji}
                onClick={(e) => onToggleReaction(msg.id, r.emoji, e)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, borderRadius: 999,
                  padding: '2px 8px', border: `1px solid ${r.mine ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  background: r.mine ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.05)', color: '#e4e4ec', cursor: 'pointer',
                }}
              >
                <span>{r.emoji}</span><span style={{ fontWeight: 600 }}>{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hover action bar */}
      {hovered && !editing && (
        <div style={{
          position: 'absolute', top: -14, [isOwn ? 'right' : 'left']: 44,
          display: 'flex', alignItems: 'center', gap: 2, background: '#181822', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: 3, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', zIndex: 5,
        } as React.CSSProperties}>
          <div style={{ position: 'relative' }}>
            <button title="Reaguj" onClick={() => setPicking(p => !p)} style={actionBtnStyle}><SmilePlus size={14} /></button>
            {picking && (
              <div style={{
                position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', gap: 2, background: '#181822', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}>
                {QUICK_EMOJI.map(e => (
                  <button key={e} onClick={(evt) => { onToggleReaction(msg.id, e, evt); setPicking(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 2 }}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <button title="Odpowiedz" onClick={() => onReply(msg)} style={actionBtnStyle}><Reply size={14} /></button>
          {canPin && <button title={pinned ? 'Odepnij' : 'Przypnij'} onClick={() => onPinMessage(msg.id, !pinned)} style={actionBtnStyle}><Pin size={14} color={pinned ? '#818cf8' : undefined} /></button>}
          {isOwn && <button title="Edytuj" onClick={() => { setEditVal(msg.content); setEditing(true); }} style={actionBtnStyle}><Pencil size={14} /></button>}
          {isOwn && <button title="Usuń" onClick={() => onDeleteMessage(msg)} style={{ ...actionBtnStyle, color: '#f87171' }}><Trash2 size={14} /></button>}
        </div>
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7, background: 'none', border: 'none', color: '#c4c4d4',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};

export function ChatColumn({
  currentUser, staticUrl, renderMsgHTML, activeView, activeCh,
  dmConvs, activeDmUserId, channelMsgs, dmMsgs, msgInput, setMsgInput,
  onSend, sending, onToggleReaction, onDeleteMessage, onEditMessage, onPinMessage,
  replyTo, setReplyTo, inCall, callSummary, onOpenClassicForCall, serverFull, onToggleInfo,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDm = activeView === 'dms';
  const dm = isDm ? dmConvs.find(d => d.other_user_id === activeDmUserId) : null;
  const msgs: (MessageFull | DmMessageFull)[] = isDm ? dmMsgs : channelMsgs;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgs.length]);

  const title = isDm ? (dm?.other_username ?? '') : (activeCh?.name ?? '');
  const subtitle = isDm
    ? (dm?.other_status === 'online' ? 'Online' : 'Offline')
    : (activeCh?.description || (serverFull ? `${serverFull.member_count ?? '?'} członków` : ''));

  if (!title) {
    return (
      <div className="nl-chat" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b6b82', fontSize: 14 }}>Wybierz kanał albo rozmowę, żeby zacząć.</p>
      </div>
    );
  }

  return (
    <div className="nl-chat">
      <div className="nl-glow" />

      {/* Header — glass */}
      <div className="nl-glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0, zIndex: 2 }}>
        {!isDm && <Hash size={17} style={{ color: '#8a8aa0' }} />}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
          {subtitle && <p style={{ fontSize: 11.5, color: '#8a8aa0' }}>{subtitle}</p>}
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onOpenClassicForCall} title="Rozpocznij rozmowę" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <Phone size={16} style={{ color: '#8a8aa0' }} />
        </button>
        <button onClick={onToggleInfo} title="Informacje" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <Users size={16} style={{ color: '#8a8aa0' }} />
        </button>
      </div>

      {inCall && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
          background: 'rgba(99,102,241,0.15)', borderBottom: '1px solid rgba(99,102,241,0.3)', flexShrink: 0, zIndex: 2,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: '#e4e4ec', flex: 1 }}>
            W trakcie rozmowy{callSummary?.channelName ? ` — #${callSummary.channelName}` : callSummary?.username ? ` z ${callSummary.username}` : ''}
          </p>
          <button
            onClick={onOpenClassicForCall}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
          >
            <PhoneOff size={12} /> Otwórz panel rozmowy
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="nl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', position: 'relative', zIndex: 1 }}>
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const grouped = prev ? isSameGroup(prev, m) : false;
          const isOwn = m.sender_id === currentUser.id;
          return (
            <MessageRow
              key={m.id}
              msg={m}
              isOwn={isOwn}
              showHeader={!grouped}
              staticUrl={staticUrl}
              renderMsgHTML={renderMsgHTML}
              onToggleReaction={onToggleReaction}
              onDeleteMessage={onDeleteMessage}
              onEditMessage={onEditMessage}
              onPinMessage={onPinMessage}
              onReply={setReplyTo}
              canPin={!isDm}
            />
          );
        })}
        {msgs.length === 0 && (
          <p style={{ color: '#6b6b82', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Brak wiadomości — napisz pierwszą!</p>
        )}
      </div>

      {/* Composer — glass */}
      <form onSubmit={onSend} style={{ padding: '14px 20px 18px', flexShrink: 0, position: 'relative', zIndex: 2 }}>
        {replyTo && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#a0a0b8',
            background: 'rgba(255,255,255,0.05)', borderRadius: '10px 10px 0 0', padding: '6px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Reply size={12} />
            <span style={{ flex: 1 }}>Odpowiadasz <b style={{ color: '#c4c4d8' }}>{replyTo.sender_username}</b></span>
            <button type="button" onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a8aa0', display: 'flex' }}><X size={13} /></button>
          </div>
        )}
        <div className="nl-glass" style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: replyTo ? '0 0 14px 14px' : 14,
        }}>
          <Paperclip size={16} style={{ color: '#7a7a92', cursor: 'default', flexShrink: 0 }} />
          <input
            value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            placeholder={isDm ? `Napisz do @${title}` : `Napisz na #${title}`}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e4e4ec', fontSize: 14 }}
          />
          <button
            type="submit"
            disabled={sending || !msgInput.trim()}
            style={{
              width: 32, height: 32, borderRadius: 10, background: msgInput.trim() ? '#6366f1' : 'rgba(255,255,255,0.08)',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', cursor: msgInput.trim() ? 'pointer' : 'default', flexShrink: 0,
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
