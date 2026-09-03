import React from 'react';
import { Info, Users } from 'lucide-react';
import type { NewLookShellProps } from './types';
import type { ServerMember } from '../api';

type Props = Pick<NewLookShellProps,
  'staticUrl' | 'activeView' | 'serverFull' | 'members' | 'dmConvs' | 'activeDmUserId'
>;

const STATUS_COLOR: Record<string, string> = {
  online: '#4ade80', idle: '#fbbf24', dnd: '#f87171', offline: '#5a5a70',
};

function MemberRow({ m, staticUrl }: { m: ServerMember; staticUrl: (u: string | null | undefined) => string | null }) {
  const avatar = staticUrl(m.avatar_url);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px' }}>
      <span style={{ position: 'relative', width: 30, height: 30, flexShrink: 0 }}>
        <span style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 11, fontWeight: 700 }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.username.slice(0, 2).toUpperCase()}
        </span>
        <span style={{
          position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%',
          background: STATUS_COLOR[m.status] ?? STATUS_COLOR.offline, border: '2px solid #150816',
        }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: m.roles[0]?.color || '#e4e4ec', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.nickname || m.username}
        </p>
        {m.custom_status && <p style={{ fontSize: 10.5, color: '#7a7a92' }}>{m.custom_status}</p>}
      </div>
    </div>
  );
}

export function InfoPanel({ staticUrl, activeView, serverFull, members, dmConvs, activeDmUserId }: Props) {
  if (activeView === 'dms') {
    const dm = dmConvs.find(d => d.other_user_id === activeDmUserId);
    if (!dm) return <div className="nl-info nl-glass" style={{ borderRadius: 0 }} />;
    const avatar = staticUrl(dm.other_avatar);
    return (
      <div className="nl-info nl-glass nl-scroll" style={{ borderRadius: 0, overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <span style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 24, fontWeight: 700 }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : dm.other_username.slice(0, 2).toUpperCase()}
          </span>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{dm.other_username}</p>
          {dm.other_custom_status && <p style={{ fontSize: 12.5, color: '#8a8aa0' }}>{dm.other_custom_status}</p>}
        </div>
      </div>
    );
  }

  if (!serverFull) return <div className="nl-info nl-glass" style={{ borderRadius: 0 }} />;
  const icon = staticUrl(serverFull.icon_url);
  const sorted = [...members].sort((a, b) => {
    const rank = (s: string) => s === 'online' ? 0 : s === 'idle' ? 1 : s === 'dnd' ? 2 : 3;
    return rank(a.status) - rank(b.status);
  });
  const online = sorted.filter(m => m.status !== 'offline');
  const offline = sorted.filter(m => m.status === 'offline');

  return (
    <div className="nl-info nl-glass nl-scroll" style={{ borderRadius: 0, overflowY: 'auto' }}>
      <div style={{ padding: 20, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
            {icon ? <img src={icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : serverFull.name.slice(0, 2).toUpperCase()}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{serverFull.name}</p>
            <p style={{ fontSize: 11.5, color: '#8a8aa0' }}>{serverFull.member_count ?? members.length} członków</p>
          </div>
        </div>
        {serverFull.description && (
          <p style={{ fontSize: 12, color: '#a0a0b8', marginTop: 10, lineHeight: 1.5, display: 'flex', gap: 6 }}>
            <Info size={12} style={{ flexShrink: 0, marginTop: 2 }} /> {serverFull.description}
          </p>
        )}
      </div>

      <div style={{ padding: '14px 16px' }}>
        <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#7a7a92', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
          <Users size={11} /> Online — {online.length}
        </p>
        {online.map(m => <MemberRow key={m.id} m={m} staticUrl={staticUrl} />)}

        {offline.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7a7a92', letterSpacing: 0.5, textTransform: 'uppercase', margin: '16px 0 4px' }}>
              Offline — {offline.length}
            </p>
            {offline.map(m => <MemberRow key={m.id} m={m} staticUrl={staticUrl} />)}
          </>
        )}
      </div>
    </div>
  );
}
