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
  if (!el) { el = makeAudioEl(); remoteAudios.set(userId, el); }
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
  // volumePct: 0–200 (100 = normal, 200 = double gain)
  const gain = Math.max(0, volumePct / 100);
  const el = remoteAudios.get(userId);
  if (!el) return;

  // For 0–100%: use native HTML5 volume (simpler, always works)
  // For 100–200%: use WebAudio GainNode to boost beyond normal
  if (volumePct <= 100) {
    el.volume = gain;
    // If we have a GainNode, set it to 1 and use native volume for fine control
    const gn = gainNodes.get(userId);
    if (gn) gn.gain.gain.value = 1;
    return;
  }

  // Above 100% — use GainNode
  el.volume = 1; // native at max, GainNode boosts further
  if (!gainNodes.has(userId)) {
    try {
      const ctx = new AudioContext();
      ctx.resume().catch(() => {}); // ensure AudioContext is not suspended
      const src = ctx.createMediaElementSource(el);
      const gainNode = ctx.createGain();
      gainNode.gain.value = gain;
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNodes.set(userId, { ctx, gain: gainNode });
    } catch {
      // AudioContext unavailable or element already connected — cap at native 1.0
    }
  } else {
    gainNodes.get(userId)!.gain.gain.value = gain;
  }
}

/** Set volume for a user's screen-share audio (0–200%). */
export function setRemoteScreenVolume(userId: string, volumePct: number) {
  const gain = Math.max(0, volumePct / 100);
  const el = remoteScreenAudios.get(userId);
  if (!el) return;
  el.volume = Math.min(1, gain);
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
