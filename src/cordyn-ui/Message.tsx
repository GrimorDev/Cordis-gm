import React from "react";
import {
  Smile, Reply, MessageSquare, Pin, Bookmark, MoreHorizontal, Bell, SmilePlus,
} from "lucide-react";
import { Avatar } from "./Avatar";
import type { ChatMessage, MessageItem, Reaction, RoleTag } from "./types";

const RoleTagBadge: React.FC<{ role: RoleTag }> = ({ role }) => (
  <span className={`role-tag ${role.kind}`}>{role.label}</span>
);

const renderContent = (text?: string): React.ReactNode => {
  if (!text) return null;
  const parts = text.split(/(\s+)/);
  return parts.map((p, i) => {
    if (p.startsWith("@") || p.startsWith("#")) {
      return <span key={i} className="mention">{p}</span>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={i}>{p.slice(1, -1)}</code>;
    }
    if (p.startsWith("http")) {
      return (
        <a
          key={i}
          style={{
            color: "rgb(var(--aurora-b))",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          {p}
        </a>
      );
    }
    return <span key={i}>{p}</span>;
  });
};

const Reactions: React.FC<{
  list: Reaction[];
  onAdd: () => void;
  onToggle: (idx: number) => void;
}> = ({ list, onAdd, onToggle }) => (
  <div className="reactions">
    {list.map((r, i) => (
      <button
        key={i}
        className={`reaction ${r.mine ? "mine" : ""}`}
        onClick={() => onToggle(i)}
      >
        <span className="emoji">{r.emoji}</span>
        <span>{r.count}</span>
      </button>
    ))}
    <button
      className="reaction add-reaction"
      onClick={onAdd}
      title="Dodaj reakcję"
    >
      <SmilePlus size={13} />
    </button>
  </div>
);

const MsgToolbar: React.FC<{
  onReact: () => void;
  onReply?: () => void;
  onPin?: () => void;
  onThread?: () => void;
}> = ({ onReact, onReply, onPin, onThread }) => (
  <div className="msg-toolbar">
    <button onClick={onReact} title="Reaguj"><Smile size={14} /></button>
    <button onClick={onReply} title="Odpowiedz"><Reply size={14} /></button>
    <button onClick={onThread} title="Wątek"><MessageSquare size={14} /></button>
    <button onClick={onPin} title="Przypnij"><Pin size={14} /></button>
    <button title="Zapisz"><Bookmark size={14} /></button>
    <button title="Więcej"><MoreHorizontal size={14} /></button>
  </div>
);

interface MessageProps {
  m: MessageItem;
  onReact: (mid: string, idx: number) => void;
  onAddReaction: (mid: string) => void;
  onReply?: (mid: string) => void;
  onPin?: (mid: string) => void;
}

export const Message: React.FC<MessageProps> = ({
  m,
  onReact,
  onAddReaction,
  onReply,
  onPin,
}) => {
  if (m.kind === "date") {
    return (
      <div className="date-divider">
        <span>{m.label}</span>
      </div>
    );
  }
  const msg = m as ChatMessage;
  return (
    <div className={`message ${msg.continuation ? "continuation" : ""}`}>
      <div className="avatar-col">
        {msg.continuation ? (
          <span>{msg.time}</span>
        ) : (
          <Avatar name={msg.author} color={msg.avatar} />
        )}
      </div>
      <div className="body">
        {!msg.continuation && (
          <div className="meta">
            <span className="author">{msg.author}</span>
            {msg.role && <RoleTagBadge role={msg.role} />}
            <span className="timestamp">{msg.time}</span>
          </div>
        )}
        {msg.system ? (
          <div className="system-card">
            <span className="ic"><Bell size={12} /></span>
            <div>
              {msg.system.text}{" "}
              <span className="channel-ref">{msg.system.channel}</span>
              {msg.system.more}
            </div>
          </div>
        ) : (
          <div className="content">{renderContent(msg.content)}</div>
        )}
        {msg.embed && (
          <div className="link-embed">
            <div className="src">{msg.embed.src}</div>
            <div className="title">{msg.embed.title}</div>
            <div className="desc">{msg.embed.desc}</div>
          </div>
        )}
        {msg.image && (
          <div className="img-attach">
            <div className="placeholder">{msg.image}</div>
          </div>
        )}
        {msg.reactions && (
          <Reactions
            list={msg.reactions}
            onAdd={() => onAddReaction(msg.id)}
            onToggle={(i) => onReact(msg.id, i)}
          />
        )}
      </div>
      {!msg.system && (
        <MsgToolbar
          onReact={() => onAddReaction(msg.id)}
          onReply={() => onReply?.(msg.id)}
          onPin={() => onPin?.(msg.id)}
        />
      )}
    </div>
  );
};
