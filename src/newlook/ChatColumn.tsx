import React, { useEffect, useRef } from 'react';
import { Hash, Users, Phone, Send, PhoneOff } from 'lucide-react';
import type { NewLookShellProps } from './types';
import type { MessageFull, DmMessageFull } from '../api';

type Props = Pick<NewLookShellProps,
  'currentUser' | 'staticUrl' | 'renderMsgHTML' | 'activeView' | 'activeCh' |
  'dmConvs' | 'activeDmUserId' | 'channelMsgs' | 'dmMsgs' | 'msgInput' | 'setMsgInput' |
  'onSend' | 'sending' | 'onToggleReaction' | 'inCall' | 'callSummary' | 'onOpenClassicForCall' |
  'serverFull'
>;

const QUICK_EMOJI = ['👍', '❤️', '😂', '🔥', '😮'];

function isSameGroup(a: MessageFull | DmMessageFull, b: MessageFull | DmMessageFull) {
  if (a.sender_id !== b.sender_id) return false;
  return (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) < 5 * 60_000;
}

export function ChatColumn({
  currentUser, staticUrl, renderMsgHTML, activeView, activeCh,
  dmConvs, activeDmUserId, channelMsgs, dmMsgs, msgInput, setMsgInput,
  onSend, sending, onToggleReaction, inCall, callSummary, onOpenClassicForCall,
  serverFull,
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        {!isDm && <Hash size={17} style={{ color: '#8a8aa0' }} />}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
          {subtitle && <p style={{ fontSize: 11.5, color: '#8a8aa0' }}>{subtitle}</p>}
        </div>
        <div style={{ flex: 1 }} />
        <Phone size={16} style={{ color: '#8a8aa0', cursor: 'pointer' }} />
        <Users size={16} style={{ color: '#8a8aa0', cursor: 'pointer' }} />
      </div>

      {/* In-call banner — v1 keeps full call UI (participant tiles, screen
          share) in the classic view rather than re-deriving that fairly
          large piece of state here; this just makes the active call visible
          and reachable instead of silently hiding it. */}
      {inCall && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
          background: 'rgba(99,102,241,0.15)', borderBottom: '1px solid rgba(99,102,241,0.3)', flexShrink: 0,
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
      <div ref={scrollRef} className="nl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const grouped = prev ? isSameGroup(prev, m) : false;
          const isOwn = m.sender_id === currentUser.id;
          const avatar = staticUrl(m.sender_avatar);
          const reactions = 'reactions' in m ? m.reactions : undefined;
          return (
            <div key={m.id} style={{ display: 'flex', gap: 12, marginTop: grouped ? 1 : 14 }}>
              <div style={{ width: 38, flexShrink: 0 }}>
                {!grouped && (
                  <span style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 13, fontWeight: 700 }}>
                    {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.sender_username.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                {!grouped && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{m.sender_username}</span>
                    <span style={{ fontSize: 10.5, color: '#6b6b82' }}>{new Date(m.created_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )}
                {m.content && (
                  <p
                    style={{ fontSize: 14, lineHeight: 1.5, color: '#dcdce6', wordBreak: 'break-word' }}
                    dangerouslySetInnerHTML={{ __html: renderMsgHTML(m.content) }}
                  />
                )}
                {m.attachment_url && (
                  <img src={staticUrl(m.attachment_url) ?? ''} alt="" style={{ maxWidth: 320, maxHeight: 260, borderRadius: 10, marginTop: 6, display: 'block' }} />
                )}
                {reactions && reactions.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, marginTop: 5, flexWrap: 'wrap' }}>
                    {reactions.map(r => (
                      <button
                        key={r.emoji}
                        onClick={(e) => onToggleReaction(m.id, r.emoji, e)}
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
            </div>
          );
        })}
        {msgs.length === 0 && (
          <p style={{ color: '#6b6b82', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Brak wiadomości — napisz pierwszą!</p>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={onSend} style={{ padding: '14px 20px 18px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '10px 14px',
        }}>
          <input
            value={msgInput}
            onChange={e => setMsgInput(e.target.value)}
            placeholder={isDm ? `Napisz do @${title}` : `Napisz na #${title}`}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#e4e4ec', fontSize: 14 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {QUICK_EMOJI.slice(0, 3).map(e => (
              <span key={e} style={{ fontSize: 15, opacity: 0.7, cursor: 'default' }}>{e}</span>
            ))}
          </div>
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
