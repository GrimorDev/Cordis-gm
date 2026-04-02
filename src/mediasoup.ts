// ── MediaSoup Client for Cordis ───────────────────────────────────────────────
import { Device, types as msTypes } from 'mediasoup-client';
import type { Socket } from 'socket.io-client';
type Transport = msTypes.Transport;
type Producer  = msTypes.Producer;
type Consumer  = msTypes.Consumer;
import {
  attachRemoteAudio, detachRemoteAudio,
  setRemoteVolume, muteRemoteUser, muteAllRemote,
  watchSpeaking,
} from './webrtc';

// ── Public types ──────────────────────────────────────────────────────────────
export interface RemoteStream {
  userId: string;
  stream: MediaStream;
  kind: 'mic' | 'screen';
}

type OnNewStream    = (s: RemoteStream) => void;
type OnStreamClosed = (userId: string, kind: 'mic' | 'screen') => void;
type OnSpeaking     = (userId: string, speaking: boolean) => void;

// ── Per-room state ────────────────────────────────────────────────────────────
interface RoomState {
  roomId:        string;
  socket:        Socket;
  device:        Device;
  sendTransport: Transport | null;
  recvTransport: Transport | null;
  micProducer:   Producer | null;
  screenProducer: Producer | null;
  consumers:     Map<string, Consumer>; // consumerId → Consumer
  onNewStream:   OnNewStream;
  onStreamClosed: OnStreamClosed;
  onSpeaking?:   OnSpeaking;
  // Speaking detection cleanup functions keyed by userId
  speakCleanup:  Map<string, () => void>;
}

// Only one active room at a time (voice channel, DM call, or group call)
let _room: RoomState | null = null;
// Mutex: prevent concurrent joinRoom calls (racing condition causes duplicate transports)
let _joining = false;

// ── Socket promise helpers (callback pattern) ─────────────────────────────────
function emitWithCallback<T = any>(socket: Socket, event: string, data: object): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    socket.emit(event as any, data, (res: any) => {
      if (res && res.error) {
        reject(new Error(res.error));
      } else {
        resolve(res as T);
      }
    });
  });
}

