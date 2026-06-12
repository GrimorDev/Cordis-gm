import { parseGIF, decompressFrames } from 'gifuct-js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import type { Area } from 'react-easy-crop';

// ── Animated GIF crop ───────────────────────────────────────────────────────
// gifuct-js decodes a GIF into per-frame "patches" (only the changed region of
// each frame, per the GIF spec's disposal rules). We composite those patches
// onto a full-size canvas frame-by-frame, crop/scale each composited frame to
// `pixelCrop`, then re-encode the result with gifenc — preserving the
// animation while applying the user's crop/zoom selection.

/** Composites one frame's patch onto the running full-size canvas, honoring
 *  GIF disposal methods (1: leave as-is, 2: restore to background, 3: restore
 *  to previous). Mutates `state` for the next call. */
function applyDisposal(
  fctx: CanvasRenderingContext2D,
  gw: number,
  gh: number,
  state: { saved: ImageData | null; prevDims: Area | null; prevDisposal: number },
) {
  if (state.prevDisposal === 2 && state.prevDims) {
    fctx.clearRect(state.prevDims.x, state.prevDims.y, state.prevDims.width, state.prevDims.height);
  } else if (state.prevDisposal === 3 && state.saved) {
    fctx.putImageData(state.saved, 0, 0);
  }
  void gw; void gh;
}

/**
 * Decodes `file` (an animated GIF), crops every frame to `pixelCrop` (scaled
 * down so its largest dimension is at most `maxDim`), and re-encodes it as a
 * new animated GIF preserving frame delays.
 *
 * Runs on the main thread but yields between frames so the UI stays
 * responsive — `onProgress` reports `(done, total)` frames encoded so far.
 */
export async function cropAnimatedGif(
  file: File,
  pixelCrop: Area,
  maxDim = 640,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const buf = await file.arrayBuffer();
  const parsed = parseGIF(buf);
  const frames = decompressFrames(parsed, true);
  const gw = parsed.lsd.width;
  const gh = parsed.lsd.height;

  const scale = Math.min(1, maxDim / Math.max(pixelCrop.width, pixelCrop.height));
  const outW = Math.max(1, Math.round(pixelCrop.width * scale));
  const outH = Math.max(1, Math.round(pixelCrop.height * scale));

  const full = document.createElement('canvas');
  full.width = gw; full.height = gh;
  const fctx = full.getContext('2d', { willReadFrequently: true })!;

  const out = document.createElement('canvas');
  out.width = outW; out.height = outH;
  const octx = out.getContext('2d', { willReadFrequently: true })!;

  const patch = document.createElement('canvas');
  const pctx = patch.getContext('2d')!;

  const gif = GIFEncoder();
  const state: { saved: ImageData | null; prevDims: Area | null; prevDisposal: number } =
    { saved: null, prevDims: null, prevDisposal: 0 };

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const dims = { x: frame.dims.left, y: frame.dims.top, width: frame.dims.width, height: frame.dims.height };

    applyDisposal(fctx, gw, gh, state);
    if (frame.disposalType === 3) state.saved = fctx.getImageData(0, 0, gw, gh);

    patch.width = dims.width; patch.height = dims.height;
    pctx.putImageData(new ImageData(new Uint8ClampedArray(frame.patch), dims.width, dims.height), 0, 0);
    fctx.drawImage(patch, dims.x, dims.y);

    octx.clearRect(0, 0, outW, outH);
    octx.drawImage(full, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, outW, outH);
    const { data } = octx.getImageData(0, 0, outW, outH);

    const palette = quantize(data, 256, { format: 'rgba4444' });
    const index = applyPalette(data, palette, 'rgba4444');

    let transparentIndex = -1;
    for (let p = 0; p < data.length; p += 4) {
      if (data[p + 3] === 0) { transparentIndex = index[p / 4]; break; }
    }

    gif.writeFrame(index, outW, outH, {
      palette,
      delay: frame.delay || 100,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
    });

    state.prevDims = dims;
    state.prevDisposal = frame.disposalType;
    onProgress?.(i + 1, frames.length);

    // Yield periodically so the saving spinner keeps animating on long GIFs.
    if (i % 2 === 1) await new Promise(r => setTimeout(r, 0));
  }

  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}
