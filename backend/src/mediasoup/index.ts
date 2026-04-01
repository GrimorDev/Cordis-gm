// @ts-nocheck
import * as mediasoup from 'mediasoup';

// ── Config from environment ───────────────────────────────────────────────────
const ANNOUNCED_IP   = process.env.MEDIASOUP_ANNOUNCED_IP || undefined;
const RTC_MIN_PORT   = parseInt(process.env.MEDIASOUP_RTC_MIN_PORT  || '40000', 10);
const RTC_MAX_PORT   = parseInt(process.env.MEDIASOUP_RTC_MAX_PORT  || '40100', 10);

// ── Codec configuration ───────────────────────────────────────────────────────
// preferredPayloadType is not required when configuring a Router — mediasoup assigns it.
const mediaCodecs = [
  {
    kind: 'audio' as const,
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
    parameters: {
      minptime: 10,
      useinbandfec: 1,
    },
  },
  {
    kind: 'video' as const,
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {},
  },
  {
    kind: 'video' as const,
    mimeType: 'video/H264',
    clockRate: 90000,
    parameters: {
      'packetization-mode': 1,
      'profile-level-id': '42e01f',
      'level-asymmetry-allowed': 1,
    },
  },
] as unknown as RtpCodecCapability[];

// ── Worker & Router state ─────────────────────────────────────────────────────
let _worker: Worker | null = null;
const _routers = new Map<string, Router>();

// ── Peer state ────────────────────────────────────────────────────────────────
interface PeerTransport {
  transport: WebRtcTransport;
  producing: boolean;
}
interface PeerProducers {
  mic?: Producer;
  screen?: Producer;
}
interface PeerConsumers {
  [consumerId: string]: Consumer;
}
interface PeerState {
  transports: Map<string, PeerTransport>;
  producers: PeerProducers;
  consumers: PeerConsumers;
}
// roomId → userId → PeerState
const _rooms = new Map<string, Map<string, PeerState>>();

// ── Worker lifecycle ──────────────────────────────────────────────────────────
export async function createWorker(): Promise<void> {
  _worker = await mediasoup.createWorker({
    logLevel: 'warn',
    logTags: ['rtp', 'ice'],
    rtcMinPort: RTC_MIN_PORT,
    rtcMaxPort: RTC_MAX_PORT,
  });
  console.log(`[MediaSoup] Worker created, pid=${_worker.pid}`);

  _worker.on('died', (error) => {
    console.error('[MediaSoup] Worker died, restarting in 2s:', error);
    setTimeout(async () => {
      try {
        await createWorker();
        console.log('[MediaSoup] Worker restarted after death');
        // Re-create routers is complex; existing rooms will lose SFU but clients
        // will reconnect naturally via socket reconnection.
        _routers.clear();
        _rooms.clear();
      } catch (e) {
        console.error('[MediaSoup] Worker restart failed:', e);
      }
    }, 2000);
  });
}

// ── Router ────────────────────────────────────────────────────────────────────
export async function getOrCreateRouter(roomId: string): Promise<Router> {
  const existing = _routers.get(roomId);
  if (existing && !existing.closed) return existing;

  if (!_worker || _worker.died) {
    throw new Error('[MediaSoup] Worker not ready');
  }
  const router = await _worker.createRouter({ mediaCodecs });
  _routers.set(roomId, router);
  console.log(`[MediaSoup] Router created for room=${roomId}`);
  return router;
}

// ── Room & Peer management ────────────────────────────────────────────────────
export function joinRoom(roomId: string, userId: string): void {
  if (!_rooms.has(roomId)) {
    _rooms.set(roomId, new Map());
  }
  const room = _rooms.get(roomId)!;
  if (!room.has(userId)) {
    room.set(userId, {
      transports: new Map(),
      producers: {},
      consumers: {},
    });
  }
}

function getPeer(roomId: string, userId: string): PeerState {
  const room = _rooms.get(roomId);
  if (!room) throw new Error(`Room ${roomId} not found`);
  const peer = room.get(userId);
  if (!peer) throw new Error(`Peer ${userId} not found in room ${roomId}`);
  return peer;
}

