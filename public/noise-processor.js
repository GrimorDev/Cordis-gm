/**
 * Cordis Noise Processor — AudioWorkletProcessor
 * Adaptive noise gate with dynamic noise floor tracking.
 * Processes 128-sample frames at the AudioContext sample rate (48 kHz).
 *
 * Technique:
 *  1. Track noise floor: slow-running minimum of the signal envelope (2 s window).
 *  2. Gate threshold = max(MIN_THRESHOLD, noiseFloor × FLOOR_MULTIPLIER).
 *     Adapts to the room: quieter room → lower gate → captures soft speech.
 *  3. Soft-knee gate: full pass above threshold, quadratic fade below 30 % of it.
 *  4. Smooth gain (15 ms) to eliminate click artefacts.
 *
 * Parameters (AudioWorkletNode.parameters):
 *  • enabled   [0|1]  — bypass when 0            (default 1)
 *  • threshold [0-1]  — minimum gate floor (lin.) (default 0.006 ≈ −44 dBFS)
 */
const MIN_THRESHOLD   = 0.003;  // absolute minimum gate floor (~−50 dBFS)
const FLOOR_MULT      = 3.5;    // gate opens at FLOOR_MULT × noise floor
const KNEE_LO         = 0.25;   // soft-knee low edge  (fraction of threshold)
const KNEE_HI         = 1.0;    // soft-knee high edge (fraction of threshold)

class CordisNoiseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'enabled',   defaultValue: 1,     minValue: 0, maxValue: 1 },
      { name: 'threshold', defaultValue: 0.006, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    // Envelope follower state
    this._env = 0;
    // Smoothed gain
    this._gain = 1;
    // Running noise floor (slow minimum tracker)
    this._noiseFloor = 0;

    // Coefficients recomputed once sampleRate is available
    // (sampleRate is a global in AudioWorkletProcessor scope)
    this._attackC  = 0; // filled in first process() call
    this._releaseC = 0;
    this._gainC    = 0;
    this._floorC   = 0;
    this._ready    = false;
  }

  _init() {
    const sr = sampleRate; // global
    this._attackC  = 1 - Math.exp(-1 / (sr * 0.003));  // 3 ms attack
    this._releaseC = 1 - Math.exp(-1 / (sr * 0.250));  // 250 ms release
    this._gainC    = 1 - Math.exp(-1 / (sr * 0.015));  // 15 ms gain smooth
    this._floorC   = 1 - Math.exp(-1 / (sr * 2.0));    // 2 s noise floor decay
    this._ready    = true;
  }

  process(inputs, outputs, parameters) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp || !out) return true;

    if (!this._ready) this._init();

    const enabled   = (parameters.enabled[0]   ?? 1)     > 0.5;
    const minThresh = (parameters.threshold[0]  ?? 0.006);

    const aC = this._attackC;
    const rC = this._releaseC;
    const gC = this._gainC;
    const fC = this._floorC;

    for (let i = 0; i < inp.length; i++) {
      const sample = inp[i];

      if (!enabled) {
        out[i] = sample;
        continue;
      }

      const abs = Math.abs(sample);

      // ── Noise floor tracker (slow minimum) ──────────────────────────
      // Only update downward aggressively; upward is slow (2 s).
      if (abs < this._noiseFloor || this._noiseFloor < 1e-8) {
        this._noiseFloor = abs * 0.1 + this._noiseFloor * 0.9; // fast drop
      } else {
        this._noiseFloor += fC * (abs - this._noiseFloor);     // slow rise
      }

      // ── Adaptive threshold ───────────────────────────────────────────
      const threshold = Math.max(minThresh, this._noiseFloor * FLOOR_MULT, MIN_THRESHOLD);

      // ── Envelope follower ────────────────────────────────────────────
      if (abs > this._env) {
        this._env += aC * (abs - this._env); // fast attack
      } else {
        this._env += rC * (abs - this._env); // slow release
      }

      // ── Soft-knee gate ───────────────────────────────────────────────
      const loEdge = threshold * KNEE_LO;
      const hiEdge = threshold * KNEE_HI;
      let targetGain;
      if (this._env >= hiEdge) {
        targetGain = 1;
      } else if (this._env <= loEdge) {
        targetGain = 0;
      } else {
        // Quadratic smooth knee: 0 → 1 over [loEdge, hiEdge]
        const t = (this._env - loEdge) / (hiEdge - loEdge);
        targetGain = t * t;
      }

      // ── Smooth gain to avoid click artefacts ────────────────────────
      this._gain += gC * (targetGain - this._gain);
      out[i] = sample * this._gain;
    }

    return true;
  }
}

registerProcessor('cordis-noise-processor', CordisNoiseProcessor);
