// Cordis — Sound System
// push.mp3 for DM notifications, Web Audio API for call/voice tones

let _ctx: AudioContext | null = null;
function ctx(): AudioContext {
  if (!_ctx) _ctx = new AudioContext();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

// ── Preload push.mp3 ─────────────────────────────────────────────────────────
let pushBuffer: AudioBuffer | null = null;
let pushLoading = false;
function loadPush() {
  if (pushBuffer || pushLoading) return;
  pushLoading = true;
  fetch('/sounds/push.mp3')
    .then(r => r.arrayBuffer())
    .then(b => ctx().decodeAudioData(b))
    .then(b => { pushBuffer = b; pushLoading = false; })
    .catch(() => { pushLoading = false; });
}
loadPush();

function playBuffer(buffer: AudioBuffer, volume = 0.6) {
  const c = ctx();
  const src = c.createBufferSource();
  const gain = c.createGain();
  gain.gain.value = volume;
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(c.destination);
  src.start();
}

// ── Tone helpers ─────────────────────────────────────────────────────────────
function tone(freq: number, duration: number, volume = 0.25, type: OscillatorType = 'sine', startTime = 0) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, c.currentTime + startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + startTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + startTime);
  osc.stop(c.currentTime + startTime + duration + 0.05);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** DM received — push notification sound */
export function playDmNotification() {
  loadPush();
  if (pushBuffer) {
    playBuffer(pushBuffer, 0.55);
  } else {
    // Fallback: short double-ping
    tone(880, 0.12, 0.2);
    tone(1100, 0.12, 0.18, 'sine', 0.15);
  }
}

/** Outgoing call ring — repeating pattern */
let ringInterval: ReturnType<typeof setInterval> | null = null;
export function startRing() {
  stopRing();
  const ring = () => {
    tone(640, 0.2, 0.3, 'sine', 0);
    tone(780, 0.2, 0.28, 'sine', 0.25);
  };
  ring();
  ringInterval = setInterval(ring, 1800);
}
export function stopRing() {
  if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
}

/** Incoming call ring */
let incomingInterval: ReturnType<typeof setInterval> | null = null;
export function startIncomingRing() {
  stopIncomingRing();
  const ring = () => {
    tone(520, 0.15, 0.3, 'sine', 0);
    tone(520, 0.15, 0.3, 'sine', 0.2);
    tone(520, 0.15, 0.3, 'sine', 0.4);
  };
  ring();
  incomingInterval = setInterval(ring, 2200);
}
export function stopIncomingRing() {
  if (incomingInterval) { clearInterval(incomingInterval); incomingInterval = null; }
}

/** Joined voice channel — ascending chime */
export function playVoiceJoin() {
  tone(440, 0.15, 0.22);
  tone(550, 0.15, 0.2, 'sine', 0.12);
  tone(660, 0.2, 0.18, 'sine', 0.24);
}

/** Left voice channel — descending chime */
export function playVoiceLeave() {
  tone(660, 0.15, 0.2);
  tone(550, 0.15, 0.18, 'sine', 0.12);
  tone(440, 0.2, 0.15, 'sine', 0.24);
}

/** Call accepted — short success ding */
export function playCallAccepted() {
  tone(660, 0.12, 0.25);
  tone(880, 0.18, 0.22, 'sine', 0.1);
}

/** Call ended/rejected — short low tone */
export function playCallEnded() {
  tone(330, 0.12, 0.25);
  tone(260, 0.25, 0.2, 'sine', 0.1);
}

/** Joining a stream view — soft rising chime */
export function playStreamJoin() {
  tone(523, 0.1, 0.18, 'sine', 0);
  tone(659, 0.1, 0.16, 'sine', 0.08);
  tone(784, 0.18, 0.14, 'sine', 0.16);
}
