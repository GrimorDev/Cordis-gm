import React, { useState } from 'react';
import { Hash, Volume2, Megaphone, MessageSquare as ForumIcon, ChevronDown, Search } from 'lucide-react';
import type { NewLookShellProps } from './types';

type Props = Pick<NewLookShellProps,
  'staticUrl' | 'serverFull' | 'activeView' | 'activeChannel' | 'onSelectChannel' |
  'dmConvs' | 'activeDmUserId' | 'unreadDms' | 'onSelectDm'
>;

function channelIcon(type: string) {
  if (type === 'voice') return <Volume2 size={15} />;
  if (type === 'announcement') return <Megaphone size={15} />;
  if (type === 'forum') return <ForumIcon size={15} />;
  return <Hash size={15} />;
}

export function ChannelList({
  staticUrl, serverFull, activeView, activeChannel, onSelectChannel,
  dmConvs, activeDmUserId, unreadDms, onSelectDm,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const toggleCat = (id: string) => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="nl-mgmt nl-glass" style={{ borderRadius: 0 }}>
      <div style={{ padding: '16px 16px 10px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b6b82' }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Szukaj…"
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '9px 12px 9px 34px', fontSize: 13, color: '#e4e4ec', outline: 'none',
            }}
          />
        </div>
      </div>

      <div className="nl-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 10px 12px' }}>
        {activeView === 'dms' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dmConvs.filter(dm => !q || dm.other_username.toLowerCase().includes(q)).map(dm => {
              const active = activeDmUserId === dm.other_user_id;
              const unread = unreadDms[dm.other_user_id] ?? 0;
              const avatar = staticUrl(dm.other_avatar);
              return (
                <button
                  key={dm.id}
                  onClick={() => onSelectDm(dm.other_user_id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10,
                    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left', color: active ? '#fff' : '#c4c4d4',
                  }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#2a2a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                    {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : dm.other_username.slice(0, 2).toUpperCase()}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: unread ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dm.other_username}
                  </span>
                  {unread > 0 && (
                    <span style={{ background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 6px', minWidth: 16, textAlign: 'center' }}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </button>
              );
            })}
            {dmConvs.length === 0 && (
              <p style={{ fontSize: 12, color: '#6b6b82', padding: '12px 8px' }}>Brak rozmów.</p>
            )}
          </div>
        ) : serverFull ? (
          serverFull.categories.map(cat => {
            const filteredChannels = q ? cat.channels.filter(ch => ch.name.toLowerCase().includes(q)) : cat.channels;
            if (q && filteredChannels.length === 0) return null;
            const isCollapsed = !q && collapsed.has(cat.id);
            return (
              <div key={cat.id} style={{ marginTop: 14 }}>
                <button
                  onClick={() => toggleCat(cat.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, width: '100%', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '2px 6px', color: '#7a7a92', fontSize: 11, fontWeight: 700,
                    letterSpacing: 0.6, textTransform: 'uppercase',
                  }}
                >
                  <ChevronDown size={12} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }} />
                  {cat.name}
                </button>
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 4 }}>
                    {filteredChannels.map(ch => {
                      const active = activeChannel === ch.id;
                      const unread = ch.unread_count ?? 0;
                      return (
                        <button
                          key={ch.id}
                          onClick={() => onSelectChannel(ch)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
                            background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
                            border: 'none', cursor: 'pointer', textAlign: 'left',
                            color: active ? '#fff' : unread ? '#e4e4ec' : '#8a8aa0',
                          }}
                        >
                          {channelIcon(ch.type)}
                          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: unread ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ch.name}
                          </span>
                          {unread > 0 && (
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p style={{ fontSize: 12, color: '#6b6b82', padding: '12px 8px' }}>Wybierz serwer.</p>
        )}
      </div>
    </div>
  );
}
