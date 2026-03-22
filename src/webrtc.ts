// ─── WebRTC Utilities for Cordis ─────────────────────────────────────────────

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// ─── Peer Connection ─────────────────────────────────────────────────────────
export function makePeerConnection(
  onIce: (c: RTCIceCandidateInit) => void,
  onTrack: (e: RTCTrackEvent) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  pc.onicecandidate = e => { if (e.candidate) onIce(e.candidate.toJSON()); };
  pc.ontrack = onTrack;
  return pc;
}

// ─── Remote Audio Elements ───────────────────────────────────────────────────
const remoteAudios = new Map<string, HTMLAudioElement>();       // microphone audio
const remoteScreenAudios = new Map<string, HTMLAudioElement>(); // screen-share audio (separate element)

function makeAudioEl(): HTMLAudioElement {
  const el = document.createElement('audio');
  el.autoplay = true;
  el.style.display = 'none';
  document.body.appendChild(el);
  return el;
}

export function attachRemoteAudio(userId: string, stream: MediaStream) {
  let el = remoteAudios.get(userId);
  if (!el) {
    el = makeAudioEl();
    remoteAudios.set(userId, el);
    // Twórz GainNode od razu — aby volume 0–200% działało zanim użytkownik ruszy suwakiem.
    // AudioContext musi być wznowiony po pierwszym zdarzeniu play (polityka autoplay).
    try {
      const ctx = new AudioContext({ sampleRate: 48000 });
      const src = ctx.createMediaElementSource(el);
      const gainNode = ctx.createGain();
      gainNode.gain.value = 1;
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNodes.set(userId, { ctx, gain: gainNode });
      el.addEventListener('play', () => ctx.resume().catch(() => {}));
    } catch {
      // AudioContext niedostępny — głośność ograniczona do 100% przez el.volume
    }
  }
  el.srcObject = stream;
}

/** Separate element for screen-share audio so it doesn't overwrite mic audio. */
export function attachRemoteScreenAudio(userId: string, stream: MediaStream) {
  let el = remoteScreenAudios.get(userId);
  if (!el) { el = makeAudioEl(); remoteScreenAudios.set(userId, el); }
  el.srcObject = stream;
}

export function detachRemoteAudio(userId: string) {
  const el = remoteAudios.get(userId);
  if (el) { el.srcObject = null; el.remove(); remoteAudios.delete(userId); }
  const sel = remoteScreenAudios.get(userId);
  if (sel) { sel.srcObject = null; sel.remove(); remoteScreenAudios.delete(userId); }
  // Clean up GainNode to prevent memory leaks and stale AudioContext connections
  const gn = gainNodes.get(userId);
  if (gn) { gn.ctx.close().catch(() => {}); gainNodes.delete(userId); }
}

// GainNode map for per-user volume boost above 100%
const gainNodes = new Map<string, { ctx: AudioContext; gain: GainNode }>();

export function setRemoteVolume(userId: string, volumePct: number) {
  // volumePct: 0–200 (100 = normal, 200 = double gain przez GainNode)
  const gain = Math.max(0, volumePct / 100);
  const el = remoteAudios.get(userId);
  if (!el) return;

  const gn = gainNodes.get(userId);
  if (gn) {
    // GainNode obsługuje cały zakres 0.0–2.0 (el.volume zostaje na 1.0)
    gn.gain.gain.value = gain;
    gn.ctx.resume().catch(() => {}); // upewnij się że context nie jest suspended
  } else {
    // Fallback (np. przeglądarka bez WebAudio) — natywne el.volume, max 100%
    el.volume = Math.min(1, gain);
  }
}

/** Set volume for a user's screen-share audio (0–100%). */
export function setRemoteScreenVolume(userId: string, volumePct: number) {
  const el = remoteScreenAudios.get(userId);
  if (!el) return;
  el.volume = Math.max(0, Math.min(1, volumePct / 100));
  if (volumePct > 0) el.muted = false; // un-mute if raising volume
}

/** Mute/unmute only the screen-share audio for a remote user. */
export function muteRemoteScreenStream(userId: string, muted: boolean) {
  const el = remoteScreenAudios.get(userId);
  if (el) el.muted = muted;
}

