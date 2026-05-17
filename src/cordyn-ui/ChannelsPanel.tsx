import React from "react";
import {
  Hash, Volume2, Megaphone, MessageSquare, Lock,
  Search, ChevronDown, Plus, Mic, MicOff, Headphones, Settings,
  PhoneOff, Layers,
} from "lucide-react";
import { Avatar } from "./Avatar";
import type { Category, Channel, ServerSummary, CurrentUser } from "./types";

const channelIcon = (type: Channel["type"]) => {
  switch (type) {
    case "voice": return <Volume2 size={14} />;
    case "announcement": return <Megaphone size={14} />;
    case "forum": return <MessageSquare size={14} />;
    default: return <Hash size={14} />;
  }
};

const ChannelRow: React.FC<{
  ch: Channel;
  active: boolean;
  onClick: (id: string) => void;
}> = ({ ch, active, onClick }) => (
  <div
    className={`channel ${active ? "active" : ""} ${ch.unread ? "unread" : ""}`}
    onClick={() => onClick(ch.id)}
  >
    <span className="icon">
      {ch.locked ? <Lock size={14} /> : channelIcon(ch.type)}
    </span>
    <span className="name">{ch.name}</span>
    {ch.badge && <span className="badge">{ch.badge}</span>}
  </div>
);

const VoiceParticipants: React.FC<{ list: NonNullable<Channel["participants"]> }> = ({ list }) => (
  <div style={{ marginTop: 2 }}>
    {list.map((p, i) => (
      <div key={i} className="voice-active">
        <Avatar name={p.name} color={p.color} size="xs" status="online" />
        <span>{p.name}</span>
        {p.speaking && (
          <span className="speaking">
            <i /><i /><i />
          </span>
        )}
      </div>
    ))}
  </div>
);

const CategoryGroup: React.FC<{
  cat: Category;
  activeChannelId: string;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}> = ({ cat, activeChannelId, collapsed, onToggle, onSelect }) => (
  <div>
    <div
      className={`category ${collapsed ? "collapsed" : ""}`}
      onClick={onToggle}
    >
      <span className="chev"><ChevronDown size={11} /></span>
      <span className="category-label">{cat.name}</span>
      <span style={{ color: "var(--text-4)", display: "grid", placeItems: "center" }}>
        <Plus size={12} />
      </span>
    </div>
    {!collapsed && cat.channels.map((ch) => (
      <React.Fragment key={ch.id}>
        <ChannelRow ch={ch} active={activeChannelId === ch.id} onClick={onSelect} />
        {ch.type === "voice" && ch.participants && ch.participants.length > 0 && (
          <VoiceParticipants list={ch.participants} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const VoiceFloating: React.FC<{ channel: string; latencyMs?: number; bitrateKbps?: number }> = ({
  channel,
  latencyMs = 48,
  bitrateKbps = 32,
}) => (
  <div className="voice-floating">
    <div className="top">
      <span className="pulse" />
      <span className="ch">{channel}</span>
      <span className="text-mono muted" style={{ fontSize: 10.5 }}>
        {latencyMs}ms · {bitrateKbps}kbps
      </span>
    </div>
    <div className="controls">
      <button title="Mikrofon"><Mic size={15} /></button>
      <button title="Słuchawki"><Headphones size={15} /></button>
      <button title="Wideo"><Layers size={15} /></button>
      <button className="disconnect" title="Rozłącz"><PhoneOff size={15} /></button>
    </div>
  </div>
);

const UserCard: React.FC<{
  user: CurrentUser;
  micOn: boolean;
  deafened: boolean;
  onToggleMic: () => void;
  onToggleDeaf: () => void;
  onOpenSettings?: () => void;
}> = ({ user, micOn, deafened, onToggleMic, onToggleDeaf, onOpenSettings }) => (
  <div className="user-card">
    <Avatar name={user.name} color={user.avatar} size="sm" status="online" ring />
    <div className="meta">
      <div className="name">{user.name}</div>
      <div className="status">{user.status}</div>
    </div>
    <div className="controls">
      <button
        className={micOn ? "" : "muted"}
        onClick={onToggleMic}
        title="Mikrofon"
      >
        {micOn ? <Mic size={14} /> : <MicOff size={14} />}
      </button>
      <button
        className={deafened ? "muted" : ""}
        onClick={onToggleDeaf}
        title="Słuchawki"
      >
        <Headphones size={14} />
      </button>
      <button onClick={onOpenSettings} title="Ustawienia">
        <Settings size={14} />
      </button>
    </div>
  </div>
);

interface ChannelsPanelProps {
  servers: ServerSummary[];
  server: ServerSummary;
  serverTag?: string;        // np. "anakonda atakuje · 14 online"
  categories: Category[];
  activeChannelId: string;
  voiceActive?: string | null;
  layout: "classic" | "unified" | "floating";
  user: CurrentUser;
  micOn: boolean;
  deafened: boolean;
  onSelectChannel: (id: string) => void;
  onSelectServer?: (id: string) => void;
  onOpenCmdK: () => void;
  onToggleMic: () => void;
  onToggleDeaf: () => void;
  onOpenSettings?: () => void;
}

export const ChannelsPanel: React.FC<ChannelsPanelProps> = ({
  servers,
  server,
  serverTag,
  categories,
  activeChannelId,
  voiceActive,
  layout,
  user,
  micOn,
  deafened,
  onSelectChannel,
  onSelectServer,
  onOpenCmdK,
  onToggleMic,
  onToggleDeaf,
  onOpenSettings,
}) => {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  return (
    <aside className="channels-panel">
      <div className="channels-header">
        <div className="server-name">
          <span>{server.name}</span>
          <span className="pulse" />
        </div>
        <div className="server-tag">{serverTag || "Aktywny serwer"}</div>
      </div>

      {layout === "unified" && (
        <div className="inline-servers">
          {servers.map((s) => (
            <ServerInlineIcon
              key={s.id}
              server={s}
              active={s.id === server.id}
              onClick={() => onSelectServer?.(s.id)}
            />
          ))}
        </div>
      )}

      <div className="channels-search" onClick={onOpenCmdK}>
        <Search size={14} />
        <input
          placeholder="Szukaj w serwerze…"
          readOnly
          onFocus={(e) => {
            (e.target as HTMLInputElement).blur();
            onOpenCmdK();
          }}
        />
        <span className="kbd">⌘K</span>
      </div>

      <div className="channels-list">
        {categories.map((cat) => (
          <CategoryGroup
            key={cat.id}
            cat={cat}
            activeChannelId={activeChannelId}
            collapsed={!!collapsed[cat.id]}
            onToggle={() =>
              setCollapsed((c) => ({ ...c, [cat.id]: !c[cat.id] }))
            }
            onSelect={onSelectChannel}
          />
        ))}
      </div>

      {voiceActive && <VoiceFloating channel={voiceActive} />}

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

const ServerInlineIcon: React.FC<{
  server: ServerSummary;
  active: boolean;
  onClick: () => void;
}> = ({ server, active, onClick }) => (
  <button
    className={`server-icon ${active ? "active" : ""} ${server.color || ""}`}
    onClick={onClick}
    title={server.name}
  >
    <span className="marker" />
    <span>{server.short || server.name?.[0]}</span>
  </button>
);

export { UserCard };
