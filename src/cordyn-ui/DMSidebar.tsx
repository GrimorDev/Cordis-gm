import React from "react";
import { Edit } from "lucide-react";
import { Avatar } from "./Avatar";
import { UserCard } from "./ChannelsPanel";
import type { DM, CurrentUser } from "./types";

type DMTab = "all" | "unread" | "online";

interface DMSidebarProps {
  dms: DM[];
  activeDmId: string | null;
  onSelect: (id: string) => void;
  user: CurrentUser;
  micOn: boolean;
  deafened: boolean;
  onToggleMic: () => void;
  onToggleDeaf: () => void;
  onNewDM?: () => void;
  onOpenSettings?: () => void;
}

export const DMSidebar: React.FC<DMSidebarProps> = ({
  dms,
  activeDmId,
  onSelect,
  user,
  micOn,
  deafened,
  onToggleMic,
  onToggleDeaf,
  onNewDM,
  onOpenSettings,
}) => {
  const [tab, setTab] = React.useState<DMTab>("all");
  const filtered = dms.filter((d) => {
    if (tab === "unread") return (d.unread || 0) > 0;
    if (tab === "online") return d.status !== "offline";
    return true;
  });
  const newCount = dms.filter((d) => (d.unread || 0) > 0).length;
  return (
    <aside className="channels-panel">
      <div className="dm-header">
        <h2>Wiadomości prywatne</h2>
        <div
          className="text-mono muted"
          style={{ fontSize: 10.5, letterSpacing: "0.1em", marginTop: 4 }}
        >
          {dms.length} ROZMÓW · {newCount} NOWE
        </div>
      </div>
      <div className="dm-tabs">
        {(
          [
            ["all", "Wszystkie"],
            ["unread", "Nowe"],
            ["online", "Online"],
          ] as [DMTab, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button title="Nowa rozmowa" onClick={onNewDM}>
          <Edit size={14} />
        </button>
      </div>
      <div className="channels-list">
        {filtered.map((d) => (
          <div
            key={d.id}
            className={`dm-item ${activeDmId === d.id ? "active" : ""}`}
            onClick={() => onSelect(d.id)}
          >
            <Avatar name={d.name} color={d.avatar} size="sm" status={d.status} />
            <div className="meta">
              <div className="name">{d.name}</div>
              <div className="preview">{d.preview}</div>
            </div>
            {(d.unread || 0) > 0 && (
              <span className="badge">{d.unread}</span>
            )}
          </div>
        ))}
      </div>
      <UserCard
        user={user}
        micOn={micOn}
        deafened={deafened}
        onToggleMic={onToggleMic}
        onToggleDeaf={onToggleDeaf}
        onOpenSettings={onOpenSettings}
      />
    </aside>
  );
};
