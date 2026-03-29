/**
 * Cordis Noise Processor v3 — Dual-Envelope Transient-Rejecting Gate
 *
 * Core idea: TWO envelope followers with different attack times:
 *   envFast (3 ms)  — tracks all peaks including brief transients
 *   envSlow (80 ms) — tracks SUSTAINED sounds only
 *
 * Gate decision uses envSlow exclusively:
 *   → keyboard clicks (5-20 ms) barely build envSlow → gate stays closed
 *   → desk thumps, mouse taps (10-50 ms) same → gate stays closed
 *   → voice (sustained 100 ms+) builds envSlow → gate opens
 *
 * No adaptive noise floor in v3 — the slow envelope inherently
 * rejects brief transients so a fixed threshold works reliably.
 *
 * Parameters:
 *   enabled   [0|1]  default 1  — bypass when 0
 *   threshold [0-1]  default 0.02 (~−34 dBFS) — how loud sustained sound needs to be
 */
const MIN_THRESHOLD = 0.008;  // ~−42 dBFS absolute floor

const KNEE_LO = 0.30;   // soft-knee low edge  (fraction of threshold)
const KNEE_HI = 1.00;   // soft-knee high edge

class CordisNoiseProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'enabled',   defaultValue: 1,    minValue: 0, maxValue: 1 },
      { name: 'threshold', defaultValue: 0.02, minValue: 0, maxValue: 1 },
    ];
  }

  constructor() {
    super();
    this._envFast     = 0;
    this._envSlow     = 0;
    this._gain        = 0;
    this._holdSamples = 0;

    // coefficients — computed lazily on first process() call
    this._aFast   = 0;   // fast attack  3 ms
    this._aSlow   = 0;   // slow attack 80 ms
    this._relC    = 0;   // release     600 ms
    this._gainC   = 0;   // gain smooth  15 ms
    this._maxHold = 0;   // hold        300 ms in samples
    this._ready   = false;
  }

  _init() {
    const sr = sampleRate; // global in AudioWorkletProcessor scope
    this._aFast   = 1 - Math.exp(-1 / (sr * 0.003));  // 3 ms
    this._aSlow   = 1 - Math.exp(-1 / (sr * 0.080));  // 80 ms  ← key: ignores transients
    this._relC    = 1 - Math.exp(-1 / (sr * 0.600));  // 600 ms release
    this._gainC   = 1 - Math.exp(-1 / (sr * 0.015));  // 15 ms gain smooth
    this._maxHold = Math.round(sr * 0.300);             // 300 ms hold in samples
    this._ready   = true;
  }

  process(inputs, outputs, parameters) {
    const inp = inputs[0]?.[0];
    const out = outputs[0]?.[0];
    if (!inp || !out) return true;
    if (!this._ready) this._init();

    const enabled   = (parameters.enabled[0]  ?? 1)    > 0.5;
    const minThresh = (parameters.threshold[0] ?? 0.02);
    const threshold = Math.max(MIN_THRESHOLD, minThresh);
    const loEdge    = threshold * KNEE_LO;
    const hiEdge    = threshold * KNEE_HI;

    const aF = this._aFast;
    const aS = this._aSlow;
    const rC = this._relC;
    const gC = this._gainC;

    for (let i = 0; i < inp.length; i++) {
      const sample = inp[i];

      if (!enabled) { out[i] = sample; continue; }

      const abs = Math.abs(sample);

      // ── Fast envelope: tracks everything (used for reference only) ──
      this._envFast = abs > this._envFast
        ? this._envFast + aF * (abs - this._envFast)
        : this._envFast + rC * (abs - this._envFast);

      // ── Slow envelope: tracks SUSTAINED content only ─────────────────
      // A 10 ms keyboard click at amplitude 0.5 builds envSlow to only ~0.04
      // A 150 ms speech vowel at amplitude 0.1 builds envSlow to ~0.09
      this._envSlow = abs > this._envSlow
        ? this._envSlow + aS * (abs - this._envSlow)
        : this._envSlow + rC * (abs - this._envSlow);

      // ── Gate decision (envSlow only — transient-immune) ───────────────
      let targetGain;
      if (this._envSlow >= hiEdge) {
        // Sustained signal above threshold — open gate + reset hold
        this._holdSamples = this._maxHold;
        targetGain = 1;
      } else if (this._holdSamples > 0) {
        // Hold: gate stays open after signal drops (smooth voice tail, no clipping)
        this._holdSamples--;
        targetGain = 1;
      } else if (this._envSlow <= loEdge) {
        targetGain = 0;
      } else {
        // Soft knee: quadratic fade between loEdge and hiEdge
        const t = (this._envSlow - loEdge) / (hiEdge - loEdge);
        targetGain = t * t;
      }

      // ── Smooth gain to avoid click artefacts ─────────────────────────
      this._gain += gC * (targetGain - this._gain);
      out[i] = sample * this._gain;
    }

    return true;
  }
}

registerProcessor('cordis-noise-processor', CordisNoiseProcessor);
