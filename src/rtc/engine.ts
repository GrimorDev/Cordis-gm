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
  /** True once setRemoteDescription has been called at least once. */
  hasRemoteDesc: boolean;
  /**
   * ICE candidates that arrived before setRemoteDescription was called.
   * Chrome/WebKit throw "Cannot add ICE candidate when there is no remote SDP"
   * if addIceCandidate is called before setRemoteDescription, so we buffer them
   * here and flush them immediately after setRemoteDescription completes.
   *
   * This is the most common cause of "conn new" staying forever: the remote peer
   * gathers and emits ICE candidates in parallel with sending the offer, so
   * candidates often arrive at the JS bridge before the offer has been processed
   * and setRemoteDescription called.  Without queuing, all those candidates are
   * silently dropped → no usable ICE pair → connection stays at "new" / "checking".
   */
  iceCandidateQueue: RTCIceCandidateInit[];
}

interface LocalEntry { track: MediaStreamTrack; stream: MediaStream; }

export class VoiceEngine {
  private peers = new Map<string, Peer>();
  /**
   * ICE candidates that arrived for a remoteId BEFORE connect() was called
   * (i.e. before the RTCPeerConnection object even exists yet).  This happens
   * when the signaling server delivers candidates faster than we create peers —
   * e.g. the answerer receives ICE candidates before the offer is processed.
   * Flushed into Peer.iceCandidateQueue when connect() creates the peer.
   */
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
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
      hasRemoteDesc: false,
      iceCandidateQueue: [],
    };
    this.peers.set(remoteId, peer);

    // Flush any ICE candidates that arrived before the peer object was created.
    // This is common: the remote side sends offer + ICE candidates in rapid
    // succession; the candidates hit handleIce() first and get buffered in
    // pendingCandidates.  Move them to iceCandidateQueue so they are applied
    // once setRemoteDescription completes (see handleDescription below).
    const prePeer = this.pendingCandidates.get(remoteId);
    if (prePeer?.length) {
      peer.iceCandidateQueue.push(...prePeer);
      this.pendingCandidates.delete(remoteId);
    }

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
        // ── Glare guard ───────────────────────────────────────────────────
        // createOffer() above is async — a remote offer can arrive and be
        // applied (via handleDescription's setRemoteDescription, with implicit
        // rollback when we're polite) WHILE we're waiting for it. If that
        // happened, signalingState is no longer 'stable' and the `offer` we
        // just captured is stale: calling setLocalDescription(offer) throws
        // "InvalidStateError: Called in wrong state: have-remote-offer" —
        // exactly the error that was flooding the console here.
        // Worse than the noisy log: a thrown setLocalDescription means OUR
        // side's audio sender/transceiver direction is never (re)applied to
        // the local description for this round — the connection still reaches
        // "connected" (ICE/DTLS came up via the OTHER peer's offer→answer
        // exchange), but our m-line can end up missing/misdirected, so zero
        // audio bytes actually leave while everything *looks* fine. This is
        // consistent with the "I light up but nobody hears me" reports.
        // Fix: bail out cleanly when we detect the race (synchronously, so no
        // further state change can sneak in before setLocalDescription). The
        // incoming offer is already being handled by handleDescription, whose
        // createAnswer() reflects our CURRENT senders (including this track) —
        // nothing is lost, and the browser will re-fire negotiationneeded once
        // back to 'stable' if anything still needs (re)negotiating.
        if (pc.signalingState !== 'stable') {
          console.log(`[rtc] onnegotiationneeded(${remoteId}): collision — state is ${pc.signalingState}, yielding to incoming offer (no audio dropped)`);
          return;
        }
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

    // ── Flush queued ICE candidates ───────────────────────────────────────────
    // Any candidate that arrived before (or during) setRemoteDescription was
    // buffered in peer.iceCandidateQueue to avoid the "no remote SDP" error.
    // Now that the remote description is set, apply them all.
    peer.hasRemoteDesc = true;
    if (peer.iceCandidateQueue.length) {
      const queued = peer.iceCandidateQueue.splice(0);
      console.log(`[rtc] flushing ${queued.length} queued ICE candidate(s) for ${from}`);
      for (const c of queued) {
        try { await pc.addIceCandidate(c); } catch { /* ignore stale candidates */ }
      }
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

    if (!peer) {
      // Peer object doesn't exist yet (offer not received / processed yet).
      // Buffer the candidate — it will be moved to peer.iceCandidateQueue when
      // connect() creates the peer, and then applied after setRemoteDescription.
      const q = this.pendingCandidates.get(from) ?? [];
      q.push(candidate);
      this.pendingCandidates.set(from, q);
      return;
    }

    if (!peer.hasRemoteDesc) {
      // Peer exists but setRemoteDescription hasn't been called yet.
      // Buffer until handleDescription flushes the queue.
      peer.iceCandidateQueue.push(candidate);
      return;
    }

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

  /**
   * Live state of the local microphone track for diagnostics — lets the on-screen
   * panel distinguish "track exists but enabled=false / not live" (silence is
   * being sent on purpose or the device died) from "no track at all".
   */
  localAudioTrackInfo(): { label: string; enabled: boolean; muted: boolean; readyState: MediaStreamTrackState } | null {
    const entry = this.localTracks.find(e => e.track.kind === 'audio');
    if (!entry) return null;
    const t = entry.track;
    return { label: t.label, enabled: t.enabled, muted: t.muted, readyState: t.readyState };
  }

  /**
   * Per-peer outbound/inbound audio RTP byte counters straight from getStats() —
   * the ground truth for "is audio actually flowing", independent of connectionState
   * (which can read "connected" while the media path is silently dead).
   */
  async audioRtpStats(): Promise<Array<{ id: string; outBytes: number; outPackets: number; inBytes: number; inPackets: number }>> {
    const results: Array<{ id: string; outBytes: number; outPackets: number; inBytes: number; inPackets: number }> = [];
    for (const [id, p] of this.peers.entries()) {
      let outBytes = 0, outPackets = 0, inBytes = 0, inPackets = 0;
      try {
        const report = await p.pc.getStats();
        report.forEach(stat => {
          if (stat.kind !== 'audio') return;
          if (stat.type === 'outbound-rtp') { outBytes += stat.bytesSent || 0; outPackets += stat.packetsSent || 0; }
          else if (stat.type === 'inbound-rtp') { inBytes += stat.bytesReceived || 0; inPackets += stat.packetsReceived || 0; }
        });
      } catch { /* ignore */ }
      results.push({ id, outBytes, outPackets, inBytes, inPackets });
    }
    return results;
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
