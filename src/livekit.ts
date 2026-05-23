/**
 * LiveKit SFU helpers for Cordyn
 *
 * Why LiveKit for screen share?
 *   Full-mesh WebRTC means the sharer's upload × N viewers.
 *   At 8 Mbps FHD with 10 viewers = 80 Mbps upload needed.
 *   LiveKit SFU: sharer uploads once → server fans out to all viewers.
 *   Scales to 1000+ viewers with a single 8 Mbps upstream.
 *
 * Voice (audio) still uses the existing WebRTC mesh — fine for typical
 * voice channels (≤20 active speakers). LiveKit can handle voice too
 * but that would require migrating the full peer-connection lifecycle.
 */

import {
  Room,
  RoomEvent,
  Track,
  LocalVideoTrack,
  LocalAudioTrack,
  type RemoteTrack,
  type RemoteParticipant,
  ConnectionState,
  type RoomConnectOptions,
} from 'livekit-client';
import { getToken, API_BASE, isTauri } from './api';

// ── Config ────────────────────────────────────────────────────────────────────
// VITE_LIVEKIT_URL: e.g. "wss://yourdomain.com/livekit" (prod via nginx)
//                  or  "ws://localhost:7880"             (local dev)
// Falls back to same-origin /livekit path which nginx proxies to the SFU.
// On Tauri desktop, window.location is tauri://localhost — we derive from API_BASE instead.
const RAW_URL = (import.meta.env.VITE_LIVEKIT_URL as string | undefined) || '';
export const LIVEKIT_URL: string = RAW_URL || (() => {
  if (isTauri) {
    // API_BASE = "https://cordyn.pl/api" → "wss://cordyn.pl/livekit"
    const origin = API_BASE.replace(/\/api\/?$/, '');
    return origin.replace(/^http/, 'ws') + '/livekit';
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/livekit`;
})();

// ── Types ─────────────────────────────────────────────────────────────────────
export type LivekitTrackHandler = (
  track: RemoteTrack,
  participant: RemoteParticipant,
) => void;

// ── Room singleton ────────────────────────────────────────────────────────────
let _room: Room | null = null;
let _roomName: string  = '';

export function getLivekitRoom(): Room | null { return _room; }
export function getLivekitRoomName(): string  { return _roomName; }

// ── Token fetch ───────────────────────────────────────────────────────────────
async function fetchToken(roomName: string, canPublish: boolean): Promise<string> {
  const resp = await fetch(`${API_BASE}/livekit/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken() ?? ''}`,
    },
    body: JSON.stringify({ roomName, canPublish }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`LiveKit token request failed: ${resp.status} ${body}`);
  }
  const { token } = await resp.json() as { token: string };
  return token;
}

// ── Room connection ───────────────────────────────────────────────────────────
/**
 * Connect (or reuse an existing connection) to a LiveKit room.
 * Callbacks are re-registered on every call so closures stay fresh.
 */
export async function connectRoom(
  roomName: string,
  canPublish: boolean,
  onTrackSubscribed:   LivekitTrackHandler,
  onTrackUnsubscribed: LivekitTrackHandler,
): Promise<Room> {
  // Already connected to the same room — reuse unless we need to upgrade to canPublish
  if (_room && _roomName === roomName && _room.state === ConnectionState.Connected) {
    const hasPublish = _room.localParticipant.permissions?.canPublish ?? false;
    if (!canPublish || hasPublish) {
      // No permission upgrade needed — just refresh the event handlers
      _room.off(RoomEvent.TrackSubscribed,   _room.listeners(RoomEvent.TrackSubscribed)[0]   as any);
      _room.off(RoomEvent.TrackUnsubscribed, _room.listeners(RoomEvent.TrackUnsubscribed)[0] as any);
      _room.on(RoomEvent.TrackSubscribed,   onTrackSubscribed);
      _room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      return _room;
    }
    // canPublish=true requested but existing token has canPublish=false → must reconnect
    await disconnectRoom();
  }

  // Disconnect previous room if switching
  await disconnectRoom();

  const token = await fetchToken(roomName, canPublish);

  const room = new Room({
    adaptiveStream: true,   // auto-adjust subscriber quality to viewport size
    dynacast:       true,   // only send layers actually being consumed
    // Prefer h264 for screen share — better encoder support on macOS/Windows
    publishDefaults: {
      simulcast: false, // no simulcast for screen share (1 layer, max quality)
    },
  });

  room.on(RoomEvent.TrackSubscribed,   onTrackSubscribed);
  room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);

  const opts: RoomConnectOptions = { autoSubscribe: true };
  await room.connect(LIVEKIT_URL, token, opts);

  _room     = room;
  _roomName = roomName;
  return room;
}

export async function disconnectRoom(): Promise<void> {
  if (_room) {
    try { await _room.disconnect(); } catch {}
    _room     = null;
    _roomName = '';
  }
}

// ── Screen share publishing ───────────────────────────────────────────────────
/**
 * Publish an already-captured MediaStream as a screen share into the LiveKit room.
 * Call connectRoom() first to ensure the room is connected with canPublish=true.
 */
export async function publishScreen(
  stream: MediaStream,
  quality: 'hd' | 'fhd',
): Promise<void> {
  if (!_room) throw new Error('[LiveKit] Room not connected — call connectRoom() first');

  const maxBitrate = quality === 'fhd' ? 8_000_000 : 4_000_000;

  const videoMSTrack = stream.getVideoTracks()[0];
  if (videoMSTrack) {
    const localVideo = new LocalVideoTrack(videoMSTrack, undefined, false);
    await _room.localParticipant.publishTrack(localVideo, {
      source:        Track.Source.ScreenShare,
      name:          'screen',
      videoEncoding: { maxBitrate, maxFramerate: 60 },
      // Disable simulcast for screen share — we want full resolution for all viewers
      simulcast: false,
    });
  }

  const audioMSTrack = stream.getAudioTracks()[0];
  if (audioMSTrack) {
    const localAudio = new LocalAudioTrack(audioMSTrack, undefined, false);
    await _room.localParticipant.publishTrack(localAudio, {
      source: Track.Source.ScreenShareAudio,
      name:   'screen-audio',
    });
  }
}

/**
 * Stop publishing screen tracks from the local participant.
 */
export async function unpublishScreen(): Promise<void> {
  if (!_room) return;
  const pubs = [..._room.localParticipant.trackPublications.values()];
  for (const pub of pubs) {
    if (
      pub.source === Track.Source.ScreenShare ||
      pub.source === Track.Source.ScreenShareAudio
    ) {
      try { await _room.localParticipant.unpublishTrack(pub.track as LocalVideoTrack | LocalAudioTrack); }
      catch {}
    }
  }
}

// ── Room name helpers ─────────────────────────────────────────────────────────
/** LiveKit room name for a voice/video channel */
export function channelRoom(channelId: string): string {
  return `channel:${channelId}`;
}

/** LiveKit room name for a DM call (sorted so both sides use the same name) */
export function dmRoom(userId1: string, userId2: string): string {
  return `dm:${[userId1, userId2].sort().join('-')}`;
}
