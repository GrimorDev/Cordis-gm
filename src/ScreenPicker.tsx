// ─── Custom screen-share source picker ───────────────────────────────────────
// A consistent, in-app chooser (screen / window) shown before sharing, so the
// user picks exactly what to share on every platform — instead of relying on
// each WebView's inconsistent native chooser (Windows WebView2 grabs the whole
// screen with none). Fed by listScreenSources() (native enumeration).

import { useState } from 'react';
import type { ScreenSource } from './rtc/screen';

interface Props {
  sources: ScreenSource[];
  onPick: (source: ScreenSource) => void;
  onCancel: () => void;
}

export default function ScreenPicker({ sources, onPick, onCancel }: Props) {
  const [tab, setTab] = useState<'screen' | 'window'>('screen');
  const [selected, setSelected] = useState<string | null>(null);
  const filtered = sources.filter(s => s.kind === tab);
  const pick = () => {
    const s = sources.find(x => x.id === selected);
    if (s) onPick(s);
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-[680px] max-w-[92vw] max-h-[82vh] flex flex-col rounded-2xl border border-white/10 bg-[#15151b] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-white font-semibold text-sm">Udostępnij ekran</h2>
          <button onClick={onCancel} className="text-zinc-400 hover:text-white text-lg leading-none">×</button>
        </div>

        <div className="flex gap-1 px-5 pt-3">
          {(['screen', 'window'] as const).map(k => (
            <button
              key={k}
              onClick={() => { setTab(k); setSelected(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === k ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {k === 'screen' ? `Ekrany (${sources.filter(s => s.kind === 'screen').length})`
                              : `Okna (${sources.filter(s => s.kind === 'window').length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-3 gap-3">
          {filtered.length === 0 && (
            <div className="col-span-3 text-center text-zinc-500 text-sm py-10">
              Brak {tab === 'screen' ? 'ekranów' : 'okien'} do udostępnienia
            </div>
          )}
          {filtered.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s.id)}
              onDoubleClick={() => onPick(s)}
              className={`group flex flex-col rounded-xl overflow-hidden border-2 transition-colors ${
                selected === s.id ? 'border-indigo-500' : 'border-transparent hover:border-white/20'
              }`}
            >
              <div className="aspect-video bg-black/50 flex items-center justify-center overflow-hidden">
                {s.thumbnail
                  ? <img src={s.thumbnail} alt={s.name} className="w-full h-full object-cover" />
                  : <span className="text-zinc-600 text-2xl">🖥️</span>}
              </div>
              <span className="px-2 py-1.5 text-[11px] text-zinc-300 truncate text-left bg-black/30">{s.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs text-zinc-300 hover:bg-white/5">Anuluj</button>
          <button
            onClick={pick}
            disabled={!selected}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500"
          >
            Udostępnij
          </button>
        </div>
      </div>
    </div>
  );
}