// ── Join a MediaSoup room ─────────────────────────────────────────────────────
export async function joinRoom(params: {
  roomId:       string;
  localStream:  MediaStream;
  socket:       Socket;
  onNewStream:  OnNewStream;
  onStreamClosed: OnStreamClosed;
  onSpeaking?:  OnSpeaking;
}): Promise<void> {
  const { roomId, localStream, socket, onNewStream, onStreamClosed, onSpeaking } = params;

  // Guard: drop concurrent joinRoom calls (clicking multiple times / racing events)
  if (_joining) {
    console.warn('[MediaSoup] joinRoom already in progress, ignoring duplicate call');
    return;
  }
  _joining = true;

  try {
  // If already in a room, leave it first
  if (_room) {
    await leaveRoom(_room.roomId);
  }

  const device = new Device();

  // 1. Join room on server — get RTP caps + existing producers
  const { rtpCapabilities, existingProducers } = await emitWithCallback<{
    rtpCapabilities: any;
    existingProducers: { userId: string; producerId: string; kind: string; appData: any }[];
  }>(socket, 'ms_join', { roomId });

  // 2. Load device with router RTP capabilities
  await device.load({ routerRtpCapabilities: rtpCapabilities });

  // 3. Create send transport
  const sendParams = await emitWithCallback<any>(socket, 'ms_create_transport', { roomId, producing: true });
  const sendTransport = device.createSendTransport(sendParams);

  sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      await emitWithCallback(socket, 'ms_connect_transport', {
        roomId,
        transportId: sendTransport.id,
        dtlsParameters,
      });
      callback();
    } catch (err: any) {
      errback(err);
    }
  });

  sendTransport.on('connectionstatechange', (state) => {
    console.log(`[MediaSoup] sendTransport connectionstate: ${state}`);
    if (state === 'failed') console.error('[MediaSoup] Send transport ICE FAILED — check MEDIASOUP_ANNOUNCED_IP and firewall ports 20000-20500');
  });

  sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
    try {
      const { producerId } = await emitWithCallback<{ producerId: string }>(socket, 'ms_produce', {
        roomId,
        transportId: sendTransport.id,
        kind,
        rtpParameters,
        appData,
      });
      callback({ id: producerId });
    } catch (err: any) {
      errback(err);
    }
  });

  // 4. Create recv transport
  const recvParams = await emitWithCallback<any>(socket, 'ms_create_transport', { roomId, producing: false });
  const recvTransport = device.createRecvTransport(recvParams);

  recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      await emitWithCallback(socket, 'ms_connect_transport', {
        roomId,
        transportId: recvTransport.id,
        dtlsParameters,
      });
      callback();
    } catch (err: any) {
      errback(err);
    }
  });

  recvTransport.on('connectionstatechange', (state) => {
    console.log(`[MediaSoup] recvTransport connectionstate: ${state}`);
    if (state === 'failed') console.error('[MediaSoup] Recv transport ICE FAILED — check MEDIASOUP_ANNOUNCED_IP and firewall ports 20000-20500');
  });

  // 5. Store room state
  const room: RoomState = {
    roomId,
    socket,
    device,
    sendTransport,
    recvTransport,
    micProducer: null,
    screenProducer: null,
    consumers: new Map(),
    onNewStream,
    onStreamClosed,
    onSpeaking,
    speakCleanup: new Map(),
  };
  _room = room;

  // 6. Produce mic track
  const audioTrack = localStream.getAudioTracks()[0];
  if (audioTrack) {
    console.log('[MediaSoup] mic track state:', {
      enabled:   audioTrack.enabled,
      muted:     audioTrack.muted,
      readyState: audioTrack.readyState,
      label:     audioTrack.label,
    });
    try {
      const micProducer = await sendTransport.produce({
        track: audioTrack,
        codecOptions: {
          opusStereo: false,
          opusDtx:    false,  // DTX off — constant RTP stream, consumer track stays unmuted
        },
        appData: { kind: 'mic' },
      });
      console.log('[MediaSoup] mic producer created, id=', micProducer.id, 'paused=', micProducer.paused);
      room.micProducer = micProducer;
      micProducer.on('transportclose', () => { room.micProducer = null; });
      micProducer.on('trackended',      () => {
        console.warn('[MediaSoup] mic track ended — no more audio will be sent');
        room.micProducer = null;
      });

      // Check RTP stats after 3s — if bytesSent=0, browser is not sending audio
      setTimeout(async () => {
        try {
          const stats = await sendTransport.getStats();
          let bytesSent = 0;
          let packetsSent = 0;
          stats.forEach((report: any) => {
            if (report.type === 'outbound-rtp' && report.kind === 'audio') {
              bytesSent   = report.bytesSent   ?? 0;
              packetsSent = report.packetsSent ?? 0;
            }
          });
          if (bytesSent === 0) {
            console.error('[MediaSoup] ⚠️ bytesSent=0 after 3s — browser is NOT sending audio RTP! Track source may be silent.');
          } else {
            console.log(`[MediaSoup] ✓ RTP sending OK: ${packetsSent} packets / ${bytesSent} bytes`);
          }
        } catch (e) {
          console.warn('[MediaSoup] getStats failed:', e);
        }
      }, 3000);
    } catch (err) {
      console.warn('[MediaSoup] Failed to produce mic:', err);
    }
  } else {
    console.error('[MediaSoup] No audio track in localStream — mic not acquired or stream empty');
  }

  // 7. Subscribe to new producers and closures from the server
  const onNewProducer = async (data: { userId: string; producerId: string; kind: string; appData: any }) => {
    if (!_room || _room.roomId !== roomId) return;
    await consumeRemote(room, data);
  };
  const onProducerClosed = (data: { userId: string; producerId?: string; kind?: 'mic' | 'screen' }) => {
    if (!_room || _room.roomId !== roomId) return;
    // Close any consumers for this producer
    for (const [consumerId, consumer] of room.consumers) {
      if (consumer.producerId === data.producerId || (data.userId && !data.producerId)) {
        consumer.close();
        room.consumers.delete(consumerId);
      }
    }
    // Stop speaking detection for this user if mic closed
    if (data.kind === 'mic' || !data.kind) {
      const stopFn = room.speakCleanup.get(data.userId);
      if (stopFn) { stopFn(); room.speakCleanup.delete(data.userId); }
    }
    const kind: 'mic' | 'screen' = data.kind ?? 'mic';
    onStreamClosed(data.userId, kind);
    detachRemoteAudio(data.userId);
  };

  socket.on('ms_new_producer' as any, onNewProducer);
  socket.on('ms_producer_closed' as any, onProducerClosed);

  // Store listeners so we can remove them on leaveRoom
  (room as any)._onNewProducer    = onNewProducer;
  (room as any)._onProducerClosed = onProducerClosed;

  // 8. Consume all existing producers
  for (const producer of existingProducers) {
    await consumeRemote(room, producer);
  }

  } finally {
    _joining = false;
  }
}

