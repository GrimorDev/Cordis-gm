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

  /**
   * Promise that resolves when the Rust-side peer has been successfully created
   * via rtc_create_pc.  The constructor fires that IPC call without await, so any
   * subsequent setRemoteDescription call MUST await this before invoking the Rust
   * command — otherwise rtc_set_remote_description arrives before rtc_create_pc
   * has been processed and Rust returns "peer not found".
   *
   * _recreatePeer() resets this field with the new creation promise.
   */
  private _peerReady: Promise<void>;

  constructor(config?: RTCConfiguration) {
    this._id = genId();

    this._iceServers = (config?.iceServers ?? []).map((s: RTCIceServer) => ({
      urls:       Array.isArray(s.urls) ? s.urls : [s.urls as string],
      username:   (s as any).username   ?? null,
      credential: (s as any).credential ?? null,
    }));

    // Create Rust-side peer connection.  Store the promise in _peerReady so that
    // setRemoteDescription can await it — otherwise "peer not found" from Rust
    // occurs when JS calls rtc_set_remote_description before the IPC roundtrip for
    // rtc_create_pc has returned (very common when the first offer arrives quickly).
    this._peerReady = (invoke('rtc_create_pc', { id: this._id, iceServers: this._iceServers }) as Promise<void>)
      .catch((e) => { console.error('[NativeRTC] rtc_create_pc failed:', e); });

    // Wire Tauri events → JS callbacks
    this._wire();
  }

  // Re-create the Rust-side peer connection (used when webrtc-rs can't
  // re-negotiate on a previously-used connection).  Tauri event listeners
  // (wired in _wire()) use the same ID so they pick up events from the new peer.
  private async _recreatePeer(): Promise<void> {
    await invoke('rtc_close_pc', { id: this._id }).catch(() => {});
    // Reset _peerReady so subsequent callers (incl. the retry in setRemoteDescription)
    // wait for this new creation before making any other Rust calls.
    this._peerReady = (invoke('rtc_create_pc', { id: this._id, iceServers: this._iceServers }) as Promise<void>)
      .catch(() => {});
    await this._peerReady;
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
    console.log('[NativeRTC] createAnswer called, signalingState:', this.signalingState);
    try {
      const sdp = await invoke<string>('rtc_create_answer', { id: this._id });
      console.log('[NativeRTC] createAnswer SUCCESS, SDP sections:', sdp.match(/^m=\w+/gm)?.join(' '));
      return { type: 'answer', sdp };
    } catch (e) {
      console.error('[NativeRTC] createAnswer FAILED:', e,
        '| signalingState:', this.signalingState);
      throw e;
    }
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    // engine.ts calls pc.localDescription!.toJSON() after setLocalDescription.
    // A plain {type, sdp} object doesn't have toJSON() → TypeError → offer never emitted.
    // We add toJSON() explicitly so the engine's emitOffer/emitAnswer calls work.
    //
    // IMPORTANT: Do NOT call rtc_set_local_description in Rust here.
    // rtc_create_offer / rtc_create_answer already call set_local_description internally
    // with the ORIGINAL (unmunged) SDP that webrtc-rs generated.  If we called
    // rtc_set_local_description again with the JS-munged SDP (preferH264 + preferOpusStereo),
    // webrtc-rs would reject it because the munged SDP no longer matches its internal state
    // (reordered video payload types, added Opus fmtp fields, etc.) → ICE never starts
    // → connection stays at "new" forever.
    //
    // We update only the JS-side localDescription so emitOffer/emitAnswer send the
    // munged SDP to the remote peer (which is correct — Chrome handles Opus stereo hints).
    const sdp  = desc.sdp ?? '';
    const type = desc.type as RTCSdpType;
    this.localDescription = { type, sdp, toJSON: () => ({ type, sdp }) } as RTCSessionDescription;
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

    // Log first 300 chars of offer SDP for debugging (helps diagnose Chrome compatibility)
    if (type === 'offer') {
      console.log('[NativeRTC] setRemoteDescription offer, SDP sections:',
        sdp.match(/^m=\w+/gm)?.join(' ') ?? 'unknown');
    }

    // Ensure the Rust peer exists before calling rtc_set_remote_description.
    // The constructor fires rtc_create_pc without await — if an offer arrives
    // before the IPC roundtrip returns (very common), Rust would return
    // "peer not found" causing a spurious _recreatePeer() cascade.
    await this._peerReady;

    const trySet = () => invoke('rtc_set_remote_description', { id: this._id, type, sdp });
    try {
      await trySet();
    } catch (e) {
      console.warn('[NativeRTC] setRemoteDescription failed, recreating peer:', e);
      this._blockNegotiation = true;
      try {
        await this._recreatePeer(); // _peerReady is reset + awaited inside _recreatePeer
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
    // Key naming: Tauri serializes camelCase JS keys to snake_case Rust params via
    // serde rename_all="camelCase".  The Rust param `sdp_mline_index` converts to
    // camelCase as `sdpMlineIndex` (mline = one word) — NOT `sdpMLineIndex` (capital L).
    await invoke('rtc_add_ice_candidate', {
      id:              this._id,
      candidate:       candidate.candidate,
      sdpMid:          candidate.sdpMid ?? null,
      sdpMlineIndex:   candidate.sdpMLineIndex ?? null,  // was: sdpMLineIndex (wrong key)
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
 * Called by main.tsx on Linux Tauri ONLY when WebKitGTK lacks RTCPeerConnection
 * (i.e. the very first page load before lib.rs applies enable-webrtc and reloads).
 *
 * After the settings reload, WebKitGTK exposes a native RTCPeerConnection with
 * full video support, so this polyfill is NOT injected on subsequent loads.
 *
 * Sets window.__nativeRtcPolyfill = true so App.tsx knows the video/screen-share
 * buttons should be disabled (this path is audio-only — video tracks are no-ops).
 */
export function injectNativeRtcPolyfill(): void {
  console.info('[Cordyn] Injecting native RTCPeerConnection polyfill (webrtc-rs + cpal, audio only)');
  (window as any).RTCPeerConnection = NativeRTCPeerConnection;
  // Signal to App.tsx that video cannot be transmitted in this fallback path.
  (window as any).__nativeRtcPolyfill = true;
}
