// ─── Voice-channel WebRTC mesh (mirrors src/webrtc.ts + src/rtc/engine.ts on desktop) ───
//
// Signaling contract (backend/src/socket/index.ts) — identical to desktop:
//   voice_join {channelId}          → C→S
//   voice_existing_users {channel_id, user_ids}  → S→C (who to call)
//   voice_leave {channelId}         → C→S
//   webrtc_offer/answer  {to, sdp}  → relayed as {from, sdp}
//   webrtc_ice           {to, candidate} → relayed as {from, candidate}
//
// react-native-webrtc auto-routes a received remote audio track to the
// device speaker/earpiece once it's attached to the peer connection — unlike
// web, no <audio> element is needed for mic audio. A remote VIDEO track
// (camera or screen share — indistinguishable on the wire, both are just a
// "video" kind track) needs an RTCView to actually display, wired up by
// whoever consumes onRemoteStreamsChanged.
//
// Outgoing camera/screen share: react-native-webrtc bundles a full native
// Android MediaProjection capture pipeline for getDisplayMedia() — no custom
// native module needed, just permissions in app.json. Camera and screen
// share are mutually exclusive locally (starting one stops the other), and
// both go out as a single "video" track added via pc.addTrack(), same as
// desktop.
//
// Screen-share support requires WebRTC renegotiation: a peer adds a video
// track to an already-connected RTCPeerConnection via pc.addTrack(), which
// fires `onnegotiationneeded` and needs a second offer/answer round on a
// connection that's already `stable`. Both sides can in theory try to
// renegotiate at once (glare), so this follows the same "Perfect
// Negotiation" pattern desktop's src/rtc/engine.ts uses: a deterministic
// "polite" peer (lower user id) backs off on collision, the "impolite" one
// ignores the incoming colliding offer.

import { mediaDevices, RTCPeerConnection, RTCIceCandidate, MediaStream, MediaStreamTrack } from 'react-native-webrtc';
import { getSocket } from './socket';

// Desktop (src/rtc/engine.ts) sends pc.localDescription.toJSON() — a plain
// {type, sdp} object — over the wire. Build that explicitly here rather than
// relying on react-native-webrtc's RTCSessionDescription serializing the
// same way through Socket.IO's JSON encoder.
function descToPlain(desc: any): { type: string; sdp: string } {
  return { type: desc.type, sdp: desc.sdp };
}

function buildIceServers(): any[] {
  const servers: any[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];
  const turnUrl  = process.env.EXPO_PUBLIC_TURN_URL || '';
  const turnUser = process.env.EXPO_PUBLIC_TURN_USERNAME || '';
  const turnCred = process.env.EXPO_PUBLIC_TURN_CREDENTIAL || '';
  if (turnUrl) {
    servers.push({
      urls: [
        turnUrl.replace(/^turns?:/, 'turn:'),
        turnUrl.replace(/^turns?:/, 'turns:'),
      ],
      username: turnUser,
      credential: turnCred,
    });
  }
  return servers;
}

const ICE_SERVERS = buildIceServers();

export type RemoteStreams = { audio?: MediaStream; video?: MediaStream };

type VoiceMeshEvents = {
  onLocalStreamReady?: (stream: MediaStream) => void;
  onError?: (message: string) => void;
  /** Fires whenever a peer's remote audio/video stream set changes — video
   * present means that peer is sharing their screen or camera. */
  onRemoteStreamsChanged?: (peerId: string, streams: RemoteStreams) => void;
  onPeerRemoved?: (peerId: string) => void;
  /** Our own outgoing camera/screen-share stream, for a local preview tile. */
  onLocalVideoChanged?: (stream: MediaStream | null, kind: 'camera' | 'screen' | null) => void;
};

class VoiceMeshManager {
  private peers = new Map<string, RTCPeerConnection>();
  private remoteStreams = new Map<string, RemoteStreams>();
  // Perfect Negotiation bookkeeping, one entry per peer.
  private polite = new Map<string, boolean>();
  private makingOffer = new Map<string, boolean>();
  private ignoreOffer = new Map<string, boolean>();
  private localStream: MediaStream | null = null;
  // Camera and screen share are mutually exclusive in this pass (both are a
  // single extra "video" track on the wire — the receiving side has no way
  // to tell two simultaneous video sources apart, see ontrack below).
  private localVideoStream: MediaStream | null = null;
  private localVideoTrack: MediaStreamTrack | null = null;
  private localVideoKind: 'camera' | 'screen' | null = null;
  private channelId: string | null = null;
  // 'channel' = voice-channel mesh (join/leave, N peers). 'direct' = 1:1 DM
  // call (call_invite/accept, exactly one peer). Both speak the same
  // underlying webrtc_offer/answer/ice wire format, so they share this class.
  private mode: 'channel' | 'direct' | null = null;
  private muted = false;
  private deafened = false;
  private events: VoiceMeshEvents = {};
  private attached = false;
  private selfId = '';

