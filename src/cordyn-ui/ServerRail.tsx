import React from "react";
import { AtSign, Plus, Layers, Compass } from "lucide-react";
import type { ServerSummary } from "./types";

interface ServerRailIconProps {
  server: ServerSummary;
  active: boolean;
  onClick: () => void;
}

export const ServerRailIcon: React.FC<ServerRailIconProps> = ({
  server,
  active,
  onClick,
}) => (
  <button
    className={`server-icon ${active ? "active" : ""} ${server.color || ""}`}
    onClick={onClick}
    title={server.name}
  >
    <span className="marker" />
    {server.iconUrl ? (
      <img src={server.iconUrl} alt={server.name} />
    ) : (
      <span>{server.short || server.name?.[0]}</span>
    )}
    {server.unread && !active && <span className="unread-dot" />}
  </button>
);

interface ServerRailProps {
  servers: ServerSummary[];
  activeId: string;
  view: "server" | "dm";
  onSelect: (id: string) => void;
  onViewChange: (view: "server" | "dm") => void;
  onOpenServersList: () => void;
  onCreateServer?: () => void;
  onExplore?: () => void;
}

export const ServerRail: React.FC<ServerRailProps> = ({
  servers,
  activeId,
  view,
  onSelect,
  onViewChange,
  onOpenServersList,
  onCreateServer,
  onExplore,
}) => (
  <nav className="server-rail">
    <button
      className={`server-icon dm-pill ${view === "dm" ? "active" : ""}`}
      onClick={() => onViewChange("dm")}
      title="Wiadomości prywatne"
    >
      <span className="marker" />
      <AtSign size={20} />
    </button>
    <div className="divider" />
    {servers.map((s) => (
      <ServerRailIcon
        key={s.id}
        server={s}
        active={view === "server" && activeId === s.id}
        onClick={() => {
          onViewChange("server");
          onSelect(s.id);
        }}
      />
    ))}
    <button
      className="server-icon add"
      title="Dodaj serwer"
      onClick={onCreateServer}
    >
      <Plus size={18} />
    </button>
    <button
      className="server-icon add"
      title="Moje serwery"
      onClick={onOpenServersList}
      style={{ color: "var(--text-3)" }}
    >
      <Layers size={18} />
    </button>
    <button
      className="server-icon add"
      title="Eksploruj serwery"
      onClick={onExplore}
      style={{ color: "var(--text-3)" }}
    >
      <Compass size={18} />
    </button>
  </nav>
);
