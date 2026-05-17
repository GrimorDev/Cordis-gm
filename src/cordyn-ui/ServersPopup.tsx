import React from "react";
import { Layers, X, Search, Plus, Compass, CheckCircle2 } from "lucide-react";
import type { ServerSummary } from "./types";

interface ServersPopupProps {
  open: boolean;
  onClose: () => void;
  servers: ServerSummary[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreateServer?: () => void;
  onExplore?: () => void;
}

export const ServersPopup: React.FC<ServersPopupProps> = ({
  open,
  onClose,
  servers,
  activeId,
  onSelect,
  onCreateServer,
  onExplore,
}) => {
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const list = q.trim()
    ? servers.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
    : servers;

  return (
    <div className="servers-popup-backdrop" onClick={onClose}>
      <div className="servers-popup" onClick={(e) => e.stopPropagation()}>
        <div className="servers-popup-header">
          <span className="ic"><Layers size={18} /></span>
          <h3>Moje serwery</h3>
          <span className="count">{servers.length}</span>
          <button className="close-x" onClick={onClose}>
            <X size={14} />
          </button>
        </div>
        <div className="servers-popup-search">
          <Search size={14} />
          <input
            ref={inputRef}
            placeholder="Szukaj serwera…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="servers-popup-list">
          {list.map((s) => (
            <div
              key={s.id}
              className={`sp-item ${s.id === activeId ? "active" : ""}`}
              onClick={() => {
                onSelect(s.id);
                onClose();
              }}
            >
              <div className={`server-mini ${s.color || "av-7"}`}>
                {s.short || s.name[0]}
              </div>
              <div className="meta">
                <div className="name">
                  {s.name}
                  {s.verified && (
                    <span className="verified" title="Zweryfikowany">
                      <CheckCircle2 size={13} />
                    </span>
                  )}
                </div>
                {s.sub && <div className="sub">{s.sub}</div>}
              </div>
              {s.unread && (
                <span className="badge" style={{ marginLeft: 4 }}>•</span>
              )}
            </div>
          ))}
          {list.length === 0 && (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              Brak serwerów pasujących do „{q}".
            </div>
          )}
        </div>
        <div className="servers-popup-footer">
          <button onClick={onCreateServer}>
            <Plus size={15} />
            <span>Utwórz serwer</span>
          </button>
          <button onClick={onExplore}>
            <Compass size={15} />
            <span>Odkryj serwery</span>
          </button>
        </div>
      </div>
    </div>
  );
};