  configure(events: VoiceMeshEvents) {
    this.events = events;
  }

  /** Needed to deterministically assign Perfect Negotiation politeness —
   * call once `currentUser` is known (id rarely/never changes at runtime). */
  setSelfId(id: string) {
    this.selfId = id;
  }

  /** True while ANY session (voice-channel or direct call) is active. */
  get active(): boolean {
    return this.mode !== null;
  }

  getRemoteStreams(peerId: string): RemoteStreams | undefined {
    return this.remoteStreams.get(peerId);
  }

  private attachSocketListeners() {
    if (this.attached) return;
    const sock = getSocket();
    if (!sock) return;
    sock.on('voice_existing_users', this.onExistingUsers);
    sock.on('webrtc_offer', this.onOffer);
    sock.on('webrtc_answer', this.onAnswer);
    sock.on('webrtc_ice', this.onIce);
    this.attached = true;
  }

  private detachSocketListeners() {
    const sock = getSocket();
    sock?.off('voice_existing_users', this.onExistingUsers);
    sock?.off('webrtc_offer', this.onOffer);
    sock?.off('webrtc_answer', this.onAnswer);
    sock?.off('webrtc_ice', this.onIce);
    this.attached = false;
  }

  /** Call right after emitting `voice_join` on the socket. */
  async join(channelId: string): Promise<void> {
    if (this.mode) await this.leave();
    this.mode = 'channel';
    this.channelId = channelId;
    this.attachSocketListeners();
    try {
      this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false }) as unknown as MediaStream;
      this.events.onLocalStreamReady?.(this.localStream);
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Nie udało się uzyskać dostępu do mikrofonu');
      this.mode = null;
      this.channelId = null;
      this.detachSocketListeners();
      throw e;
    }
  }

  /**
   * Caller side of a 1:1 DM call — call after the callee has accepted
   * (`call_accepted`), so the offer isn't racing their mic setup.
   */
  async startDirectCall(peerId: string): Promise<void> {
    if (this.mode) await this.leave();
    this.mode = 'direct';
    this.attachSocketListeners();
    try {
      this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false }) as unknown as MediaStream;
      this.events.onLocalStreamReady?.(this.localStream);
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Nie udało się uzyskać dostępu do mikrofonu');
      this.mode = null;
      this.detachSocketListeners();
      throw e;
    }
    const pc = this.makePeerConnection(peerId);
    try {
      const offer = await pc.createOffer({} as any);
      await pc.setLocalDescription(offer);
      getSocket()?.emit('webrtc_offer', { to: peerId, sdp: descToPlain(pc.localDescription) });
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Błąd nawiązywania połączenia');
      throw e;
    }
  }

  /**
   * Callee side of a 1:1 DM call — call after accepting (`call_accept`
   * emitted), before the caller's offer necessarily arrives. Just gets the
   * mic ready; the incoming offer is handled by the normal onOffer listener.
   */
  async acceptDirectCall(): Promise<void> {
    if (this.mode) await this.leave();
    this.mode = 'direct';
    this.attachSocketListeners();
    try {
      this.localStream = await mediaDevices.getUserMedia({ audio: true, video: false }) as unknown as MediaStream;
      this.events.onLocalStreamReady?.(this.localStream);
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Nie udało się uzyskać dostępu do mikrofonu');
      this.mode = null;
      this.detachSocketListeners();
      throw e;
    }
  }

  /** Call right before/after emitting `voice_leave`/`call_end` on the socket. */
  async leave(): Promise<void> {
    this.mode = null;
    this.channelId = null;
    this.detachSocketListeners();
    for (const peerId of this.peers.keys()) {
      this.events.onPeerRemoved?.(peerId);
    }
    for (const pc of this.peers.values()) {
      try { pc.close(); } catch {}
    }
    this.peers.clear();
    this.remoteStreams.clear();
    this.polite.clear();
    this.makingOffer.clear();
    this.ignoreOffer.clear();
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    if (this.localVideoStream) {
      this.localVideoStream.getTracks().forEach(t => t.stop());
      this.localVideoStream = null;
      this.localVideoTrack = null;
      this.localVideoKind = null;
      this.events.onLocalVideoChanged?.(null, null);
    }
    this.muted = false;
    this.deafened = false;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Deafen — mutes INCOMING audio from every peer, unlike setMuted which
   * only affects what you send. Does not touch the local mic. */
  setDeafened(deafened: boolean) {
    this.deafened = deafened;
    for (const streams of this.remoteStreams.values()) {
      streams.audio?.getAudioTracks().forEach(t => { t.enabled = !deafened; });
    }
  }

  isDeafened(): boolean {
    return this.deafened;
  }

  getLocalVideoKind(): 'camera' | 'screen' | null {
    return this.localVideoKind;
  }

  /** Turn the camera on, adding it as a track to every connected peer.
   * Renegotiation (pc.onnegotiationneeded) happens automatically per peer. */
  async startCamera(): Promise<void> {
    if (!this.mode) return;
    if (this.localVideoKind === 'screen') await this.stopScreenShare();
    if (this.localVideoKind === 'camera') return;
    const stream = await mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } }) as unknown as MediaStream;
    this.localVideoStream = stream;
    this.localVideoTrack = stream.getVideoTracks()[0] ?? null;
    this.localVideoKind = 'camera';
    for (const pc of this.peers.values()) {
      if (this.localVideoTrack) pc.addTrack(this.localVideoTrack, stream);
    }
    this.events.onLocalVideoChanged?.(stream, 'camera');
  }

  async stopCamera(): Promise<void> {
    if (this.localVideoKind !== 'camera') return;
    await this.stopLocalVideo();
  }

  /** Start sharing the screen — react-native-webrtc bundles a complete
   * Android MediaProjection implementation (foreground service + capture)
   * behind getDisplayMedia(), no custom native module needed. */
  async startScreenShare(): Promise<void> {
    if (!this.mode) return;
    if (this.localVideoKind === 'camera') await this.stopCamera();
    if (this.localVideoKind === 'screen') return;
    const stream = await (mediaDevices as any).getDisplayMedia() as MediaStream;
    this.localVideoStream = stream;
    this.localVideoTrack = stream.getVideoTracks()[0] ?? null;
    this.localVideoKind = 'screen';
    for (const pc of this.peers.values()) {
      if (this.localVideoTrack) pc.addTrack(this.localVideoTrack, stream);
    }
    this.events.onLocalVideoChanged?.(stream, 'screen');
    // The OS screen-recording indicator / stop button ends the track
    // directly (not through our own stop button) — react to that too.
    this.localVideoTrack?.addEventListener?.('ended', () => {
      if (this.localVideoKind === 'screen') this.stopLocalVideo().catch(() => {});
    });
  }

  async stopScreenShare(): Promise<void> {
    if (this.localVideoKind !== 'screen') return;
    await this.stopLocalVideo();
  }

  private async stopLocalVideo(): Promise<void> {
    const track = this.localVideoTrack;
    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((s: any) => s.track === track);
      if (sender) {
        try { pc.removeTrack(sender); } catch {}
      }
    }
    this.localVideoStream?.getTracks().forEach(t => t.stop());
    this.localVideoStream = null;
    this.localVideoTrack = null;
    this.localVideoKind = null;
    this.events.onLocalVideoChanged?.(null, null);
  }

  private makePeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 10,
    } as any);

    // Deterministic tie-break: the peer with the lexicographically smaller
    // id is "polite" (backs off on a renegotiation collision). Same
    // approach as desktop's engine.ts.
    this.polite.set(peerId, this.selfId < peerId);
    this.makingOffer.set(peerId, false);
    this.ignoreOffer.set(peerId, false);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream as MediaStream);
      });
    }
    // A peer joining mid-share should still see it — add whatever local
    // video (camera/screen) is already active to this brand-new connection.
    if (this.localVideoTrack && this.localVideoStream) {
      pc.addTrack(this.localVideoTrack, this.localVideoStream);
    }

    (pc as any).onicecandidate = (e: any) => {
      if (e.candidate) {
        getSocket()?.emit('webrtc_ice', { to: peerId, candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
      }
    };

    (pc as any).ontrack = (e: any) => {
      const track = e.track;
      const stream: MediaStream | undefined = e.streams && e.streams[0];
      const entry: RemoteStreams = { ...(this.remoteStreams.get(peerId) ?? {}) };
      if (track.kind === 'video') {
        entry.video = stream ?? new MediaStream([track]);
      } else {
        entry.audio = stream ?? new MediaStream([track]);
        // A newly-arrived peer's audio should immediately respect an
        // already-active deafen, not play for one frame then get silenced.
        if (this.deafened) track.enabled = false;
      }
      this.remoteStreams.set(peerId, entry);
      this.events.onRemoteStreamsChanged?.(peerId, entry);

      track.addEventListener?.('ended', () => {
        const cur = { ...(this.remoteStreams.get(peerId) ?? {}) };
        if (track.kind === 'video') delete cur.video; else delete cur.audio;
        this.remoteStreams.set(peerId, cur);
        this.events.onRemoteStreamsChanged?.(peerId, cur);
      });
    };

    // Mid-call renegotiation trigger — fires when a peer (elsewhere in the
    // mesh) adds a track, e.g. someone starting a screen share. Mobile never
    // adds its own tracks after the initial connection in this pass, so this
    // only ever fires in response to a REMOTE addTrack surfacing here as a
    // need to answer — kept symmetric/complete rather than one-sided so the
    // connection behaves correctly regardless of which side changes tracks.
    (pc as any).onnegotiationneeded = () => {
      this.negotiate(peerId).catch(() => {});
    };

    this.peers.set(peerId, pc);
    return pc;
  }

  private async negotiate(peerId: string): Promise<void> {
    const pc = this.peers.get(peerId);
    if (!pc) return;
    try {
      this.makingOffer.set(peerId, true);
      const offer = await pc.createOffer({} as any);
      await pc.setLocalDescription(offer);
      getSocket()?.emit('webrtc_offer', { to: peerId, sdp: descToPlain(pc.localDescription) });
    } catch (e: any) {
      this.events.onError?.(e?.message ?? 'Błąd renegocjacji połączenia');
    } finally {
      this.makingOffer.set(peerId, false);
    }
  }

  private onExistingUsers = async ({ channel_id, user_ids }: { channel_id: string; user_ids: string[] }) => {
    if (this.mode !== 'channel' || channel_id !== this.channelId) return;
    for (const peerId of user_ids) {
      if (this.peers.has(peerId)) continue;
      const pc = this.makePeerConnection(peerId);
      try {
        const offer = await pc.createOffer({} as any);
        await pc.setLocalDescription(offer);
        getSocket()?.emit('webrtc_offer', { to: peerId, sdp: descToPlain(pc.localDescription) });
      } catch (e: any) {
        this.events.onError?.(e?.message ?? `Błąd połączenia z uczestnikiem`);
      }
    }
  };

  // Handles both the INITIAL offer (fresh connection, always accepted) and a
  // RENEGOTIATION offer arriving on an already-`stable` connection (e.g. a
  // peer just started sharing their screen) — Perfect Negotiation glare
  // handling covers the case where both sides happen to renegotiate at once.
  private onOffer = async ({ from, sdp }: { from: string; sdp: any }) => {
    if (!this.mode) return; // no active channel-mesh or direct-call session
    let pc = this.peers.get(from);
    if (!pc) pc = this.makePeerConnection(from);

    const polite = this.polite.get(from) ?? (this.selfId < from);
    const offerCollision = sdp?.type === 'offer' &&
      (this.makingOffer.get(from) === true || pc.signalingState !== 'stable');

    this.ignoreOffer.set(from, !polite && offerCollision);
    if (this.ignoreOffer.get(from)) {
      return; // impolite peer ignores the colliding offer, keeps its own in flight
    }

    try {
      // Per spec, setRemoteDescription(offer) while in 'have-local-offer'
      // implicitly rolls back the local offer — this is what lets the polite
      // peer safely accept an incoming offer instead of its own.
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      getSocket()?.emit('webrtc_answer', { to: from, sdp: descToPlain(pc.localDescription) });
    } catch (e: any) {
      this.events.onError?.(e?.message ?? `Błąd odpowiedzi na połączenie`);
    }
  };

  private onAnswer = async ({ from, sdp }: { from: string; sdp: any }) => {
    const pc = this.peers.get(from);
    if (!pc) return;
    try {
      await pc.setRemoteDescription(sdp);
    } catch (e: any) {
      this.events.onError?.(e?.message ?? `Błąd negocjacji połączenia`);
    }
  };

  private onIce = async ({ from, candidate }: { from: string; candidate: any }) => {
    const pc = this.peers.get(from);
    if (!pc || !candidate) return;
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Benign — candidates can arrive before the remote description is set,
      // or be rejected while an offer was deliberately ignored (glare).
    }
  };
}

/** Single shared instance — only one active voice-channel session at a time. */
export const voiceMesh = new VoiceMeshManager();