// ── WebRTC Transport ──────────────────────────────────────────────────────────
export async function createWebRtcTransport(
  roomId: string,
  userId: string,
  producing: boolean,
): Promise<{
  id: string;
  iceParameters: object;
  iceCandidates: object[];
  dtlsParameters: object;
}> {
  const router = await getOrCreateRouter(roomId);
  const peer   = getPeer(roomId, userId);

  const listenIps: { ip: string; announcedIp?: string }[] = ANNOUNCED_IP
    ? [{ ip: '0.0.0.0', announcedIp: ANNOUNCED_IP }]
    : [{ ip: '127.0.0.1' }];

  const transport = await router.createWebRtcTransport({
    listenIps,
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    enableSctp: false,
  });

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  peer.transports.set(transport.id, { transport, producing });

  return {
    id:             transport.id,
    iceParameters:  transport.iceParameters,
    iceCandidates:  transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

// ── DTLS Connect ──────────────────────────────────────────────────────────────
export async function connectTransport(
  roomId: string,
  userId: string,
  transportId: string,
  dtlsParameters: DtlsParameters,
): Promise<void> {
  const peer = getPeer(roomId, userId);
  const t    = peer.transports.get(transportId);
  if (!t) throw new Error(`Transport ${transportId} not found for ${userId}`);
  await t.transport.connect({ dtlsParameters });
}

// ── Produce ───────────────────────────────────────────────────────────────────
export async function produce(
  roomId: string,
  userId: string,
  transportId: string,
  kind: MediaKind,
  rtpParameters: RtpParameters,
  appData: AppData,
): Promise<string> {
  const peer = getPeer(roomId, userId);
  const t    = peer.transports.get(transportId);
  if (!t || !t.producing) throw new Error(`Send transport ${transportId} not found for ${userId}`);

  const producer = await t.transport.produce({ kind, rtpParameters, appData });

  producer.on('transportclose', () => {
    producer.close();
  });

  // Store by kind
  const producerKind = (appData as any)?.kind === 'screen' ? 'screen' : 'mic';
  if (producerKind === 'screen') {
    peer.producers.screen?.close();
    peer.producers.screen = producer;
  } else {
    peer.producers.mic?.close();
    peer.producers.mic = producer;
  }

  return producer.id;
}

// ── Consume ───────────────────────────────────────────────────────────────────
export async function consume(
  roomId: string,
  userId: string,
  producerId: string,
  rtpCapabilities: RtpCapabilities,
): Promise<{
  consumerId: string;
  producerId: string;
  kind: string;
  rtpParameters: object;
}> {
  const router = await getOrCreateRouter(roomId);
  const peer   = getPeer(roomId, userId);

  // Find recv transport
  let recvTransport: WebRtcTransport | undefined;
  for (const [, t] of peer.transports) {
    if (!t.producing) { recvTransport = t.transport; break; }
  }
  if (!recvTransport) throw new Error(`Recv transport not found for ${userId}`);

  if (!router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error(`Cannot consume producer ${producerId} for ${userId}: incompatible RTP capabilities`);
  }

  const consumer = await recvTransport.consume({
    producerId,
    rtpCapabilities,
    paused: false, // start paused, client must call resume
  });

  consumer.on('transportclose', () => { consumer.close(); });
  consumer.on('producerclose', () => { consumer.close(); });

  peer.consumers[consumer.id] = consumer;

  return {
    consumerId:    consumer.id,
    producerId:    consumer.producerId,
    kind:          consumer.kind,
    rtpParameters: consumer.rtpParameters,
  };
}

// ── Resume Consumer ───────────────────────────────────────────────────────────
export async function resumeConsumer(
  roomId: string,
  userId: string,
  consumerId: string,
): Promise<void> {
  const peer     = getPeer(roomId, userId);
  const consumer = peer.consumers[consumerId];
  if (!consumer) throw new Error(`Consumer ${consumerId} not found for ${userId}`);
  await consumer.resume();
}

// ── Close Producer ────────────────────────────────────────────────────────────
export function closeProducer(
  roomId: string,
  userId: string,
  producerKind: 'mic' | 'screen',
): void {
  const peer = getPeer(roomId, userId);
  if (producerKind === 'screen') {
    peer.producers.screen?.close();
    peer.producers.screen = undefined;
  } else {
    peer.producers.mic?.close();
    peer.producers.mic = undefined;
  }
}

// ── Leave Room ────────────────────────────────────────────────────────────────
export function leaveRoom(roomId: string, userId: string): string[] {
  const room = _rooms.get(roomId);
  if (!room) return [];

  const peer = room.get(userId);
  if (!peer) return [];

  const closedProducerIds: string[] = [];

  // Close all producers and collect their IDs
  for (const [kind, producer] of Object.entries(peer.producers) as [string, Producer | undefined][]) {
    if (producer) {
      closedProducerIds.push(producer.id);
      producer.close();
    }
  }

  // Close all consumers
  for (const consumer of Object.values(peer.consumers)) {
    consumer.close();
  }

  // Close all transports
  for (const [, t] of peer.transports) {
    t.transport.close();
  }

  room.delete(userId);

  // Clean up empty rooms
  if (room.size === 0) {
    _rooms.delete(roomId);
    const router = _routers.get(roomId);
    if (router && !router.closed) {
      router.close();
    }
    _routers.delete(roomId);
  }

  return closedProducerIds;
}

// ── Get Existing Producers ────────────────────────────────────────────────────
export function getExistingProducers(
  roomId: string,
  excludeUserId: string,
): { userId: string; producerId: string; kind: string; appData: object }[] {
  const room = _rooms.get(roomId);
  if (!room) return [];

  const result: { userId: string; producerId: string; kind: string; appData: object }[] = [];

  for (const [uid, peer] of room) {
    if (uid === excludeUserId) continue;
    if (peer.producers.mic && !peer.producers.mic.closed) {
      result.push({
        userId:     uid,
        producerId: peer.producers.mic.id,
        kind:       peer.producers.mic.kind,
        appData:    { ...(peer.producers.mic.appData as object), kind: 'mic' },
      });
    }
    if (peer.producers.screen && !peer.producers.screen.closed) {
      result.push({
        userId:     uid,
        producerId: peer.producers.screen.id,
        kind:       peer.producers.screen.kind,
        appData:    { ...(peer.producers.screen.appData as object), kind: 'screen' },
      });
    }
  }

  return result;
}

// ── Get RTP Capabilities ──────────────────────────────────────────────────────
export function getRtpCapabilities(roomId: string): RtpCapabilities {
  const router = _routers.get(roomId);
  if (!router) throw new Error(`Router for room ${roomId} not found`);
  return router.rtpCapabilities;
}