// ── Consume a remote producer ─────────────────────────────────────────────────
async function consumeRemote(
  room: RoomState,
  producer: { userId: string; producerId: string; kind: string; appData: any },
): Promise<void> {
  try {
    if (!room.device.loaded) return;
    if (!room.recvTransport) return;

    const { consumerId, producerId, kind, rtpParameters } = await emitWithCallback<{
      consumerId:    string;
      producerId:    string;
      kind:          string;
      rtpParameters: any;
    }>(room.socket, 'ms_consume', {
      roomId:         room.roomId,
      producerId:     producer.producerId,
      rtpCapabilities: room.device.rtpCapabilities,
    });

    const consumer = await room.recvTransport.consume({
      id:            consumerId,
      producerId,
      kind:          kind as any,
      rtpParameters,
    });

    room.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => { room.consumers.delete(consumer.id); });

    // Resume consumer on server
    await emitWithCallback(room.socket, 'ms_resume_consumer', {
      roomId:     room.roomId,
      consumerId: consumer.id,
    });

    // Build MediaStream and deliver to caller
    const track = consumer.track;

    // Wait for track to unmute (fires when RTP data starts flowing), but cap at 3s
    // to avoid hanging forever if ICE/DTLS fails
    const trackWasMuted = track.muted;
    if (track.muted) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          track.removeEventListener('unmute', onUnmute);
          console.warn('[MediaSoup] track still muted after 3s — ICE may have failed');
          resolve();
        }, 3000);
        const onUnmute = () => {
          clearTimeout(timer);
          track.removeEventListener('unmute', onUnmute);
          resolve();
        };
        track.addEventListener('unmute', onUnmute);
      });
    }

    const stream = new MediaStream([track]);
    const producerKind: 'mic' | 'screen' =
      producer.appData?.kind === 'screen' ? 'screen' : 'mic';

    room.onNewStream({ userId: producer.userId, stream, kind: producerKind });

    // Attach audio for playback (mic tracks only — screen share audio is separate)
    if (kind === 'audio') {
      attachRemoteAudio(producer.userId, stream);

      // If the track was still muted when we attached (3s timeout fired before RTP arrived),
      // register a one-shot listener to re-attach once RTP actually starts flowing.
      // CRITICAL for Tauri/WebView2: createMediaStreamSource(mutedTrack) creates a
      // permanently-silent source node that never recovers even after the track unmutes.
      // Re-calling attachRemoteAudio with a fresh MediaStream fixes this.
      if (trackWasMuted && track.muted) {
        track.addEventListener('unmute', () => {
          attachRemoteAudio(producer.userId, new MediaStream([track]));
        }, { once: true });
      }

      // Speaking detection for remote user
      if (room.onSpeaking) {
        const onSpeakingFn = room.onSpeaking;
        const userId       = producer.userId;
        const oldStop = room.speakCleanup.get(userId);
        if (oldStop) oldStop();
        const stopWatch = watchSpeaking(stream, (speaking) => {
          onSpeakingFn(userId, speaking);
        });
        room.speakCleanup.set(userId, stopWatch);
      }
    }
  } catch (err) {
    console.warn('[MediaSoup] consumeRemote failed for', producer.userId, producer.producerId, err);
  }
}

