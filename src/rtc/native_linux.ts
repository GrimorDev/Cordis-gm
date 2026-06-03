// ── Linux native RTCPeerConnection polyfill ───────────────────────────────────
//
// On Linux Tauri when WebKitGTK does not expose RTCPeerConnection, this module
// injects window.RTCPeerConnection backed by webrtc-rs via Tauri IPC.
//
// The existing VoiceEngine (engine.ts) works UNCHANGED — it calls
// `new RTCPeerConnection(config)` and gets this class instead.
//
// Usage: call injectNativeRtcPolyfill() once in main.tsx before React mounts
// when running on Linux Tauri with RTCPeerConnection missing.

import { invoke, Channel } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ── Internal helpers ─────────────────────────────────────────────────────────

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// Tauri event payloads emitted by rtc_linux.rs
interface IceCandidatePayload {
  pc_id:             string;
  candidate:         string;
  sdp_mid?:          string;
  sdp_m_line_index?: number;
}
interface StatePayload  { pc_id: string; state: string; }
interface TrackPayload  { pc_id: string; kind: string; }

// ── Polyfill class ────────────────────────────────────────────────────────────

class NativeRTCPeerConnection implements Partial<RTCPeerConnection> {
  // Internal ID shared with Rust
  private readonly _id: string;

  // RTCPeerConnection public callbacks
  onicecandidate:            ((e: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack:                   ((e: RTCTrackEvent) => void) | null = null;
  onnegotiationneeded:       (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange:   (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;

  // State strings mirroring browser RTCPeerConnection
  iceConnectionState:  RTCIceConnectionState   = 'new';
  iceGatheringState:   RTCIceGatheringState     = 'new';
  connectionState:     RTCPeerConnectionState   = 'new';
  signalingState:      RTCSignalingState        = 'stable';
  localDescription:    RTCSessionDescription | null = null;
  remoteDescription:   RTCSessionDescription | null = null;

  private _unlisteners: UnlistenFn[] = [];
  private _closed = false;
  // Block onnegotiationneeded during _recreatePeer() + retry window to prevent
  // race condition where the new Rust peer fires negotiation before the remote
  // offer is processed, causing current_local_description to be set with an
  // offer — which then makes create_answer() fail with "does not match".
  private _blockNegotiation = false;

  // Store ICE servers so we can recreate the Rust peer when needed
  private readonly _iceServers: object[];

  constructor(config?: RTCConfiguration) {
    this._id = genId();

    this._iceServers = (config?.iceServers ?? []).map((s: RTCIceServer) => ({
      urls:       Array.isArray(s.urls) ? s.urls : [s.urls as string],
      username:   (s as any).username   ?? null,
      credential: (s as any).credential ?? null,
    }));

    // Create Rust-side peer connection
    invoke('rtc_create_pc', { id: this._id, iceServers: this._iceServers }).catch((e) =>
      console.error('[NativeRTC] rtc_create_pc failed:', e)
    );

    // Wire Tauri events → JS callbacks
    this._wire();
  }

  // Re-create the Rust-side peer connection (used when webrtc-rs can't
  // re-negotiate on a previously-used connection).  Tauri event listeners
  // (wired in _wire()) use the same ID so they pick up events from the new peer.
  private async _recreatePeer(): Promise<void> {
    await invoke('rtc_close_pc', { id: this._id }).catch(() => {});
    await invoke('rtc_create_pc', { id: this._id, iceServers: this._iceServers });
    this.signalingState   = 'stable';
    this.connectionState  = 'new';
    this.iceConnectionState = 'new';
    this.localDescription  = null;
    this.remoteDescription = null;
  }

  private async _wire() {
    const id = this._id;

    const u1 = await listen<IceCandidatePayload>('rtc_ice_candidate', (e) => {
      if (e.payload.pc_id !== id) return;
      // Don't use `new RTCIceCandidate()` — it may not exist in WebKitGTK when
      // WebRTC is disabled.  Create a plain object with toJSON() so engine.ts
      // `candidate.toJSON()` call succeeds.
      // Note: Rust serializes sdp_mline_index (not sdp_m_line_index).
      const cand = e.payload.candidate;
      const mid  = e.payload.sdp_mid ?? null;
      const mli  = e.payload.sdp_mline_index ?? null;
      const candidate = {
        candidate:       cand,
        sdpMid:          mid,
        sdpMLineIndex:   mli,
        usernameFragment: null,
        toJSON: () => ({ candidate: cand, sdpMid: mid, sdpMLineIndex: mli, usernameFragment: null }),
      } as unknown as RTCIceCandidate;
      this.onicecandidate?.({ candidate } as RTCPeerConnectionIceEvent);
    });

    const u2 = await listen<StatePayload>('rtc_connection_state', (e) => {
      if (e.payload.pc_id !== id) return;
      this.connectionState = e.payload.state as RTCPeerConnectionState;
      this.onconnectionstatechange?.();
      // Map connection state to ICE connection state (approximate)
      const iceMap: Record<string, RTCIceConnectionState> = {
        new: 'new', connecting: 'checking', connected: 'connected',
        disconnected: 'disconnected', failed: 'failed', closed: 'closed',
      };
      const ice = iceMap[e.payload.state] ?? 'new';
      if (ice !== this.iceConnectionState) {
        this.iceConnectionState = ice as RTCIceConnectionState;
        this.oniceconnectionstatechange?.();
      }
    });

    // NOTE: rtc_negotiation_needed Rust events are NOT wired here (see addTrack()).

    const u3 = await listen<TrackPayload>('rtc_track_added', (e) => {
      if (e.payload.pc_id !== id) return;
      // Use plain objects — new MediaStream() / new MediaStreamTrack() constructors
      // may not be available when WebKitGTK has WebRTC disabled.
      // __nativeRtc: true → App.tsx skips browser audio attachment (cpal plays it).
      const kind = e.payload.kind;
      const tid  = `native-${id}-${kind}`;
      const track: any = {
        kind, id: tid, enabled: true, muted: false, readyState: 'live', label: tid,
        onended: null, onmute: null, onunmute: null,
        stop: () => {}, getSettings: () => ({}), getConstraints: () => ({}),
        getCapabilities: () => ({}), applyConstraints: async () => {},
        clone: () => track,
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      };
      const stream: any = {
        id: `native-stream-${id}`, active: true, __nativeRtc: true, __pcId: id,
        getTracks: () => [track], getVideoTracks: () => (kind === 'video' ? [track] : []),
        getAudioTracks: () => (kind === 'audio' ? [track] : []),
        addTrack: () => {}, removeTrack: () => {},
        addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      };
      this.ontrack?.({ track, streams: [stream] } as unknown as RTCTrackEvent);
    });

    this._unlisteners.push(u1, u2, u3);
  }

  // ── RTCPeerConnection API ─────────────────────────────────────────────────

  async createOffer(_options?: RTCOfferOptions): Promise<RTCSessionDescriptionInit> {
    const sdp = await invoke<string>('rtc_create_offer', { id: this._id });
    return { type: 'offer', sdp };
  }

  async createAnswer(_options?: RTCAnswerOptions): Promise<RTCSessionDescriptionInit> {
    // Ask Rust to create the answer SDP (peer must be in "have-remote-offer" state).
    // JS will call setLocalDescription(answer) afterwards, which sets it in webrtc-rs.
    const sdp = await invoke<string>('rtc_create_answer', { id: this._id });
    return { type: 'answer', sdp };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    // engine.ts calls pc.localDescription!.toJSON() after setLocalDescription.
    // A plain {type, sdp} object doesn't have toJSON() → TypeError → offer never emitted.
    // We add toJSON() explicitly so the engine's emitOffer/emitAnswer calls work.
    const sdp  = desc.sdp ?? '';
    const type = desc.type as RTCSdpType;
    this.localDescription = { type, sdp, toJSON: () => ({ type, sdp }) } as RTCSessionDescription;
    await invoke('rtc_set_local_description', { id: this._id, type, sdp });
    this.signalingState = type === 'offer' ? 'have-local-offer' : 'stable';
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    const sdp  = desc.sdp ?? '';
    const type = desc.type as RTCSdpType;

    // If the Rust peer is in a bad state (prev failed ICE round), recreate it.
    // _blockNegotiation prevents the onnegotiationneeded race condition:
    //   rtc_create_pc adds audio track → would normally fire onnegotiationneeded
    //   → engine creates offer → sets current_local_description
    //   → create_answer() sees "previous answer" and fails
    // With _blockNegotiation=true the addTrack() onnegotiationneeded is suppressed
    // during the recreate+retry window.
    // Set signalingState BEFORE the await so that any queued addTrack() setTimeout
    // sees a non-stable state and suppresses onnegotiationneeded.  This prevents
    // engine.ts from calling setLocalDescription(offer) during our setRemoteDescription,
    // which would set current_local_description and make create_answer() fail.
    if (type === 'offer') this.signalingState = 'have-remote-offer';

    const trySet = () => invoke('rtc_set_remote_description', { id: this._id, type, sdp });
    try {
      await trySet();
    } catch (e) {
      console.warn('[NativeRTC] setRemoteDescription failed, recreating peer:', e);
      this._blockNegotiation = true;
      try {
        await this._recreatePeer();
        await trySet(); // retry on fresh peer
      } finally {
        this._blockNegotiation = false;
      }
    }

    this.remoteDescription = { type, sdp, toJSON: () => ({ type, sdp }) } as RTCSessionDescription;
    this.signalingState = type === 'offer' ? 'have-remote-offer' : 'stable';
  }

  async addIceCandidate(candidate: RTCIceCandidateInit | null): Promise<void> {
    if (!candidate?.candidate) return;
    await invoke('rtc_add_ice_candidate', {
      id:              this._id,
      candidate:       candidate.candidate,
      sdpMid:          candidate.sdpMid ?? null,
      sdpMLineIndex:   candidate.sdpMLineIndex ?? null,
    });
  }

  addTrack(_track: MediaStreamTrack, ..._streams: MediaStream[]): RTCRtpSender {
    // Fire onnegotiationneeded exactly like a real browser does when a track is added.
    // Check INSIDE the callback (not just at call time) so that if setRemoteDescription
    // starts before the timeout fires, we see the updated signalingState and don't
    // create a premature offer that would set current_local_description and break
    // create_answer() with "new sdp does not match previous answer".
    setTimeout(() => {
      if (!this._blockNegotiation && this.signalingState === 'stable') {
        this.onnegotiationneeded?.();
      }
    }, 0);
    // Mic capture is started by rtc_create_pc in Rust — no extra action needed.
    return {
      track:         _track,
      transport:     null,
      dtmf:          null,
      getParameters: () => ({ encodings: [{}], codecs: [], headerExtensions: [], rtcp: {}, transactionId: '' }),
      setParameters: async () => {},
      getStats:      async () => new Map(),
      replaceTrack:  async () => {},
    } as unknown as RTCRtpSender;
  }

  getSenders(): RTCRtpSender[] {
    // Return empty — bitrate tuning via setParameters is a no-op for native
    return [];
  }

  getReceivers(): RTCRtpReceiver[] { return []; }

  getTransceivers(): RTCRtpTransceiver[] { return []; }

  restartIce(): void {
    // Close the Rust peer so setRemoteDescription can detect the stale state
    // and recreate a fresh one (via _recreatePeer) when the remote sends a
    // new offer.  The JS polyfill object (engine.ts peers map entry) stays
    // alive — the next setRemoteDescription call auto-recreates the Rust peer.
    invoke('rtc_close_pc', { id: this._id }).catch(() => {});
    this.connectionState  = 'closed';
    this.iceConnectionState = 'closed';
    this.onconnectionstatechange?.();
    this.oniceconnectionstatechange?.();
  }

  async close(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    this._unlisteners.forEach((u) => u());
    this._unlisteners = [];
    await invoke('rtc_close_pc', { id: this._id }).catch(() => {});
    this.connectionState = 'closed';
    this.onconnectionstatechange?.();
  }

  // Properties required by some code paths
  get sctp(): RTCSctpTransport | null { return null; }
  get canTrickleIceCandidates(): boolean | null { return true; }
  get pendingLocalDescription(): RTCSessionDescription | null { return null; }
  get pendingRemoteDescription(): RTCSessionDescription | null { return null; }

  // Stubs for unused APIs
  async getStats(): Promise<RTCStatsReport> { return new Map() as any; }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
  createDataChannel(): RTCDataChannel { throw new Error('Not supported in native mode'); }
}

// ── Injection ─────────────────────────────────────────────────────────────────

/**
 * Call once in main.tsx on Linux Tauri when RTCPeerConnection is missing.
 * Injects NativeRTCPeerConnection as window.RTCPeerConnection so the entire
 * existing engine.ts works without any changes.
 */
export function injectNativeRtcPolyfill(): void {
  // Always replace — WebKitGTK's built-in WebRTC has a broken receive path on Linux
  // even when RTCPeerConnection exists (audio only flows one way).  Our Rust polyfill
  // (webrtc-rs + cpal) is always more reliable than WebKit's partial implementation.
  console.info('[Cordyn] Injecting native RTCPeerConnection polyfill (webrtc-rs + cpal)');
  (window as any).RTCPeerConnection = NativeRTCPeerConnection;
}
