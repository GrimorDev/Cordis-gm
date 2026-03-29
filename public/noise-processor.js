/**
 * Cordis Noise Processor — AudioWorkletProcessor
 * Adaptive noise gate with dynamic noise floor tracking.
 * Processes 128-sample frames at the AudioContext sample rate (48 kHz).
 *
 * Technique:
 *  1. Track noise floor: slow-running minimum of the signal envelope (3 s window).
 *  2. Gate threshold = max(MIN_THRESHOLD, noiseFloor × FLOOR_MULTIPLIER).
 *     Adapts to the room: quieter room → lower gate → captures soft speech.
 *  3. Soft-knee gate: full pass above threshold, quadratic fade below 30 % of it.
 *  4. Smooth gain (15 ms) + HOLD time to eliminate click artefacts and choppy speech.
 *
 * Parameters (AudioWorkletNode.parameters):
 *  • enabled   [0|1]  — bypass when 0            (default 1)
 *  • threshold [0-1]  — minimum gate floor (lin.) (default 0.03 ≈ −30 dBFS)
 *
 * Tuning (v2 — aggressive defaults to block breathing/typing):
 *  - MIN_THRESHOLD raised to 0.012 (~−38 dBFS): breathing/distant sounds blocked
 *  - FLOOR_MULT raised to 6.0: gate opens only well above ambient noise
 *  - default threshold 0.03 (~−30 dBFS): speech passes, keyboard/breathing blocked
 *  - Release extended to 500 ms: prevents choppy voice between words
 *  - HOLD_FRAMES: gate stays open 180 ms after signal drops — smooth voice tail
 */
const MIN_THRESHOLD   = 0.012;  // absolute minimum gate floor (~−38 dBFS) — was 0.003
const FLOOR_MULT      = 6.0;    // gate opens at 6× noise floor — was 3.5
const KNEE_LO         = 0.3;    // soft-knee low edge  (fraction of threshold)
const KNEE_HI         = 1.0;    // soft-knee high edge (fraction of threshold)

class CordisNoiseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'enabled',   defaultValue: 1,    minValue: 0, maxValue: 1 },
      { name: 'threshold', defaultValue: 0.03, minValue: 0, maxValue: 1 },  // was 0.006
    ];
  }

  constructor() {
    super();
    this._env       = 0;
    this._gain      = 1;
    this._noiseFloor = 0;
    this._holdFrames = 0;  // hold counter — gate stays open for HOLD_FRAMES after drop

    this._attackC  = 0;
    this._releaseC = 0;
    this._gainC    = 0;
    this._floorC   = 0;
    this._maxHold  = 0;
    this._ready    = false;
  }

  _init() {
    const sr = sampleRate;
    this._attackC  = 1 - Math.exp(-1 / (sr * 0.003));  // 3 ms attack
    this._releaseC = 1 - Math.exp(-1 / (sr * 0.500));  // 500 ms release (was 250 ms)
    this._gainC    = 1 - Math.exp(-1 / (sr * 0.015));  // 15 ms gain smooth
    this._floorC   = 1 - Math.exp(-1 / (sr * 3.0));    // 3 s noise floor decay (was 2 s)
    // Hold = 180 ms expressed in 128-sample frames
    this._maxHold  = Math.round(sr * 0.18 / 128);
    this._ready    = true;
  }

  process(inputs, outputs, parameters) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp || !out) return true;

    if (!this._ready) this._init();

    const enabled   = (parameters.enabled[0]   ?? 1)    > 0.5;
    const minThresh = (parameters.threshold[0]  ?? 0.03);

    const aC = this._attackC;
    const rC = this._releaseC;
    const gC = this._gainC;
    const fC = this._floorC;

    // Compute frame RMS to decide hold at frame level (faster than per-sample)
    let sumSq = 0;
    for (let i = 0; i < inp.length; i++) sumSq += inp[i] * inp[i];
    const frameRms = Math.sqrt(sumSq / inp.length);

    // Update noise floor at frame level (cheaper, still accurate)
    if (frameRms < this._noiseFloor || this._noiseFloor < 1e-8) {
      this._noiseFloor = frameRms * 0.1 + this._noiseFloor * 0.9;
    } else {
      this._noiseFloor += fC * (frameRms - this._noiseFloor);
    }

    const threshold = Math.max(minThresh, MIN_THRESHOLD, this._noiseFloor * FLOOR_MULT);

    for (let i = 0; i < inp.length; i++) {
      const sample = inp[i];

      if (!enabled) {
        out[i] = sample;
        continue;
      }

      const abs = Math.abs(sample);

      // ── Envelope follower ────────────────────────────────────────────
      if (abs > this._env) {
        this._env += aC * (abs - this._env);
      } else {
        this._env += rC * (abs - this._env);
      }

      // ── Soft-knee gate with hold ─────────────────────────────────────
      const loEdge = threshold * KNEE_LO;
      const hiEdge = threshold * KNEE_HI;
      let targetGain;

      if (this._env >= hiEdge) {
        // Signal above threshold — open gate and reset hold counter
        this._holdFrames = this._maxHold;
        targetGain = 1;
      } else if (this._holdFrames > 0) {
        // In hold period — keep gate fully open even though signal dropped
        this._holdFrames--;
        targetGain = 1;
      } else if (this._env <= loEdge) {
        targetGain = 0;
      } else {
        // Soft knee: quadratic fade 0→1 over [loEdge, hiEdge]
        const t = (this._env - loEdge) / (hiEdge - loEdge);
        targetGain = t * t;
      }

      // ── Smooth gain ──────────────────────────────────────────────────
      this._gain += gC * (targetGain - this._gain);
      out[i] = sample * this._gain;
    }

    return true;
  }
}

registerProcessor('cordis-noise-processor', CordisNoiseProcessor);
