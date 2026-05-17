import React from "react";
import { Users } from "lucide-react";
import { Avatar } from "./Avatar";
import type { Member, MembersByRole } from "./types";

type DotClass = "online" | "idle" | "dnd" | "offline" | "bot";

const RoleGroup: React.FC<{
  label: string;
  count: number;
  members: Member[];
  dotClass?: DotClass;
}> = ({ label, count, members, dotClass = "online" }) => (
  <>
    <div className="role-group">
      <span className={`dot ${dotClass}`} />
      <span className="label">{label}</span>
      <span className="count">{count}</span>
    </div>
    {members.map((m, i) => (
      <div
        key={i}
        className={`member ${m.status === "offline" ? "offline" : ""}`}
      >
        <Avatar
          name={m.name}
          color={m.avatar}
          size="sm"
          status={m.status === "offline" ? null : m.status}
        />
        <div className="meta">
          <div className="name">
            <span>{m.name}</span>
            {m.role && <span className="role-pip">{m.role}</span>}
          </div>
          {m.substatus && <div className="substatus">{m.substatus}</div>}
        </div>
      </div>
    ))}
  </>
);

interface MembersPanelProps {
  data: MembersByRole;
  totalLabel?: string;   // np. "Aktywność serwera"
}

export const MembersPanel: React.FC<MembersPanelProps> = ({
  data,
  totalLabel = "Aktywność serwera",
}) => {
  const total =
    (data.tester?.length || 0) +
    (data.online?.length || 0) +
    (data.idle?.length || 0) +
    (data.dnd?.length || 0) +
    (data.offline?.length || 0) +
    (data.boty?.length || 0);

  return (
    <aside className="members-panel">
      <div className="members-header">
        <Users size={12} />
        <span style={{ marginLeft: 8 }}>{totalLabel}</span>
        <span className="count">{total}</span>
      </div>
      <div className="members-list">
        {data.tester && data.tester.length > 0 && (
          <RoleGroup label="Tester" count={data.tester.length} members={data.tester} dotClass="online" />
        )}
        {data.online && data.online.length > 0 && (
          <RoleGroup label="Online" count={data.online.length} members={data.online} dotClass="online" />
        )}
        {data.idle && data.idle.length > 0 && (
          <RoleGroup label="Nieaktywni" count={data.idle.length} members={data.idle} dotClass="idle" />
        )}
        {data.dnd && data.dnd.length > 0 && (
          <RoleGroup label="Nie przeszkadzać" count={data.dnd.length} members={data.dnd} dotClass="dnd" />
        )}
        {data.boty && data.boty.length > 0 && (
          <RoleGroup label="Boty" count={data.boty.length} members={data.boty} dotClass="bot" />
        )}
        {data.offline && data.offline.length > 0 && (
          <RoleGroup label="Offline" count={data.offline.length} members={data.offline} dotClass="offline" />
        )}
      </div>
    </aside>
  );
};
