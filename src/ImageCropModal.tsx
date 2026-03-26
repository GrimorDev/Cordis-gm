import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react';

// ── Canvas helper — zwraca wykadrowany Blob ───────────────────────────────
async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  outputMime = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  const image = await createImageBitmap(await (await fetch(imageSrc)).blob());
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bw = image.width * cos + image.height * sin;
  const bh = image.width * sin + image.height * cos;

  // Tymczasowy canvas z rotacją
  const rotCanvas = document.createElement('canvas');
  rotCanvas.width = bw;
  rotCanvas.height = bh;
  const rotCtx = rotCanvas.getContext('2d')!;
  rotCtx.translate(bw / 2, bh / 2);
  rotCtx.rotate(rad);
  rotCtx.drawImage(image, -image.width / 2, -image.height / 2);

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    rotCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('toBlob failed'))), outputMime, quality);
  });
}

// ── Typy ──────────────────────────────────────────────────────────────────
export type CropShape = 'round' | 'rect';

interface Props {
  /** Plik wybrany przez usera */
  file: File;
  /** Proporcje kadru: 1 = kwadrat (avatar), 3 = baner 3:1, 16/5 = baner serwera */
  aspect: number;
  /** Kształt podglądu — "round" dla avatarów, "rect" dla bannerów/ikon */
  cropShape?: CropShape;
  /** Tytuł w nagłówku modala */
  title?: string;
  onCancel: () => void;
  /** Wywoływane gdy user kliknie "Zapisz" — dostaje gotowy File */
  onDone: (croppedFile: File) => void;
}

// ── Komponent ─────────────────────────────────────────────────────────────
export default function ImageCropModal({
  file,
  aspect,
  cropShape = 'rect',
  title = 'Kadruj zdjęcie',
  onCancel,
  onDone,
}: Props) {
  const src = URL.createObjectURL(file);

  const [crop, setCrop]         = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom]         = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving]     = useState(false);

  const onCropComplete = useCallback((_: Area, pixelCrop: Area) => {
    setCroppedArea(pixelCrop);
  }, []);

  const handleSave = async () => {
    if (!croppedArea) return;
    setSaving(true);
    try {
      const mime = file.type === 'image/png' ? 'image/png' : file.type === 'image/gif' ? 'image/gif' : 'image/jpeg';
      const blob = await getCroppedBlob(src, croppedArea, rotation, mime);
      const ext  = mime === 'image/png' ? '.png' : mime === 'image/gif' ? '.gif' : '.jpg';
      const name = file.name.replace(/\.[^.]+$/, '') + '_crop' + ext;
      onDone(new File([blob], name, { type: mime }));
    } catch (e) {
      console.error('Crop error', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative bg-[#18182a] rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <span className="font-bold text-white text-sm">{title}</span>
          <button onClick={onCancel} className="text-zinc-400 hover:text-white transition-colors">
            <X size={18}/>
          </button>
        </div>

        {/* Cropper area */}
        <div className="relative w-full" style={{ height: 340, background: '#0e0e1a' }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { background: '#0e0e1a' },
              cropAreaStyle: { border: '2px solid rgba(99,102,241,0.9)', boxShadow: '0 0 0 9999em rgba(0,0,0,0.55)' },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-5 py-4 space-y-3">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <button onClick={() => setZoom(z => Math.max(1, z - 0.1))}
              className="text-zinc-400 hover:text-white transition-colors">
              <ZoomOut size={16}/>
            </button>
            <input type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 accent-indigo-500 h-1"/>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.1))}
              className="text-zinc-400 hover:text-white transition-colors">
              <ZoomIn size={16}/>
            </button>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <RotateCw size={16} className="text-zinc-400 shrink-0"/>
            <input type="range" min={-180} max={180} step={1} value={rotation}
              onChange={e => setRotation(Number(e.target.value))}
              className="flex-1 accent-indigo-500 h-1"/>
            <span className="text-zinc-500 text-xs w-10 text-right">{rotation}°</span>
            {rotation !== 0 && (
              <button onClick={() => setRotation(0)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Reset</button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-sm font-medium transition-colors">
            Anuluj
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold transition-colors flex items-center justify-center gap-1.5">
            {saving ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
            ) : (
              <><Check size={15}/> Zapisz</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
