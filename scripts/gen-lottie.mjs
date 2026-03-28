/**
 * Lottie JSON generator for Cordyn profile card effects.
 * Run: node scripts/gen-lottie.mjs
 * Output: public/lottie/*.json
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const OUT = join(process.cwd(), 'public', 'lottie');
mkdirSync(OUT, { recursive: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const W = 280, H = 340, FPS = 30;
const ease = (t, s) => ({ i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t, s: [s] });
const linear = (t, s) => ({ t, s: Array.isArray(s) ? s : [s] });

function mkPos(frames) { // frames: [{t, x, y}]
  return {
    a: 1,
    k: frames.map(({ t, x, y }, i) => ({
      i: { x: 0.42, y: 1 }, o: { x: 0.58, y: 0 },
      t, s: [x, y, 0], to: [0, 0, 0], ti: [0, 0, 0],
    })),
  };
}
function mkOpacity(frames) { return { a: 1, k: frames.map(({ t, v }) => ease(t, v)) }; }
function mkRotation(frames) { return { a: 1, k: frames.map(({ t, v }) => linear(t, v)) }; }
function mkStatic(v) { return { a: 0, k: v }; }

function rect(w, h, color) {
  return {
    ty: 'gr',
    it: [
      { ty: 'rc', d: 1, s: mkStatic([w, h]), p: mkStatic([0, 0]), r: mkStatic(2) },
      { ty: 'fl', c: mkStatic([...color, 1]), o: mkStatic(100), r: 1 },
      { ty: 'tr', p: mkStatic([0, 0]), a: mkStatic([0, 0]), s: mkStatic([100, 100]), r: mkStatic(0), o: mkStatic(100) },
    ],
    nm: 'rect', np: 3, cix: 2, bm: 0,
  };
}

function ellipse(rx, ry, color) {
  return {
    ty: 'gr',
    it: [
      { ty: 'el', d: 1, s: mkStatic([rx * 2, ry * 2]), p: mkStatic([0, 0]) },
      { ty: 'fl', c: mkStatic([...color, 1]), o: mkStatic(100), r: 1 },
      { ty: 'tr', p: mkStatic([0, 0]), a: mkStatic([0, 0]), s: mkStatic([100, 100]), r: mkStatic(0), o: mkStatic(100) },
    ],
    nm: 'ellipse', np: 3, cix: 2, bm: 0,
  };
}

function star(size, color) {
  // Star shape using a polystar
  return {
    ty: 'gr',
    it: [
      {
        ty: 'sr',
        sy: 1, // star
        d: 1,
        pt: mkStatic(5),
        p: mkStatic([0, 0]),
        r: mkStatic(0),
        ir: mkStatic(size * 0.4),
        is: mkStatic(0),
        or: mkStatic(size),
        os: mkStatic(0),
      },
      { ty: 'fl', c: mkStatic([...color, 1]), o: mkStatic(100), r: 1 },
      { ty: 'tr', p: mkStatic([0, 0]), a: mkStatic([0, 0]), s: mkStatic([100, 100]), r: mkStatic(0), o: mkStatic(100) },
    ],
    nm: 'star', np: 3, cix: 2, bm: 0,
  };
}

function baseLayer(id, nm, dur, st, shapes, ksExtra = {}) {
  return {
    ddd: 0, ind: id, ty: 4, nm,
    sr: 1,
    ks: {
      o: mkStatic(100),
      r: mkStatic(0),
      p: mkStatic([W / 2, H / 2, 0]),
      a: mkStatic([0, 0, 0]),
      s: mkStatic([100, 100, 100]),
      ...ksExtra,
    },
    ao: 0,
    shapes,
    ip: 0, op: dur, st, bm: 0,
  };
}

function lottie(nm, dur, layers) {
  return { v: '5.9.6', fr: FPS, ip: 0, op: dur, w: W, h: H, nm, ddd: 0, assets: [], layers };
}

// ─── 1. CONFETTI ──────────────────────────────────────────────────────────────
{
  const DUR = 150; // 5s
  const COLORS = [
    [0.96, 0.26, 0.21], // red
    [1.0, 0.60, 0.0],   // orange
    [0.99, 0.83, 0.0],  // yellow
    [0.29, 0.73, 0.42], // green
    [0.25, 0.61, 0.96], // blue
    [0.61, 0.35, 0.71], // purple
    [0.94, 0.36, 0.60], // pink
    [0.0, 0.74, 0.83],  // cyan
  ];

  const pieces = Array.from({ length: 16 }, (_, i) => {
    const color = COLORS[i % COLORS.length];
    const x0 = 20 + (i * 167 + 13) % (W - 40);
    const yEnd = H + 20;
    const xEnd = x0 + ((i % 5) - 2) * 30;
    const delay = Math.floor(i * 9.3 % DUR);
    const loopDur = 70 + (i % 5) * 8;
    const useRect = i % 3 !== 0;
    const shape = useRect ? rect(8 + i % 5, 5 + i % 3, color) : ellipse(4 + i % 3, 4 + i % 3, color);
    return baseLayer(i + 1, `c${i}`, DUR, delay, [shape], {
      r: mkRotation([{ t: 0, v: (i * 37) % 360 }, { t: loopDur, v: (i * 37) % 360 + 360 }]),
      p: mkPos([
        { t: 0, x: x0, y: -15 },
        { t: loopDur, x: xEnd, y: yEnd },
      ]),
      o: mkOpacity([{ t: 0, v: 0 }, { t: 8, v: 90 }, { t: loopDur - 10, v: 80 }, { t: loopDur, v: 0 }]),
    });
  });
  writeFileSync(join(OUT, 'confetti.json'), JSON.stringify(lottie('confetti', DUR, pieces)));
  console.log('✓ confetti.json');
}

// ─── 2. SPARKLES ─────────────────────────────────────────────────────────────
{
  const DUR = 120; // 4s
  const GOLDS = [
    [1.0, 0.92, 0.23],  // gold
    [1.0, 1.0, 1.0],    // white
    [1.0, 0.75, 0.5],   // warm
    [0.8, 0.9, 1.0],    // cool white
  ];
  const POSITIONS = [
    [30, 40], [180, 80], [60, 170], [220, 140], [110, 55],
    [250, 220], [40, 290], [200, 290], [130, 220], [90, 130],
    [240, 60], [155, 300],
  ];

  const sparks = POSITIONS.map(([x, y], i) => {
    const color = GOLDS[i % GOLDS.length];
    const size = 4 + (i % 4) * 2.5;
    const start = Math.floor(i * 13 % DUR);
    const phaseDur = 35 + i % 15;
    return baseLayer(i + 1, `s${i}`, DUR, start, [star(size, color)], {
      r: mkRotation([{ t: start, v: 0 }, { t: start + phaseDur, v: 180 }]),
      p: mkPos([{ t: 0, x, y }, { t: DUR, x, y }]),
      o: mkOpacity([
        { t: 0, v: 0 },
        { t: Math.floor(phaseDur * 0.3), v: 100 },
        { t: Math.floor(phaseDur * 0.7), v: 100 },
        { t: phaseDur, v: 0 },
      ]),
      s: { a: 1, k: [
        { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t: 0, s: [20, 20, 100] },
        { i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] }, t: Math.floor(phaseDur * 0.4), s: [110, 110, 100] },
        { t: phaseDur, s: [15, 15, 100] },
      ]},
    });
  });
  writeFileSync(join(OUT, 'sparkles.json'), JSON.stringify(lottie('sparkles', DUR, sparks)));
  console.log('✓ sparkles.json');
}

// ─── 3. SAKURA ────────────────────────────────────────────────────────────────
{
  const DUR = 180; // 6s
  const PINKS = [
    [1.0, 0.71, 0.75],  // light pink
    [0.99, 0.6, 0.70],  // medium pink
    [1.0, 0.85, 0.88],  // pale pink
    [0.95, 0.5, 0.65],  // deeper pink
  ];

  const petals = Array.from({ length: 12 }, (_, i) => {
    const color = PINKS[i % PINKS.length];
    const x0 = 15 + (i * 157 + 7) % (W - 30);
    const xWaver = x0 + ((i % 5) - 2) * 20;
    const delay = Math.floor(i * 15 % DUR);
    const fallDur = 90 + (i % 6) * 8;
    return baseLayer(i + 1, `p${i}`, DUR, delay, [ellipse(6 + i % 3, 4, color)], {
      r: mkRotation([{ t: 0, v: (i * 23) % 360 }, { t: fallDur, v: (i * 23) % 360 + 180 }]),
      p: mkPos([
        { t: 0, x: x0, y: -12 },
        { t: Math.floor(fallDur * 0.5), x: xWaver, y: H * 0.5 },
        { t: fallDur, x: x0 + 10, y: H + 15 },
      ]),
      o: mkOpacity([{ t: 0, v: 0 }, { t: 10, v: 85 }, { t: fallDur - 12, v: 70 }, { t: fallDur, v: 0 }]),
    });
  });

  // Add soft pink tint layer at the bottom
  const tint = {
    ddd: 0, ind: 99, ty: 1, nm: 'tint',
    sr: 1,
    ks: { o: mkStatic(12), r: mkStatic(0), p: mkStatic([W/2, H/2, 0]), a: mkStatic([0,0,0]), s: mkStatic([100,100,100]) },
    ao: 0, sw: W, sh: H,
    sc: '#ffb6c1',
    ip: 0, op: DUR, st: 0, bm: 0,
  };

  writeFileSync(join(OUT, 'sakura.json'), JSON.stringify(lottie('sakura', DUR, [...petals, tint])));
  console.log('✓ sakura.json');
}

// ─── 4. BUBBLES ───────────────────────────────────────────────────────────────
{
  const DUR = 150;
  const bubbles = Array.from({ length: 10 }, (_, i) => {
    const size = 8 + (i % 8);
    const x = 20 + (i * 177 + 11) % (W - 40);
    const delay = Math.floor(i * 15 % DUR);
    const riseDur = 80 + (i % 5) * 10;
    return baseLayer(i + 1, `b${i}`, DUR, delay, [{
      ty: 'gr',
      it: [
        { ty: 'el', d: 1, s: mkStatic([size, size]), p: mkStatic([0, 0]) },
        {
          ty: 'gs',  // gradient stroke
          t: 1,
          o: mkStatic(60),
          w: mkStatic(1.5),
          lc: 2, lj: 2, ml: 4,
          s: mkStatic([0, 0]),
          e: mkStatic([size, size]),
          g: { p: 3, k: mkStatic([0, 1, 1, 1, 0.5, 1, 1, 1, 0.8, 1, 1, 1, 1, 0, 0, 0, 0.5, 0.3, 1, 0]) },
        },
        { ty: 'tr', p: mkStatic([0, 0]), a: mkStatic([0, 0]), s: mkStatic([100, 100]), r: mkStatic(0), o: mkStatic(100) },
      ],
      nm: 'bubble', np: 3, cix: 2, bm: 0,
    }], {
      p: mkPos([
        { t: 0, x, y: H + 10 },
        { t: riseDur, x: x + ((i % 3) - 1) * 15, y: -10 },
      ]),
      o: mkOpacity([{ t: 0, v: 0 }, { t: 12, v: 70 }, { t: riseDur - 10, v: 50 }, { t: riseDur, v: 0 }]),
    });
  });
  writeFileSync(join(OUT, 'bubbles.json'), JSON.stringify(lottie('bubbles', DUR, bubbles)));
  console.log('✓ bubbles.json');
}

// ─── 5. SNOW ──────────────────────────────────────────────────────────────────
{
  const DUR = 180;
  const flakes = Array.from({ length: 14 }, (_, i) => {
    const size = 3 + i % 4;
    const x = 12 + (i * 163 + 5) % (W - 24);
    const xDrift = x + ((i % 5) - 2) * 14;
    const delay = Math.floor(i * 12.8 % DUR);
    const fallDur = 100 + (i % 7) * 10;
    return baseLayer(i + 1, `f${i}`, DUR, delay, [ellipse(size, size, [1, 1, 1])], {
      r: mkRotation([{ t: 0, v: 0 }, { t: fallDur, v: (i % 2 === 0 ? 1 : -1) * 120 }]),
      p: mkPos([
        { t: 0, x, y: -10 },
        { t: Math.floor(fallDur * 0.45), x: xDrift, y: H * 0.45 },
        { t: fallDur, x: x + 5, y: H + 10 },
      ]),
      o: mkOpacity([{ t: 0, v: 0 }, { t: 8, v: 80 }, { t: fallDur - 8, v: 65 }, { t: fallDur, v: 0 }]),
    });
  });
  writeFileSync(join(OUT, 'snow.json'), JSON.stringify(lottie('snow', DUR, flakes)));
  console.log('✓ snow.json');
}

console.log('\nAll Lottie animations generated in public/lottie/');
