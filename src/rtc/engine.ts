// ─── VoiceEngine — WebRTC full-mesh built on the Perfect Negotiation pattern ──
//
// Replaces the old hand-rolled openPeer(isInitiator) + manual createOffer in every
// toggle. The Perfect Negotiation pattern (https://w3c.github.io/webrtc-pc/#perfect-negotiation)
// makes mesh renegotiation robust: adding/removing tracks (mic, camera, screen),
// ICE restarts and simultaneous offers (glare) are all handled by ONE code path.
//
// Politeness is derived deterministically from the two user IDs so exactly one
// side is "polite": the polite peer yields on collision, the impolite peer ignores
// the incoming offer. No flags, no race conditions.
//
// Signalling reuses the existing Socket.IO events (webrtc_offer / webrtc_answer /
// webrtc_ice) — the backend is untouched. Offers and answers both flow into
// handleDescription(); the engine decides what to do based on SDP type + state.

import {
  ICE_SERVERS,
  preferH264,
  preferOpusStereo,
  getBitrateProfile,
  tuneAudioSender,
  tuneVideoSenders,
  type ScreenQuality,
} from '../webrtc';

export interface EngineConfig {
  /** Our own user id — used to compute politeness deterministically. */
  selfId: string;
  emitOffer:  (to: string, sdp: RTCSessionDescriptionInit) => void;
  emitAnswer: (to: string, sdp: RTCSessionDescriptionInit) => void;
  emitIce:    (to: string, candidate: RTCIceCandidateInit) => void;
  /** Fired for every inbound remote track so the app can attach playback / video. */
  onRemoteTrack: (peerId: string, track: MediaStreamTrack, stream: MediaStream) => void;
  /** Optional: surfaced connection-state changes (for toasts / UI). */
  onPeerState?: (peerId: string, state: RTCPeerConnectionState) => void;
  /** Live participant count (incl. self) for adaptive bitrate. */
  getParticipantCount: () => number;
  /** Current local screen-share stream (for video bitrate tuning), or null. */
  getScreenStream: () => MediaStream | null;
  getScreenQuality: () => ScreenQuality;
}

interface Peer {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
}

interface LocalEntry { track: MediaStreamTrack; stream: MediaStream; }

export class VoiceEngine {
  private peers = new Map<string, Peer>();
  /** Tracks that must be present on every peer (mic, camera, screen). */
  private localTracks: LocalEntry[] = [];
  /** Diagnostics — surfaced in the on-screen panel to pinpoint failures. */
  private stats = {
    rtcAvailable: typeof RTCPeerConnection === 'function',
    connectCalls: 0, peersCreated: 0,
    offersRecv: 0, answersRecv: 0, iceRecv: 0,
    lastError: '',
  };

  constructor(private cfg: EngineConfig) {}

  diagnosticsStats() { return { ...this.stats }; }

  private munge(sdp?: string): string {
    return preferOpusStereo(preferH264(sdp ?? ''));
  }

  private tune(pc: RTCPeerConnection): void {
    try {
      const count   = this.cfg.getParticipantCount();
      const screen  = this.cfg.getScreenStream();
      const quality = this.cfg.getScreenQuality();
      const profile = getBitrateProfile(count, !!screen, quality);
      tuneAudioSender(pc, profile);
      tuneVideoSenders(pc, screen, profile, quality);
    } catch { /* best-effort */ }
  }

