import React from "react";
import type { Status } from "./types";

interface AvatarProps {
  name: string;
  color?: string;       // av-1 … av-8
  size?: "xs" | "sm" | "" | "lg";
  status?: Status | null;
  ring?: boolean;
  imageUrl?: string;    // URL to avatar image; renders <img> when set
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  color = "av-1",
  size = "",
  status,
  ring,
  imageUrl,
}) => {
  const initials = (name || "?")
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className={`avatar ${size} ${!imageUrl ? color : ''}`}>
      {imageUrl ? <img src={imageUrl} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}} /> : initials}
      {ring && <span className="ring" />}
      {status && status !== "offline" && (
        <span className={`status-pip ${status}`} />
      )}
    </div>
  );
};
