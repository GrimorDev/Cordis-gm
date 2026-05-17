import React from "react";
import { ChevronDown, Users, Phone, Video } from "lucide-react";
import { Avatar } from "./Avatar";
import type { DM, ServerSummary } from "./types";

type Tab = "profil" | "media" | "linki" | "polaczenia" | "pin";

interface DMProfileProps {
  dm: DM;
  sharedServers?: ServerSummary[];     // pass actual mutual servers
  mutualFriends?: { id: string; name: string; avatar?: string; status: DM["status"] }[];
  initialNote?: string;
  onNoteChange?: (note: string) => void;
  onOpenFullProfile?: () => void;
  callHistory?: { date: string; duration: string; kind: "voice" | "video" }[];
  mediaCount?: number;
  linksCount?: number;
  pinsCount?: number;
}

export const DMProfile: React.FC<DMProfileProps> = ({
  dm,
  sharedServers = [],
  mutualFriends = [],
  initialNote = "",
  onNoteChange,
  onOpenFullProfile,
  callHistory = [],
  mediaCount = 0,
  linksCount = 0,
  pinsCount = 0,
}) => {
  const [tab, setTab] = React.useState<Tab>("profil");
  const [note, setNote] = React.useState(initialNote);
  const [sharedOpen, setSharedOpen] = React.useState(true);
  const [friendsOpen, setFriendsOpen] = React.useState(true);

  const statusLabel =
    dm.status === "online"
      ? "Aktywny/a"
      : dm.status === "idle"
        ? "Nieaktywny/a"
        : dm.status === "dnd"
          ? "Nie przeszkadzać"
          : "Offline";

  const initials = (dm.name || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="dm-profile">
      <div className="dm-profile-banner">
        <div
          className="bnr"
          style={dm.bannerUrl ? {
            backgroundImage: `url(${dm.bannerUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : undefined}
        />
      </div>
      <div className="dm-profile-avatar-wrap">
        <div className={`dm-profile-avatar ${dm.avatar || "av-1"}`}>
          {initials}
          {dm.status !== "offline" && (
            <span className={`status-pip ${dm.status}`} />
          )}
        </div>
      </div>
      <div className="dm-profile-body">
        <div className="dname">{dm.name}</div>
        <div className="status-line">
          {dm.status !== "offline" && (
            <span
              className={`status-pip ${dm.status}`}
              style={{ position: "static", border: 0, width: 8, height: 8 }}
            />
          )}
          {statusLabel}
          {dm.role && (
            <span className="role-pip" style={{ marginLeft: 6 }}>
              {dm.role}
            </span>
          )}
        </div>
      </div>

      <div className="dm-profile-tabs">
        {(
          [
            ["profil", "Profil", undefined],
            ["media", "Media", mediaCount],
            ["linki", "Linki", linksCount],
            ["polaczenia", "Połączenia", callHistory.length],
            ["pin", "Przypięte", pinsCount],
          ] as [Tab, string, number | undefined][]
        ).map(([k, l, b]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {l}
            {b !== undefined && b > 0 && <span className="badge">{b}</span>}
          </button>
        ))}
      </div>

      <div className="dm-profile-content">
        {tab === "profil" && (
          <>
            <div>
              <div className="dpf-label">Dołączył/a</div>
              <div className="dpf-value">{dm.joined || "—"}</div>
            </div>

            <div>
              <div
                className={`dpf-collapse ${sharedOpen ? "open" : ""}`}
                onClick={() => setSharedOpen((o) => !o)}
              >
                <span className="dpf-label" style={{ margin: 0 }}>
                  Wspólne serwery — {sharedServers.length}
                </span>
                <span className="chev">
                  <ChevronDown size={12} />
                </span>
              </div>
              {sharedOpen && (
                <div className="shared-servers">
                  {sharedServers.map((s) => (
                    <div className="shared-server" key={s.id}>
                      <div className={`icon-sq ${s.color || "av-7"}`}>
                        {s.short || s.name[0]}
                      </div>
                      <div className="name">{s.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div
                className={`dpf-collapse ${friendsOpen ? "open" : ""}`}
                onClick={() => setFriendsOpen((o) => !o)}
              >
                <span className="dpf-label" style={{ margin: 0 }}>
                  Wspólni znajomi — {mutualFriends.length}
                </span>
                <span className="chev">
                  <ChevronDown size={12} />
                </span>
              </div>
              {friendsOpen && (
                <div className="shared-servers">
                  {mutualFriends.map((f) => (
                    <div className="shared-server" key={f.id}>
                      <Avatar
                        name={f.name}
                        color={f.avatar}
                        size="xs"
                        status={f.status === "offline" ? null : f.status}
                      />
                      <div className="name">{f.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="dpf-label">Prywatna notatka</div>
              <textarea
                className="note-input"
                placeholder="Dodaj notatkę o tej osobie…"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value);
                  onNoteChange?.(e.target.value);
                }}
              />
            </div>
          </>
        )}

        {tab === "polaczenia" && (
          <div>
            <div className="dpf-label">Połączenia · {callHistory.length}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {callHistory.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "var(--bg-elev)",
                    border: "1px solid var(--stroke-1)",
                    fontSize: 12.5,
                  }}
                >
                  {c.kind === "video" ? <Video size={14} /> : <Phone size={14} />}
                  <span style={{ color: "var(--text-1)" }}>{c.date}</span>
                  <span className="text-mono muted" style={{ marginLeft: "auto" }}>
                    {c.duration}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "media" && (
          <div>
            <div className="dpf-label">Media · {mediaCount}</div>
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-3)" }}>
              Brak mediów do wyświetlenia.
            </div>
          </div>
        )}

        {tab === "linki" && (
          <div>
            <div className="dpf-label">Linki · {linksCount}</div>
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-3)" }}>
              Brak linków.
            </div>
          </div>
        )}

        {tab === "pin" && (
          <div>
            <div className="dpf-label">Przypięte · {pinsCount}</div>
            <div style={{ marginTop: 10, fontSize: 13, color: "var(--text-3)" }}>
              Brak przypiętych wiadomości w tej rozmowie.
            </div>
          </div>
        )}
      </div>

      <div className="dm-profile-cta">
        <button onClick={onOpenFullProfile}>
          <Users size={14} />
          <span>Wyświetl pełny profil</span>
        </button>
      </div>
    </aside>
  );
};
