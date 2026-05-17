import React from "react";
import {
  Search, Hash, Volume2, AtSign, Settings, Focus, Globe, Moon, Sparkles,
} from "lucide-react";
import type { CmdkItem } from "./types";

const iconFor = (name: string) => {
  switch (name) {
    case "hash": return <Hash size={15} />;
    case "voice": return <Volume2 size={15} />;
    case "at": return <AtSign size={15} />;
    case "settings": return <Settings size={15} />;
    case "focus": return <Focus size={15} />;
    case "globe": return <Globe size={15} />;
    case "moon": return <Moon size={15} />;
    default: return <Sparkles size={15} />;
  }
};

interface CmdKProps {
  open: boolean;
  onClose: () => void;
  items: CmdkItem[];
  onAction: (item: CmdkItem) => void;
}

const KIND_LABELS: Record<CmdkItem["kind"], string> = {
  channel: "Kanały",
  dm: "Wiadomości prywatne",
  server: "Serwery",
  action: "Akcje",
};

export const CmdK: React.FC<CmdKProps> = ({ open, onClose, items, onAction }) => {
  const [q, setQ] = React.useState("");
  const [sel, setSel] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = q.trim() === ""
    ? items
    : items.filter((i) =>
        (i.label + " " + (i.sub || "")).toLowerCase().includes(q.toLowerCase())
      );

  const groups: Record<string, CmdkItem[]> = {};
  filtered.forEach((it) => {
    if (!groups[it.kind]) groups[it.kind] = [];
    groups[it.kind].push(it);
  });

  const flat = filtered;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(flat.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[sel]) onAction(flat[sel]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div className="cmdk-backdrop" onClick={onClose} onKeyDown={onKey}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <Search size={18} />
          <input
            ref={inputRef}
            placeholder="Szukaj kanałów, osób, akcji…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setSel(0);
            }}
            onKeyDown={onKey}
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="cmdk-list">
          {Object.entries(groups).map(([kind, list]) => (
            <div key={kind}>
              <div className="cmdk-section-label">
                {KIND_LABELS[kind as CmdkItem["kind"]] || kind}
              </div>
              {list.map((it) => {
                runningIndex++;
                const localIdx = runningIndex;
                const isSel = localIdx === sel;
                return (
                  <div
                    key={it.label}
                    className={`cmdk-item ${isSel ? "selected" : ""}`}
                    onMouseEnter={() => setSel(localIdx)}
                    onClick={() => onAction(it)}
                  >
                    <span className="icon">{iconFor(it.icon)}</span>
                    <div>
                      <div>{it.label}</div>
                      {it.sub && (
                        <div
                          className="text-mono"
                          style={{
                            fontSize: 10.5,
                            color: "var(--text-3)",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {it.sub}
                        </div>
                      )}
                    </div>
                    <span className="kind">
                      {KIND_LABELS[it.kind] || it.kind}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {flat.length === 0 && (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              Nic nie znaleziono.
            </div>
          )}
        </div>
        <div className="cmdk-footer">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> nawigacja</span>
          <span><span className="kbd">↵</span> wybierz</span>
          <span><span className="kbd">⌘K</span> zamknij</span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Sparkles size={11} /> Cordyn AI
          </span>
        </div>
      </div>
    </div>
  );
};