  /** Create (or return existing) peer connection and wire Perfect Negotiation. */
  connect(remoteId: string): RTCPeerConnection | undefined {
    const existing = this.peers.get(remoteId);
    if (existing) return existing.pc;

    this.stats.connectCalls++;
    if (typeof RTCPeerConnection !== 'function') {
      this.stats.lastError = 'RTCPeerConnection unavailable (WebRTC disabled in this WebView)';
      console.error('[rtc]', this.stats.lastError);
      return undefined;
    }

    let pc: RTCPeerConnection;
    try {
      pc = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceCandidatePoolSize: 10,
      });
    } catch (e) {
      this.stats.lastError = 'new RTCPeerConnection failed: ' + String((e as any)?.message || e);
      console.error('[rtc]', this.stats.lastError);
      return undefined;
    }
    this.stats.peersCreated++;

    // Polite = the lexicographically GREATER id. Both sides compute the same
    // answer, so exactly one peer is polite.
    const peer: Peer = {
      pc,
      polite: this.cfg.selfId > remoteId,
      makingOffer: false,
      ignoreOffer: false,
    };
    this.peers.set(remoteId, peer);

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.cfg.emitIce(remoteId, candidate.toJSON());
    };

    pc.ontrack = ({ track, streams }) => {
      const stream = streams[0];
      console.log(`[rtc] ontrack from ${remoteId}: kind=${track.kind} stream=${stream?.id ?? 'none'}`);
      if (!stream) return;
      this.cfg.onRemoteTrack(remoteId, track, stream);
    };

    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        const offer = await pc.createOffer();
        offer.sdp = this.munge(offer.sdp);
        await pc.setLocalDescription(offer);
        this.tune(pc);
        console.log(`[rtc] negotiation → offer to ${remoteId}`);
        this.cfg.emitOffer(remoteId, pc.localDescription!.toJSON());
      } catch (err) {
        console.error('[rtc] onnegotiationneeded error:', err);
      } finally {
        peer.makingOffer = false;
      }
    };

    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log(`[rtc] ICE (${remoteId}):`, s);
      if (s === 'failed') {
        console.warn('[rtc] ICE failed — restartIce', remoteId);
        try { pc.restartIce(); } catch {}
      }
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log(`[rtc] connection (${remoteId}):`, s);
      this.cfg.onPeerState?.(remoteId, s);
      if (s === 'failed') {
        // Recover by forcing a fresh ICE gathering cycle.
        try { pc.restartIce(); } catch {}
      }
    };

    // Seed the connection with every local track. Synchronous addTrack calls are
    // batched by the browser into a single onnegotiationneeded → one offer.
    for (const { track, stream } of this.localTracks) {
      try { pc.addTrack(track, stream); } catch {}
    }

    return pc;
  }

  /** Handle an inbound offer OR answer (both routed here). */
  async handleDescription(from: string, description: RTCSessionDescriptionInit): Promise<void> {
    if (description.type === 'offer') this.stats.offersRecv++; else this.stats.answersRecv++;
    // We must have a peer; if an offer arrives for an unknown peer, create one.
    let peer = this.peers.get(from);
    if (!peer) {
      if (description.type !== 'offer') return; // answer for a peer we don't have — ignore
      this.connect(from);
      peer = this.peers.get(from);
      if (!peer) return; // connect() failed (WebRTC unavailable) — stats.lastError is set
    }
    const { pc } = peer;

    const collision =
      description.type === 'offer' &&
      (peer.makingOffer || pc.signalingState !== 'stable');

    peer.ignoreOffer = !peer.polite && collision;
    if (peer.ignoreOffer) {
      console.log(`[rtc] impolite — ignoring colliding offer from ${from}`);
      return;
    }

    try {
      // setRemoteDescription performs an implicit rollback of our own local offer
      // when we are polite and a collision happened.
      await pc.setRemoteDescription(description);
    } catch (err) {
      console.error('[rtc] setRemoteDescription failed:', err);
      return;
    }

    if (description.type === 'offer') {
      try {
        const answer = await pc.createAnswer();
        answer.sdp = this.munge(answer.sdp);
        await pc.setLocalDescription(answer);
        this.tune(pc);
        console.log(`[rtc] negotiation → answer to ${from}`);
        this.cfg.emitAnswer(from, pc.localDescription!.toJSON());
      } catch (err) {
        console.error('[rtc] createAnswer failed:', err);
      }
    }
  }

  async handleIce(from: string, candidate: RTCIceCandidateInit): Promise<void> {
    this.stats.iceRecv++;
    const peer = this.peers.get(from);
    if (!peer) return;
    try {
      await peer.pc.addIceCandidate(candidate);
    } catch (err) {
      // Candidates that arrive while a colliding offer was ignored are expected
      // to fail — only surface real errors.
      if (!peer.ignoreOffer) console.warn('[rtc] addIceCandidate failed:', err);
    }
  }

  /** Add a local track to all peers and remember it for future peers. */
  addLocalTrack(track: MediaStreamTrack, stream: MediaStream): void {
    this.localTracks.push({ track, stream });
    this.peers.forEach(({ pc }) => {
      try { pc.addTrack(track, stream); } catch {}
    });
  }

  /**
   * Replace the currently-sent audio track (mic device switch / mute) without a
   * full renegotiation. If no audio sender exists yet, falls back to addLocalTrack.
   */
  replaceAudioTrack(track: MediaStreamTrack, stream: MediaStream): void {
    // Update remembered local tracks (drop old audio, keep video/screen).
    this.localTracks = this.localTracks.filter(e => e.track.kind !== 'audio');
    this.localTracks.push({ track, stream });
    this.peers.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) sender.replaceTrack(track).catch(() => {});
      else { try { pc.addTrack(track, stream); } catch {} }
    });
  }

  /**
   * Swap a specific already-sent track for a new one on every peer WITHOUT
   * renegotiation (used for live mic/camera device changes mid-call).
   * Returns true if at least one sender was updated.
   */
  replaceTrackByOld(oldTrack: MediaStreamTrack, newTrack: MediaStreamTrack, stream: MediaStream): boolean {
    let replaced = false;
    this.peers.forEach(({ pc }) => {
      const sender = pc.getSenders().find(s => s.track === oldTrack);
      if (sender) { sender.replaceTrack(newTrack).catch(() => {}); replaced = true; }
    });
    const idx = this.localTracks.findIndex(e => e.track === oldTrack);
    if (idx >= 0) this.localTracks[idx] = { track: newTrack, stream };
    return replaced;
  }

  /** Remove every local track matching the predicate (e.g. by kind or stream id). */
  removeLocalTracks(match: (e: LocalEntry) => boolean): void {
    const removed = this.localTracks.filter(match);
    this.localTracks = this.localTracks.filter(e => !match(e));
    this.peers.forEach(({ pc }) => {
      removed.forEach(({ track }) => {
        const sender = pc.getSenders().find(s => s.track === track);
        if (sender) { try { pc.removeTrack(sender); } catch {} }
      });
    });
  }

  /** Re-apply adaptive bitrate to all peers (e.g. when participant count changes). */
  retuneAll(): void {
    this.peers.forEach(({ pc }) => this.tune(pc));
  }

  getPeer(remoteId: string): RTCPeerConnection | undefined {
    return this.peers.get(remoteId)?.pc;
  }

  /** All live peer connections (for stats / diagnostics). */
  allPeerConnections(): RTCPeerConnection[] {
    return [...this.peers.values()].map(p => p.pc);
  }

  /** Human-readable per-peer state for the on-screen diagnostics panel. */
  peerDiagnostics(): Array<{
    id: string; polite: boolean;
    conn: RTCPeerConnectionState; ice: RTCIceConnectionState; sig: RTCSignalingState;
    send: string[]; recv: string[];
  }> {
    return [...this.peers.entries()].map(([id, p]) => ({
      id,
      polite: p.polite,
      conn: p.pc.connectionState,
      ice:  p.pc.iceConnectionState,
      sig:  p.pc.signalingState,
      send: p.pc.getSenders().filter(s => s.track).map(s => s.track!.kind),
      recv: p.pc.getReceivers().filter(r => r.track).map(r => r.track.kind),
    }));
  }

  /** Names of remembered local tracks (mic/camera/screen) the engine will send. */
  localTrackKinds(): string[] {
    return this.localTracks.map(e => e.track.kind);
  }

  hasPeer(remoteId: string): boolean {
    return this.peers.has(remoteId);
  }

  peerCount(): number {
    return this.peers.size;
  }

  closePeer(remoteId: string): void {
    const peer = this.peers.get(remoteId);
    if (peer) { try { peer.pc.close(); } catch {} this.peers.delete(remoteId); }
  }

  /** Close all peers but keep remembered local tracks (e.g. channel switch). */
  closeAllPeers(): void {
    this.peers.forEach(p => { try { p.pc.close(); } catch {} });
    this.peers.clear();
  }

  /** Full teardown: close peers and forget local tracks. */
  destroy(): void {
    this.closeAllPeers();
    this.localTracks = [];
  }
}
