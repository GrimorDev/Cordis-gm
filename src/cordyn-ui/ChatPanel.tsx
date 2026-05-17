import React from "react";
import {
  MessageSquare, Bell, Inbox, Focus, Users, MoreHorizontal, Phone, Video, Pin,
  AtSign,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { Composer } from "./Composer";
import { Message } from "./Message";
import type { Channel, ChatMessage, MessageItem, DM } from "./types";

interface ChatPanelProps {
  channel: Channel;
  messages: MessageItem[];
  membersOpen: boolean;
  focus: boolean;
  typing?: string | null;
  onSend: (text: string) => void;
  onReact: (mid: string, idx: number) => void;
  onAddReaction: (mid: string) => void;
  onReply?: (mid: string) => void;
  onPin?: (mid: string) => void;
  onToggleMembers: () => void;
  onToggleFocus: () => void;
  pinnedCount?: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  channel,
  messages,
  membersOpen,
  focus,
  typing,
  onSend,
  onReact,
  onAddReaction,
  onReply,
  onPin,
  onToggleMembers,
  onToggleFocus,
  pinnedCount = 0,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <main className="chat-panel">
      <header className="chat-header">
        <div className="ch-name">
          <span className="hash">#</span>
          <span>{channel.name}</span>
        </div>
        <div className="ch-topic">
          {channel.topic || "Kanał tekstowy · brak tematu"}
        </div>
        <div className="actions">
          {pinnedCount > 0 && (
            <span className="pinned-tag">{pinnedCount} PINY</span>
          )}
          <button title="Wątki"><MessageSquare size={15} /></button>
          <button title="Powiadomienia"><Bell size={15} /></button>
          <button title="Skrzynka"><Inbox size={15} /></button>
          <button
            title="Focus mode"
            className={focus ? "" : "off"}
            onClick={onToggleFocus}
          >
            <Focus size={15} />
          </button>
          <button
            className={`toggle-members ${membersOpen ? "" : "off"}`}
            title="Lista członków"
            onClick={onToggleMembers}
          >
            <Users size={15} />
          </button>
          <button title="Więcej"><MoreHorizontal size={15} /></button>
        </div>
      </header>

      <div className="messages" ref={scrollRef}>
        <div className="messages-inner">
          {messages.map((m, i) => (
            <Message
              key={"id" in m && m.id ? m.id : `d-${i}`}
              m={m}
              onReact={onReact}
              onAddReaction={onAddReaction}
              onReply={onReply}
              onPin={onPin}
            />
          ))}
        </div>
      </div>

      <div className="composer-wrap">
        <div className="typing-indicator">
          {typing && (
            <>
              <span className="dots"><i /><i /><i /></span>
              <span>
                <b style={{ color: "var(--text-2)" }}>{typing}</b> pisze…
              </span>
            </>
          )}
        </div>
        <Composer channel={channel.name} onSend={onSend} />
      </div>
    </main>
  );
};

interface DMChatProps {
  dm: DM;
  messages: MessageItem[];
  onSend: (text: string) => void;
  onReact: (mid: string, idx: number) => void;
  onAddReaction: (mid: string) => void;
  onStartCall?: () => void;
  onStartVideo?: () => void;
}

export const DMChat: React.FC<DMChatProps> = ({
  dm,
  messages,
  onSend,
  onReact,
  onAddReaction,
  onStartCall,
  onStartVideo,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const statusLabel =
    dm.status === "online"
      ? "Online"
      : dm.status === "idle"
        ? "Nieaktywny"
        : dm.status === "dnd"
          ? "Nie przeszkadzać"
          : "Offline";

  return (
    <main className="chat-panel">
      <header className="chat-header">
        <Avatar name={dm.name} color={dm.avatar} size="sm" status={dm.status} />
        <div className="ch-name" style={{ marginLeft: 4 }}>
          <span>{dm.name}</span>
        </div>
        <div className="ch-topic">{statusLabel}</div>
        <div className="actions">
          <button title="Połączenie głosowe" onClick={onStartCall}>
            <Phone size={15} />
          </button>
          <button title="Wideo" onClick={onStartVideo}>
            <Video size={15} />
          </button>
          <button title="Przypnij"><Pin size={15} /></button>
          <button title="Profil"><Users size={15} /></button>
        </div>
      </header>

      <div className="messages" ref={scrollRef}>
        <div className="messages-inner">
          {messages.map((m, i) => (
            <Message
              key={"id" in m && m.id ? m.id : `d-${i}`}
              m={m}
              onReact={onReact}
              onAddReaction={onAddReaction}
            />
          ))}
        </div>
      </div>

      <div className="composer-wrap">
        <div className="typing-indicator" />
        <Composer channel={dm.name} onSend={onSend} placeholder={`Wiadomość do ${dm.name}…`} />
      </div>
    </main>
  );
};

interface DMEmptyProps {
  dms: DM[];
  onSelect: (id: string) => void;
}

export const DMEmpty: React.FC<DMEmptyProps> = ({ dms, onSelect }) => (
  <main className="chat-panel">
    <header className="chat-header">
      <AtSign size={18} />
      <div className="ch-name"><span>Wiadomości prywatne</span></div>
      <div className="ch-topic">
        Wybierz znajomego lub zaproś nowych do Cordyna
      </div>
      <div className="actions">
        <button title="Skrzynka"><Inbox size={15} /></button>
      </div>
    </header>
    <div style={{ flex: 1, overflow: "auto" }}>
      <div className="dm-empty">
        <div className="hero-icon">
          <AtSign size={36} strokeWidth={1.4} />
        </div>
        <h1>Twoja przestrzeń DM</h1>
        <p>
          Wybierz znajomego z listy obok, aby zacząć rozmawiać, albo zaproś nową
          osobę do Cordyna.
        </p>
        <div className="suggestions">
          <div className="sugg-label">Znajomi · ostatnio aktywni</div>
          <div>
            {dms.filter((d) => d.status !== "offline").slice(0, 5).map((d) => (
              <div key={d.id} className="dm-item" onClick={() => onSelect(d.id)}>
                <Avatar name={d.name} color={d.avatar} size="sm" status={d.status} />
                <div className="meta">
                  <div className="name">{d.name}</div>
                  <div className="preview">
                    {d.status === "online"
                      ? "Aktywny teraz"
                      : d.status === "idle"
                        ? "Nieaktywny"
                        : "Nie przeszkadzać"}
                  </div>
                </div>
                <button
                  className="icon-btn"
                  style={{ width: 28, height: 28, color: "var(--text-3)" }}
                >
                  <AtSign size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </main>
);
