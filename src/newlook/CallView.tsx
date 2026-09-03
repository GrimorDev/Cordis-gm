import React, { useEffect, useRef } from 'react';
import {
  Mic, MicOff, Headphones, Video, VideoOff, ScreenShare, ScreenShareOff, PhoneOff, Minimize2, Volume2, Phone,
} from 'lucide-react';
import type { CallViewProps } from './types';

/** Native call visual for "Nowy wygląd" — reuses every real handler/ref the
 *  classic call panel uses (toggleMute/toggleDeafen/toggleCamera/toggleScreen/
 *  hangupCall, the WebRTC stream refs) so there's zero duplicated call logic,
 *  only a fresh presentational layer. Deliberately narrower in scope than the
 *  classic panel (no Spotify DJ sync, no voice diagnostics) — the core loop
 *  (see/hear participants, mute/deafen/camera/screen-share/hang up) is real. */

function VideoTile({ stream, mirror }: { stream: MediaStream | null; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  if (!stream) return null;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: mirror ? 'scaleX(-1)' : undefined }}
    />
  );
}

export function CallView({
  activeCall, currentUser, staticUrl, voiceUsers, voiceUserStates,
  cameraOnUserIds, sharingUserIds, cameraStreamRef, screenStreamRef,
  remoteCameraStreamsRef, remoteScreenStreamsRef, screenShareTick,
  onToggleMute, onToggleDeafen, onToggleCamera, onToggleScreen, onHangup, onMinimize,
}: CallViewProps) {
  void screenShareTick; // prop change alone re-renders this component; referenced for clarity

  const isChannel = activeCall.type === 'voice_channel';
  const others = isChannel
    ? voiceUsers.filter(u => u.id !== currentUser.id)
    : (activeCall.userId
        ? [{ id: activeCall.userId, username: activeCall.username ?? '?', avatar_url: activeCall.avatarUrl ?? null, status: 'online' }]
        : []);
  const participants = [
    { id: currentUser.id, username: currentUser.username, avatar_url: currentUser.avatar_url ?? null, status: currentUser.status, isSelf: true },
    ...others.map(u => ({ ...u, isSelf: false })),
  ];

  const title = isChannel ? activeCall.channelName : activeCall.username;
  const subtitle = isChannel ? 'kanał głosowy' : activeCall.type === 'dm_video' ? 'Wideorozmowa' : 'Połączenie głosowe';

  return (
    <div className="nl-chat" style={{ alignItems: 'stretch' }}>
      <div className="nl-glow" />

      <div className="nl-glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px', borderRadius: 0, zIndex: 2 }}>
        {isChannel ? <Volume2 size={16} style={{ color: '#4ade80' }} /> : activeCall.type === 'dm_video' ? <Video size={16} style={{ color: '#818cf8' }} /> : <Phone size={16} style={{ color: '#818cf8' }} />}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</p>
          <p style={{ fontSize: 11.5, color: '#8a8aa0' }}>{subtitle}</p>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={onMinimize} title="Zminimalizuj" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8a8aa0', display: 'flex' }}>
          <Minimize2 size={16} />
        </button>
      </div>

      <div
        className="nl-scroll"
        style={{
          flex: 1, overflowY: 'auto', padding: 24, position: 'relative', zIndex: 1,
          display: 'grid', gap: 14, alignContent: 'center',
          gridTemplateColumns: `repeat(${Math.min(participants.length, participants.length <= 2 ? participants.length : 3)}, minmax(180px, 1fr))`,
        }}
      >
        {participants.map(p => {
          const isSelf = p.isSelf;
          const sharing = isSelf ? activeCall.isScreenSharing : sharingUserIds.has(p.id);
          const cameraOn = isSelf ? activeCall.isCameraOn : cameraOnUserIds.has(p.id);
          const stream = sharing
            ? (isSelf ? screenStreamRef.current : remoteScreenStreamsRef.current?.get(p.id) ?? null)
            : cameraOn
              ? (isSelf ? cameraStreamRef.current : remoteCameraStreamsRef.current?.get(p.id) ?? null)
              : null;
          const muted = isSelf ? activeCall.isMuted : !!voiceUserStates[p.id]?.muted;
          const avatar = staticUrl(p.avatar_url);
          return (
            <div key={p.id} style={{
              position: 'relative', aspectRatio: '4 / 3', borderRadius: 18, overflow: 'hidden',
              background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {stream ? (
                <VideoTile stream={stream} mirror={isSelf && !sharing} />
              ) : (
                <span style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a', fontSize: 22, fontWeight: 700 }}>
                  {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.username.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, background: 'rgba(0,0,0,0.5)', padding: '7px 0',
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff' }}>{isSelf ? 'Ty' : p.username}</span>
                {muted ? <MicOff size={12} color="#f87171" /> : <Mic size={12} color="#4ade80" />}
              </div>
              {sharing && (
                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(99,102,241,0.85)', borderRadius: 8, padding: '3px 7px' }}>
                  <ScreenShare size={11} color="#fff" /><span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>Udostępnia</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '18px 0 26px', position: 'relative', zIndex: 2 }}>
        <button onClick={onToggleMute} title={activeCall.isMuted ? 'Włącz mikrofon' : 'Wycisz mikrofon'}
          style={ctrlBtnStyle(activeCall.isMuted)}>
          {activeCall.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button onClick={onToggleDeafen} title={activeCall.isDeafened ? 'Włącz dźwięk' : 'Wycisz odbiór'}
          style={ctrlBtnStyle(activeCall.isDeafened)}>
          <Headphones size={18} />
        </button>
        <button onClick={onToggleCamera} title={activeCall.isCameraOn ? 'Wyłącz kamerę' : 'Włącz kamerę'}
          style={ctrlBtnStyle(false, activeCall.isCameraOn)}>
          {activeCall.isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
        </button>
        <button onClick={onToggleScreen} title={activeCall.isScreenSharing ? 'Zatrzymaj udostępnianie' : 'Udostępnij ekran'}
          style={ctrlBtnStyle(false, activeCall.isScreenSharing)}>
          {activeCall.isScreenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
        </button>
        <button onClick={onHangup} title="Rozłącz" style={{ ...ctrlBtnStyle(false), background: '#ef4444', width: 56, height: 56, borderRadius: 28 }}>
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
}

function ctrlBtnStyle(active: boolean, accentActive?: boolean): React.CSSProperties {
  return {
    width: 48, height: 48, borderRadius: 24, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
    background: active ? '#ef4444' : accentActive ? '#6366f1' : 'rgba(255,255,255,0.1)',
  };
}
