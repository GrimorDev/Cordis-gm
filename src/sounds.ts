// Cordis — Sound System  v2
// MP3 files for main events + improved Web Audio synthesis for the rest.
// Design rule: no tone above 900 Hz in release; all gains ≤ 0.35; soft attack/decay.

let _ctx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Buffer preloading ────────────────────────────────────────────────────────
type BufEntry = { buf: AudioBuffer | null; loading: boolean };
const buffers: Record<string, BufEntry> = {};

function loadBuf(path: string): void {
  if (buffers[path]) return;
  buffers[path] = { buf: null, loading: true };
  fetch(path)
    .then(r => r.arrayBuffer())
    .then(ab => ctx().decodeAudioData(ab))
    .then(b => { buffers[path] = { buf: b, loading: false }; })
    .catch(() => { buffers[path] = { buf: null, loading: false }; });
}

// Preload on module init
loadBuf('/sounds/push.mp3');           // DM notification
loadBuf('/sounds/message-sound.mp3'); // channel / mention
loadBuf('/sounds/call-in-sound.mp3'); // incoming call ring loop

function playBuf(path: string, volume = 0.55, loop = false): AudioBufferSourceNode | null {
  const entry = buffers[path];
  if (!entry?.buf) { loadBuf(path); return null; }
  const c = ctx();
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = volume;
  src.buffer = entry.buf;
  src.loop = loop;
  src.connect(gain);
  gain.connect(c.destination);
  src.start();
  return src;
}

// ── Tone helpers ─────────────────────────────────────────────────────────────
// Low-pitched Discord-like approach: sine oscillators with smooth gain envelope
function tone(
  freq: number,
  duration: number,
  volume = 0.22,
  type: OscillatorType = 'sine',
  startDelay = 0,
  freqEnd?: number,          // optional pitch glide
) {
  const c = ctx();
  const osc  = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + startDelay);
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + startDelay + duration * 0.7);
  }
  // Soft attack, smooth decay — avoids click artefacts
  gain.gain.setValueAtTime(0.0001, c.currentTime + startDelay);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + startDelay + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + startDelay + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + startDelay);
  osc.stop(c.currentTime + startDelay + duration + 0.05);
}

// Two-note chord (simultaneous)
function chord(f1: number, f2: number, dur: number, vol = 0.18, start = 0) {
  tone(f1, dur, vol, 'sine', start);
  tone(f2, dur, vol * 0.7, 'sine', start);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** DM received — push.mp3 or fallback double-ping */
export function playDmNotification() {
  if (playBuf('/sounds/push.mp3', 0.52)) return;
  tone(660, 0.15, 0.18, 'sine', 0);
  tone(825, 0.14, 0.15, 'sine', 0.14);
}

/** Channel message received — message-sound.mp3 or soft single ping */
export function playMessageReceived() {
  if (playBuf('/sounds/message-sound.mp3', 0.45)) return;
  tone(660, 0.18, 0.14, 'sine', 0, 700);
}

/** Message sent — very subtle "whoosh" click */
export function playMessageSent() {
  // Soft high-frequency click, barely audible
  tone(520, 0.06, 0.07, 'sine', 0, 440);
  tone(380, 0.10, 0.05, 'sine', 0.04);
}

/** Mention alert — message-sound.mp3 at higher vol + extra ping for distinctiveness */
export function playMentionAlert() {
  if (playBuf('/sounds/message-sound.mp3', 0.65)) {
    // Extra emphasis ping after the file
    setTimeout(() => tone(660, 0.12, 0.16, 'sine', 0, 590), 160);
    return;
  }
  // Fallback: three low distinct pings
  tone(440, 0.12, 0.22, 'sine', 0);
  tone(550, 0.12, 0.20, 'sine', 0.13);
  tone(660, 0.15, 0.18, 'sine', 0.26);
}

// ── Voice channel ─────────────────────────────────────────────────────────────

/** Joined voice channel — two-note ascending Discord-style "bloop" */
export function playVoiceJoin() {
  // Low warm chord gliding up slightly
  tone(330, 0.18, 0.20, 'sine', 0,    370);
  tone(440, 0.22, 0.18, 'sine', 0.10, 494);
}

/** Left voice channel — descending "bloop" */
export function playVoiceLeave() {
  tone(440, 0.18, 0.18, 'sine', 0,    392);
  tone(330, 0.22, 0.16, 'sine', 0.10, 294);
}

// ── Outgoing call ring ────────────────────────────────────────────────────────
let ringInterval: ReturnType<typeof setInterval> | null = null;
export function startRing() {
  stopRing();
  const ring = () => {
    // Classic telephone double-ring — low & warm
    tone(480, 0.22, 0.25, 'sine', 0);
    tone(480, 0.22, 0.25, 'sine', 0.35);
  };
  ring();
  ringInterval = setInterval(ring, 2000);
}
export function stopRing() {
  if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
}

// ── Incoming call ring ────────────────────────────────────────────────────────
let incomingSrc: AudioBufferSourceNode | null = null;
let incomingInterval: ReturnType<typeof setInterval> | null = null;

export function startIncomingRing() {
  stopIncomingRing();
  const tryMp3 = () => {
    const src = playBuf('/sounds/call-in-sound.mp3', 0.70, false);
    if (src) {
      incomingSrc = src;
      src.onended = () => {
        // replay manually so we can stop it cleanly
        if (incomingSrc === src) startIncomingRing();
      };
      return true;
    }
    return false;
  };

  if (tryMp3()) return;

  // Fallback: synthesised incoming ring (ascending three-note pattern)
  const ring = () => {
    tone(392, 0.13, 0.26, 'sine', 0);
    tone(494, 0.13, 0.24, 'sine', 0.17);
    tone(587, 0.16, 0.22, 'sine', 0.34);
  };
  ring();
  incomingInterval = setInterval(ring, 2400);
}

export function stopIncomingRing() {
  if (incomingSrc) {
    try { incomingSrc.stop(); } catch { /* already ended */ }
    incomingSrc = null;
  }
  if (incomingInterval) { clearInterval(incomingInterval); incomingInterval = null; }
}

// ── Call accepted / ended ─────────────────────────────────────────────────────

/** Call accepted — warm success chime */
export function playCallAccepted() {
  tone(392, 0.15, 0.22, 'sine', 0);
  tone(523, 0.20, 0.20, 'sine', 0.12);
}

/** Call ended / rejected — low two-note drop */
export function playCallEnded() {
  tone(330, 0.14, 0.22, 'sine', 0,    295);
  tone(247, 0.22, 0.18, 'sine', 0.12, 220);
}

// ── Screen share ──────────────────────────────────────────────────────────────

/** Screen share started — ascending "on" chime */
export function playScreenShareStart() {
  tone(370, 0.12, 0.18, 'sine', 0,    415);
  tone(494, 0.16, 0.16, 'sine', 0.10, 523);
}

/** Screen share stopped — descending "off" chime */
export function playScreenShareStop() {
  tone(494, 0.12, 0.16, 'sine', 0,    415);
  tone(370, 0.16, 0.14, 'sine', 0.10, 330);
}

// ── Stream / watch view ────────────────────────────────────────────────────────

/** Joined a stream view — soft three-note rise */
export function playStreamJoin() {
  tone(330, 0.10, 0.16, 'sine', 0);
  tone(415, 0.10, 0.14, 'sine', 0.09);
  tone(523, 0.16, 0.12, 'sine', 0.18);
}
