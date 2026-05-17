import React from "react";
import { Minus, Square, X } from "lucide-react";

interface TitleBarProps {
  brand?: string;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  brand = "Cordyn",
  onMinimize,
  onMaximize,
  onClose,
}) => (
  <div className="titlebar">
    <div className="brand">
      <span className="dot" />
      <span>{brand}</span>
    </div>
    <div className="win-actions">
      <button title="Minimalizuj" onClick={onMinimize}>
        <Minus size={12} />
      </button>
      <button title="Maksymalizuj" onClick={onMaximize}>
        <Square size={11} />
      </button>
      <button className="close" title="Zamknij" onClick={onClose}>
        <X size={12} />
      </button>
    </div>
  </div>
);

interface Tab {
  id: string;
  label: string;
}

interface TabsBarProps {
  tabs: Tab[];
  activeTabId: string;
  view: "server" | "dm";
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onViewChange: (view: "server" | "dm") => void;
}

export const TabsBar: React.FC<TabsBarProps> = ({
  tabs,
  activeTabId,
  view,
  onSelect,
  onClose,
  onViewChange,
}) => (
  <div className="tabs-bar">
    <button
      className={`tab ${view === "dm" ? "active" : ""}`}
      onClick={() => onViewChange("dm")}
      style={{ paddingLeft: 10 }}
    >
      <span>@</span>
      <span>Wiadomości prywatne</span>
    </button>
    {tabs.map((t) => (
      <div
        key={t.id}
        className={`tab ${view === "server" && t.id === activeTabId ? "active" : ""}`}
        onClick={() => {
          onViewChange("server");
          onSelect(t.id);
        }}
      >
        <span className="hash">#</span>
        <span>{t.label}</span>
        <button
          className="close"
          onClick={(e) => {
            e.stopPropagation();
            onClose(t.id);
          }}
        >
          <X size={10} />
        </button>
      </div>
    ))}
  </div>
);