export function muteRemoteUser(userId: string, muted: boolean) {
  const el = remoteAudios.get(userId);
  if (el) el.muted = muted;
  const sel = remoteScreenAudios.get(userId);
  if (sel) sel.muted = muted;
}

export function muteAllRemote(muted: boolean) {
  remoteAudios.forEach(el => { el.muted = muted; });
  remoteScreenAudios.forEach(el => { el.muted = muted; });
}

export async function setOutputDevice(deviceId: string) {
  for (const el of [...remoteAudios.values(), ...remoteScreenAudios.values()]) {
    if ('setSinkId' in el) {
      try { await (el as any).setSinkId(deviceId); } catch {}
    }
  }
}

// ─── Speaking Detection ──────────────────────────────────────────────────────
export function watchSpeaking(
  stream: MediaStream,
  onChange: (speaking: boolean) => void,
  threshold = 18,
): () => void {
  let ctx: AudioContext | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  try {
    ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.4;
    src.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    let speaking = false;

    interval = setInterval(() => {
      analyser.getByteFrequencyData(data);
      // Voice frequency range roughly bins 2–28
      let sum = 0;
      for (let i = 2; i < 28; i++) sum += data[i];
      const avg = sum / 26;
      const now = avg > threshold;
      if (now !== speaking) { speaking = now; onChange(now); }
    }, 80);
  } catch { /* AudioContext not available, skip */ }

  return () => {
    if (interval) clearInterval(interval);
    if (ctx) ctx.close().catch(() => {});
  };
}

// ─── Noise Gate AudioWorklet Pipeline ────────────────────────────────────────
export interface NoisePipeline {
  /** Processed stream to send to peer connections (noise-gated audio). */
  processedStream: MediaStream;
  /** Call to stop raw mic + close AudioContext. */
  cleanup: () => void;
  /** Change enabled/threshold live without re-acquiring mic. */
  setEnabled: (v: boolean) => void;
  setThreshold: (v: number) => void;
}

/**
 * Wraps a raw microphone stream with the CordisNoiseProcessor AudioWorklet.
 * Returns null if the browser does not support AudioWorklet (graceful fallback).
 */
export async function applyNoiseGate(rawStream: MediaStream): Promise<NoisePipeline | null> {
  try {
    const ctx = new AudioContext({ sampleRate: 48000 });
    // Load the worklet processor from the public folder
    await ctx.audioWorklet.addModule('/noise-processor.js');

    const source  = ctx.createMediaStreamSource(rawStream);
    const worklet = new AudioWorkletNode(ctx, 'cordis-noise-processor');
    const dest    = ctx.createMediaStreamDestination();

    // Voice frequency emphasis: high-pass at 80 Hz (cut rumble) + low-pass at 8 kHz (cut hiss)
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 80; hpf.Q.value = 0.7;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';  lpf.frequency.value = 8000; lpf.Q.value = 0.7;

    // Chain: source → HPF → LPF → noise gate worklet → destination
    source.connect(hpf);
    hpf.connect(lpf);
    lpf.connect(worklet);
    worklet.connect(dest);

    const enabledParam   = worklet.parameters.get('enabled');
    const thresholdParam = worklet.parameters.get('threshold');

    return {
      processedStream: dest.stream,
      cleanup: () => {
        rawStream.getTracks().forEach(t => t.stop());
        ctx.close().catch(() => {});
      },
      setEnabled:   (v) => { if (enabledParam)   enabledParam.setValueAtTime(v ? 1 : 0, ctx.currentTime); },
      setThreshold: (v) => { if (thresholdParam) thresholdParam.setValueAtTime(v, ctx.currentTime); },
    };
  } catch (e) {
    // AudioWorklet unsupported or worklet file not found — fall back gracefully
    console.warn('[Cordis] Noise gate worklet unavailable, using raw stream:', e);
    return null;
  }
}

// ─── Device Enumeration ──────────────────────────────────────────────────────
export async function getMediaDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices) return [];
  try {
    // Request mic permission first — without it browsers return devices with empty labels
    await navigator.mediaDevices.getUserMedia({ audio: true })
      .then(s => s.getTracks().forEach(t => t.stop()))
      .catch(() => {});
    return navigator.mediaDevices.enumerateDevices();
  } catch { return []; }
}