// ── Leave a room ──────────────────────────────────────────────────────────────
export async function leaveRoom(roomId: string): Promise<void> {
  if (!_room || _room.roomId !== roomId) return;
  const room = _room;
  _room = null;

  // Remove socket listeners
  room.socket.off('ms_new_producer' as any, (room as any)._onNewProducer);
  room.socket.off('ms_producer_closed' as any, (room as any)._onProducerClosed);

  // Stop speaking detection
  room.speakCleanup.forEach(fn => fn());
  room.speakCleanup.clear();

  // Close all consumers
  room.consumers.forEach(c => { try { c.close(); } catch {} });
  room.consumers.clear();

  // Close producers
  try { room.micProducer?.close(); }    catch {}
  try { room.screenProducer?.close(); } catch {}

  // Close transports
  try { room.sendTransport?.close(); } catch {}
  try { room.recvTransport?.close(); } catch {}

  // Notify server
  try {
    await emitWithCallback(room.socket, 'ms_leave', { roomId });
  } catch { /* server might already be gone */ }
}

// ── Replace mic track (device change) ────────────────────────────────────────
export async function replaceTrack(track: MediaStreamTrack): Promise<void> {
  if (!_room?.micProducer) return;
  try {
    await _room.micProducer.replaceTrack({ track });
  } catch (err) {
    console.warn('[MediaSoup] replaceTrack failed:', err);
  }
}

// ── Toggle mic (mute/unmute locally) ─────────────────────────────────────────
export async function setMicEnabled(enabled: boolean): Promise<void> {
  if (!_room?.micProducer) return;
  if (enabled) {
    _room.micProducer.resume();
  } else {
    _room.micProducer.pause();
  }
  // Also pause/resume the track directly for immediate effect
  const track = _room.micProducer.track;
  if (track) track.enabled = enabled;
}

// ── Screen share ──────────────────────────────────────────────────────────────
export async function produceScreen(roomId: string, screenStream: MediaStream): Promise<void> {
  if (!_room || _room.roomId !== roomId || !_room.sendTransport) {
    throw new Error('Not in mediasoup room or send transport missing');
  }
  const room = _room;

  // Close existing screen producer if any
  if (room.screenProducer) {
    room.screenProducer.close();
    room.screenProducer = null;
  }

  const videoTrack = screenStream.getVideoTracks()[0];
  if (!videoTrack) throw new Error('No video track in screen stream');

  const screenProducer = await room.sendTransport.produce({
    track: videoTrack,
    appData: { kind: 'screen' },
  });

  room.screenProducer = screenProducer;
  screenProducer.on('transportclose', () => { room.screenProducer = null; });
  screenProducer.on('trackended',      () => { room.screenProducer = null; });

  // Also produce screen audio if available
  const audioTrack = screenStream.getAudioTracks()[0];
  if (audioTrack) {
    try {
      await room.sendTransport.produce({
        track:      audioTrack,
        appData:    { kind: 'screen' },
      });
    } catch { /* screen audio not critical */ }
  }
}

export async function stopScreenShare(roomId: string): Promise<void> {
  if (!_room || _room.roomId !== roomId) return;
  const room = _room;

  if (room.screenProducer) {
    const producerId = room.screenProducer.id;
    room.screenProducer.close();
    room.screenProducer = null;
    // Notify server via ms_close_producer
    try {
      await emitWithCallback(room.socket, 'ms_close_producer', { roomId, kind: 'screen' });
    } catch {}
  }
}

// ── Status helpers ────────────────────────────────────────────────────────────
export function isInRoom(roomId: string): boolean {
  return _room?.roomId === roomId;
}

export function getCurrentRoomId(): string | null {
  return _room?.roomId ?? null;
}

// ── Volume / mute passthrough to webrtc.ts audio utilities ───────────────────
export { setRemoteVolume, muteRemoteUser, muteAllRemote, detachRemoteAudio as detachAllRemote };

// Re-export detachAllRemote as a function that detaches everything
// (for use in cleanupWebRTC)
export function detachAll(): void {
  // webrtc.ts manages the audio element / AudioContext maps —
  // individual detachRemoteAudio calls happen via onStreamClosed callback
  // but we can't iterate them here. App.tsx calls detachRemoteAudio per user.
}
