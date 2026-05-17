// src/cordyn-ui/adapters.ts
// Adapter functions to map Cordyn API data shapes to CordynShell prop shapes

import type {
  ServerSummary, Category, Channel as UIChannel,
  MembersByRole, Member, DM, MessageItem, ChatMessage, Status,
} from "./types";

// Hash user ID to av-1...av-8 palette class
export const avatarPaletteFor = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return `av-${(Math.abs(h) % 8) + 1}`;
};

// Map API ServerData to ServerSummary
export const mapServers = (guilds: any[], staticUrl: (u: string | null | undefined) => string): ServerSummary[] =>
  guilds.map((g) => ({
    id: g.id,
    name: g.name,
    short: g.name.slice(0, 2).toUpperCase(),
    color: avatarPaletteFor(g.id),
    unread: false,
    badge: null,
    sub: g.description || undefined,
    verified: g.is_official,
    iconUrl: g.icon_url ? staticUrl(g.icon_url) : undefined,
  }));

// Map API ChannelCategory[] to Category[]
export const mapCategories = (categories: any[]): Category[] =>
  categories
    .filter(cat => cat.id !== '__uncat__')
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      channels: cat.channels.map((ch: any): UIChannel => ({
        id: ch.id,
        name: ch.name,
        type: ch.type as UIChannel["type"],
        unread: (ch.unread_count || 0) > 0,
        locked: !!ch.is_private,
        badge: ch.unread_count > 0 ? ch.unread_count : undefined,
        topic: ch.description || undefined,
      })),
    }));

// Map API ServerMember[] to MembersByRole
export const mapMembers = (members: any[], staticUrl: (u: string | null | undefined) => string): MembersByRole => {
  const toMember = (m: any): Member => ({
    name: m.username,
    avatar: m.avatar_url ? staticUrl(m.avatar_url) : undefined,
    status: (m.status as Status) || "offline",
    substatus: m.custom_status || undefined,
    role: m.role_name !== "member" ? m.role_name : undefined,
  });
  return {
    tester: members.filter(m => m.role_name === "tester" && !m.is_bot).map(toMember),
    online: members.filter(m => m.status === "online" && !m.is_bot).map(toMember),
    idle: members.filter(m => m.status === "idle").map(toMember),
    dnd: members.filter(m => m.status === "dnd").map(toMember),
    offline: members.filter(m => m.status === "offline" && !m.is_bot).map(toMember),
    boty: members.filter(m => m.is_bot).map(toMember),
  };
};

// Map API DmConversation[] to DM[]
export const mapDMs = (convs: any[], unreadDms: Record<string, number>, staticUrl: (u: string | null | undefined) => string): DM[] =>
  convs.map((d) => ({
    id: d.id,
    name: d.other_username,
    avatar: d.other_avatar ? staticUrl(d.other_avatar) : undefined,
    status: (d.other_status as Status) || "offline",
    preview: d.last_message || "",
    unread: unreadDms[d.other_user_id] || 0,
    mutualServers: d.mutual_servers_count,
    mutualFriends: d.mutual_friends_count,
  }));

const roleKind = (label: string): "dev" | "tester" | "cvel" | "bot" => {
  const l = label.toLowerCase();
  if (l.includes("dev")) return "dev";
  if (l.includes("test")) return "tester";
  if (l === "cvel") return "cvel";
  return "bot";
};

// Map API MessageFull[] | DmMessageFull[] to MessageItem[]
export const mapMessages = (msgs: any[], staticUrl: (u: string | null | undefined) => string): MessageItem[] => {
  const items: MessageItem[] = [];
  let lastDate = "";
  let lastAuthor = "";
  let lastTime = 0;

  for (const m of msgs) {
    const date = new Date(m.created_at).toLocaleDateString("pl-PL", {
      day: "numeric", month: "long", year: "numeric",
    });
    if (date !== lastDate) {
      items.push({ kind: "date", id: `d-${m.id}-${date}`, label: date.toUpperCase() });
      lastDate = date;
      lastAuthor = "";
    }
    const time = new Date(m.created_at);
    const authorId = m.sender_id;
    const cont =
      lastAuthor === authorId &&
      time.getTime() - lastTime < 5 * 60 * 1000;

    const avatarUrl = m.sender_avatar ? staticUrl(m.sender_avatar) : undefined;

    items.push({
      kind: "message",
      id: m.id,
      author: m.sender_username || m.sender_name || "Unknown",
      avatar: avatarUrl || avatarPaletteFor(authorId),
      role: m.sender_role ? { kind: roleKind(m.sender_role), label: m.sender_role } : null,
      time: time.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }),
      content: m.content,
      continuation: cont,
      reactions: m.reactions?.map((r: any) => ({
        emoji: r.emoji,
        count: r.count,
        mine: r.mine,
      })),
      image: m.attachment_url && (m.attachment_url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i) || m.attachment_url.includes('/uploads/'))
        ? staticUrl(m.attachment_url)
        : undefined,
    } as ChatMessage);
    lastAuthor = authorId;
    lastTime = time.getTime();
  }
  return items;
};
