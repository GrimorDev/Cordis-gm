import React, { useEffect, useState } from 'react';
import { Info, Users, StickyNote, Image as ImageIcon, Link2, Phone, Pin, X } from 'lucide-react';
import type { NewLookShellProps } from './types';
import type { ServerMember, MutualServer, MutualFriend, DmConversation, DmMessageFull, UserProfile } from '../api';
import { mutualServersApi, mutualFriendsApi, notesApi, users, dmPinApi } from '../api';

type Props = Pick<NewLookShellProps,
  'staticUrl' | 'activeView' | 'serverFull' | 'members' | 'dmConvs' | 'activeDmUserId' | 'onOpenProfile' | 'dmMsgs'
>;

const IMG_EXT = /\.(jpe?g|png|gif|webp|avif|svg|bmp)(\?.*)?$/i;
const VID_EXT = /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i;
const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const isImgUrl = (u: string) => IMG_EXT.test(u);
const isVidUrl = (u: string) => VID_EXT.test(u);

const STATUS_COLOR: Record<string, string> = {
  online: '#4ade80', idle: '#fbbf24', dnd: '#f87171', offline: '#5a5a70',
};

function MemberRow({ m, staticUrl, onOpenProfile }: { m: ServerMember; staticUrl: (u: string | null | undefined) => string | null; onOpenProfile: (id: string) => void }) {
  const avatar = staticUrl(m.avatar_url);
  return (
    <div onClick={() => onOpenProfile(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 4px', cursor: 'pointer' }}>
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

type DmTab = 'profile' | 'media' | 'links' | 'calls' | 'pinned';

function DmProfilePanel({
  dm, staticUrl, onOpenProfile, dmMsgs,
}: { dm: DmConversation; staticUrl: (u: string | null | undefined) => string | null; onOpenProfile: (id: string) => void; dmMsgs: DmMessageFull[] }) {
  const [tab, setTab] = useState<DmTab>('profile');
  const [mutualServers, setMutualServers] = useState<MutualServer[]>([]);
  const [mutualFriends, setMutualFriends] = useState<MutualFriend[]>([]);
  const [note, setNote] = useState('');
  const [noteLoaded, setNoteLoaded] = useState(false);
  const [fullProfile, setFullProfile] = useState<UserProfile | null>(null);
  const [pinnedMsgs, setPinnedMsgs] = useState<DmMessageFull[]>([]);
  const avatar = staticUrl(dm.other_avatar);

  useEffect(() => {
    setTab('profile');
    setNoteLoaded(false);
    setFullProfile(null);
    mutualServersApi.get(dm.other_user_id).then(setMutualServers).catch(() => setMutualServers([]));
    mutualFriendsApi.get(dm.other_user_id).then(setMutualFriends).catch(() => setMutualFriends([]));
    notesApi.get(dm.other_user_id).then(r => { setNote(r.content || ''); setNoteLoaded(true); }).catch(() => setNoteLoaded(true));
    users.get(dm.other_user_id).then(setFullProfile).catch(() => {});
    dmPinApi.pinned(dm.other_user_id).then(setPinnedMsgs).catch(() => setPinnedMsgs([]));
  }, [dm.other_user_id]);

  const commitNote = () => { notesApi.save(dm.other_user_id, note).catch(() => {}); };

  const mediaItems = dmMsgs.filter(m => {
    if (m.attachment_url && (isImgUrl(m.attachment_url) || isVidUrl(m.attachment_url))) return true;
    const urls = m.content?.match(URL_RE) ?? [];
    return urls.some(u => isImgUrl(u) || isVidUrl(u));
  });
  const linkItems = dmMsgs.filter(m => {
    if (!m.content) return false;
    const urls = m.content.match(URL_RE) ?? [];
    if (urls.length === 0) return false;
    return urls.some(u => !isImgUrl(u) && !isVidUrl(u));
  });
  const callItems = dmMsgs.filter(m => m.sender_id === '__system__' && (
    m.content.includes('📞') || m.content.includes('📹') || /rozmowa (głosowa|wideo)|połączenie nieodebrane/i.test(m.content)
  ));

  const TABS: { id: DmTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'profile', label: 'Profil', icon: <Users size={13} /> },
    { id: 'media', label: 'Media', icon: <ImageIcon size={13} />, count: mediaItems.length },
    { id: 'links', label: 'Linki', icon: <Link2 size={13} />, count: linkItems.length },
    { id: 'calls', label: 'Połączenia', icon: <Phone size={13} />, count: callItems.length },
    { id: 'pinned', label: 'Przypięte', icon: <Pin size={13} />, count: pinnedMsgs.length },
  ];

  return (
    <div className="nl-info nl-glass nl-scroll" style={{ borderRadius: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div onClick={() => onOpenProfile(dm.other_user_id)} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center',
        padding: '20px 16px 14px', cursor: 'pointer', flexShrink: 0,
      }}>
        <span style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 22, fontWeight: 700 }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : dm.other_username.slice(0, 2).toUpperCase()}
        </span>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{dm.other_username}</p>
        {dm.other_custom_status && <p style={{ fontSize: 12, color: '#8a8aa0' }}>{dm.other_custom_status}</p>}
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            title={t.label}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '9px 2px',
              background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
              color: tab === t.id ? '#fff' : '#7a7a92',
            }}
          >
            {t.icon}
            <span style={{ fontSize: 9, fontWeight: 700 }}>{t.count !== undefined ? t.count : ''}</span>
          </button>
        ))}
      </div>

      <div className="nl-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {tab === 'profile' && (
          <>
            {fullProfile?.bio && (
              <p style={{ fontSize: 12.5, color: '#c4c4d4', lineHeight: 1.5, marginBottom: 16 }}>{fullProfile.bio}</p>
            )}
            {fullProfile?.created_at && (
              <p style={{ fontSize: 11, color: '#7a7a92', marginBottom: 16 }}>
                Dołączył{'a'} {new Date(fullProfile.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}

            {mutualServers.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <p style={sectionLabelStyle}>Wspólne serwery — {mutualServers.length}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mutualServers.map(s => {
                    const sIcon = staticUrl(s.icon_url);
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {sIcon ? <img src={sIcon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : s.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12.5, color: '#d0d0dc' }}>{s.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {mutualFriends.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <p style={sectionLabelStyle}>Wspólni znajomi — {mutualFriends.length}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {mutualFriends.map(f => {
                    const fAvatar = staticUrl(f.avatar_url);
                    return (
                      <div key={f.id} onClick={() => onOpenProfile(f.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {fAvatar ? <img src={fAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : f.username.slice(0, 2).toUpperCase()}
                        </span>
                        <span style={{ fontSize: 12.5, color: '#d0d0dc' }}>{f.username}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {noteLoaded && (
              <div>
                <p style={{ ...sectionLabelStyle, display: 'flex', alignItems: 'center', gap: 5 }}><StickyNote size={11} /> Prywatna notatka</p>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  onBlur={commitNote}
                  placeholder="Dodaj notatkę o tej osobie…"
                  rows={3}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 10, color: '#e4e4ec', fontSize: 12.5, padding: 10, resize: 'none', outline: 'none',
                  }}
                />
              </div>
            )}

            <button
              onClick={() => onOpenProfile(dm.other_user_id)}
              style={{
                width: '100%', marginTop: 18, padding: '9px 0', borderRadius: 11, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)', color: '#c4c4d4', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Wyświetl pełny profil
            </button>
          </>
        )}

        {tab === 'media' && (
          mediaItems.length === 0 ? <p style={emptyTabStyle}>Brak mediów.</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {mediaItems.map(m => {
                const src = staticUrl(m.attachment_url) ?? (m.content?.match(URL_RE) ?? [])[0];
                return (
                  <img key={m.id} src={src ?? ''} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, background: '#1a1a24' }} />
                );
              })}
            </div>
          )
        )}

        {tab === 'links' && (
          linkItems.length === 0 ? <p style={emptyTabStyle}>Brak linków.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {linkItems.map(m => (
                <div key={m.id} style={{ fontSize: 12, color: '#c4c4d4' }}>
                  <p style={{ color: '#7a7a92', fontSize: 10.5, marginBottom: 2 }}>{new Date(m.created_at).toLocaleDateString('pl-PL')}</p>
                  <p style={{ wordBreak: 'break-all' }}>{m.content}</p>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'calls' && (
          callItems.length === 0 ? <p style={emptyTabStyle}>Brak historii połączeń.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {callItems.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Phone size={13} color="#7a7a92" />
                  <div>
                    <p style={{ fontSize: 12, color: '#c4c4d4' }}>{m.content}</p>
                    <p style={{ fontSize: 10, color: '#7a7a92' }}>{new Date(m.created_at).toLocaleString('pl-PL')}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'pinned' && (
          pinnedMsgs.length === 0 ? <p style={emptyTabStyle}>Brak przypiętych wiadomości.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pinnedMsgs.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 11.5, fontWeight: 700, color: '#c4c4d4' }}>{m.sender_username}</p>
                    <p style={{ fontSize: 12, color: '#a0a0b8', wordBreak: 'break-word' }}>{m.content}</p>
                  </div>
                  <button
                    onClick={() => dmPinApi.pin(m.id).then(() => setPinnedMsgs(p => p.filter(x => x.id !== m.id))).catch(() => {})}
                    title="Odepnij"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a7a92', display: 'flex', flexShrink: 0 }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

const emptyTabStyle: React.CSSProperties = { fontSize: 12.5, color: '#7a7a92', textAlign: 'center', marginTop: 24 };

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#7a7a92', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8,
};

export function InfoPanel({ staticUrl, activeView, serverFull, members, dmConvs, activeDmUserId, onOpenProfile, dmMsgs }: Props) {
  if (activeView === 'dms') {
    const dm = dmConvs.find(d => d.other_user_id === activeDmUserId);
    if (!dm) return <div className="nl-info nl-glass" style={{ borderRadius: 0 }} />;
    return <DmProfilePanel dm={dm} staticUrl={staticUrl} onOpenProfile={onOpenProfile} dmMsgs={dmMsgs} />;
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
        {online.map(m => <MemberRow key={m.id} m={m} staticUrl={staticUrl} onOpenProfile={onOpenProfile} />)}

        {offline.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#7a7a92', letterSpacing: 0.5, textTransform: 'uppercase', margin: '16px 0 4px' }}>
              Offline — {offline.length}
            </p>
            {offline.map(m => <MemberRow key={m.id} m={m} staticUrl={staticUrl} onOpenProfile={onOpenProfile} />)}
          </>
        )}
      </div>
    </div>
  );
}
