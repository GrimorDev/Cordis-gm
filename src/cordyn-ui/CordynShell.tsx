import React from "react";
import { TitleBar, TabsBar } from "./TitleBar";
import { ServerRail } from "./ServerRail";
import { ChannelsPanel } from "./ChannelsPanel";
import { ChatPanel, DMChat, DMEmpty } from "./ChatPanel";
import { MembersPanel } from "./MembersPanel";
import { DMSidebar } from "./DMSidebar";
import { DMProfile } from "./DMProfile";
import { ServersPopup } from "./ServersPopup";
import { CmdK } from "./CmdK";
import type {
  ServerSummary, Category, Channel, MembersByRole, DM, MessageItem,
  CurrentUser, CmdkItem, Layout, Atmosphere, Density, Theme,
} from "./types";

export interface CordynShellProps {
  // Shell config (read these from your store / settings)
  layout?: Layout;
  atmosphere?: Atmosphere;
  density?: Density;
  theme?: Theme;
  focus?: boolean;
  membersOpen?: boolean;
  onChangeShell?: (changes: Partial<{
    layout: Layout;
    atmosphere: Atmosphere;
    density: Density;
    theme: Theme;
    focus: boolean;
    membersOpen: boolean;
  }>) => void;

  // Current user
  user: CurrentUser;

  // Active selection
  view: "server" | "dm";
  activeServerId: string;
  activeChannelId: string;
  activeDmId: string | null;
  openTabs: { id: string; label: string }[];

  // Data
  servers: ServerSummary[];
  serverTag?: string;          // pod nazwą serwera
  categories: Category[];
  members: MembersByRole;
  dms: DM[];
  messages: MessageItem[];     // active channel/dm messages
  cmdkItems: CmdkItem[];
  typing?: string | null;
  voiceActive?: string | null;
  pinnedCount?: number;

  // Voice / mic state
  micOn: boolean;
  deafened: boolean;

  // Active channel object (resolve from activeChannelId)
  activeChannel: Channel;

  // Active DM data (for DMProfile)
  activeDM?: DM | null;
  activeDMSharedServers?: ServerSummary[];
  activeDMMutualFriends?: { id: string; name: string; avatar?: string; status: DM["status"] }[];
  activeDMCallHistory?: { date: string; duration: string; kind: "voice" | "video" }[];

  // Handlers — wire these to your existing logic
  onViewChange: (view: "server" | "dm") => void;
  onSelectServer: (id: string) => void;
  onSelectChannel: (id: string) => void;
  onSelectDM: (id: string) => void;
  onCloseTab: (id: string) => void;
  onSendMessage: (text: string) => void;
  onReact: (messageId: string, reactionIdx: number) => void;
  onAddReaction: (messageId: string) => void;
  onToggleMic: () => void;
  onToggleDeaf: () => void;
  onOpenSettings?: () => void;
  onCreateServer?: () => void;
  onExploreServers?: () => void;
  onCmdAction: (item: CmdkItem) => void;
}

export const CordynShell: React.FC<CordynShellProps> = (p) => {
  const {
    layout = "classic",
    atmosphere = "aurora",
    density = "comfortable",
    theme = "dark",
    focus = false,
    membersOpen = true,
    onChangeShell,
    user,
    view,
    activeServerId,
    activeChannelId,
    activeDmId,
    openTabs,
    servers,
    serverTag,
    categories,
    members,
    dms,
    messages,
    cmdkItems,
    typing,
    voiceActive,
    pinnedCount,
    micOn,
    deafened,
    activeChannel,
    activeDM,
    activeDMSharedServers,
    activeDMMutualFriends,
    activeDMCallHistory,
    onViewChange,
    onSelectServer,
    onSelectChannel,
    onSelectDM,
    onCloseTab,
    onSendMessage,
    onReact,
    onAddReaction,
    onToggleMic,
    onToggleDeaf,
    onOpenSettings,
    onCreateServer,
    onExploreServers,
    onCmdAction,
  } = p;

  const [cmdkOpen, setCmdkOpen] = React.useState(false);
  const [serversPopupOpen, setServersPopupOpen] = React.useState(false);

  // ⌘K / Ctrl+K
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
      if (e.key === "Escape" && cmdkOpen) setCmdkOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdkOpen]);

  const server = servers.find((s) => s.id === activeServerId) ?? (servers.length > 0 ? servers[0] : undefined);
  const currentDm = activeDM || (activeDmId ? dms.find((d) => d.id === activeDmId) : null);

  return (
    <div
      className="cordyn-root app"
      data-layout={layout}
      data-atmosphere={atmosphere}
      data-density={density}
      data-theme={theme}
      data-focus={focus ? "true" : "false"}
      data-view={view}
      data-dm-profile={view === "dm" && currentDm ? "true" : "false"}
    >
      <div className="atmosphere" />

      <TitleBar />
      <TabsBar
        tabs={openTabs}
        activeTabId={activeChannelId}
        view={view}
        onSelect={onSelectChannel}
        onClose={onCloseTab}
        onViewChange={onViewChange}
      />

      <div className="shell">
        <ServerRail
          servers={servers}
          activeId={activeServerId}
          view={view}
          onSelect={onSelectServer}
          onViewChange={onViewChange}
          onOpenServersList={() => setServersPopupOpen(true)}
          onCreateServer={onCreateServer}
          onExplore={onExploreServers}
        />

        {view === "server" ? (
          server ? (
            <ChannelsPanel
              servers={servers}
              server={server}
              serverTag={serverTag}
              categories={categories}
              activeChannelId={activeChannelId}
              voiceActive={voiceActive}
              layout={layout}
              user={user}
              micOn={micOn}
              deafened={deafened}
              onSelectChannel={onSelectChannel}
              onSelectServer={onSelectServer}
              onOpenCmdK={() => setCmdkOpen(true)}
              onToggleMic={onToggleMic}
              onToggleDeaf={onToggleDeaf}
              onOpenSettings={onOpenSettings}
            />
          ) : null
        ) : (
          <DMSidebar
            dms={dms}
            activeDmId={activeDmId}
            onSelect={onSelectDM}
            user={user}
            micOn={micOn}
            deafened={deafened}
            onToggleMic={onToggleMic}
            onToggleDeaf={onToggleDeaf}
            onOpenSettings={onOpenSettings}
          />
        )}

        {view === "server" ? (
          <ChatPanel
            channel={activeChannel}
            messages={messages}
            membersOpen={membersOpen}
            focus={focus}
            typing={typing}
            pinnedCount={pinnedCount}
            onSend={onSendMessage}
            onReact={onReact}
            onAddReaction={onAddReaction}
            onToggleMembers={() => onChangeShell?.({ membersOpen: !membersOpen })}
            onToggleFocus={() => onChangeShell?.({ focus: !focus })}
          />
        ) : currentDm ? (
          <DMChat
            dm={currentDm}
            messages={messages}
            onSend={onSendMessage}
            onReact={onReact}
            onAddReaction={onAddReaction}
          />
        ) : (
          <DMEmpty dms={dms} onSelect={onSelectDM} />
        )}

        {view === "server" && membersOpen && (
          <MembersPanel data={members} />
        )}
        {view === "dm" && currentDm && (
          <DMProfile
            dm={currentDm}
            sharedServers={activeDMSharedServers}
            mutualFriends={activeDMMutualFriends}
            callHistory={activeDMCallHistory}
          />
        )}
      </div>

      <CmdK
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        items={cmdkItems}
        onAction={(item) => {
          setCmdkOpen(false);
          onCmdAction(item);
        }}
      />

      <ServersPopup
        open={serversPopupOpen}
        onClose={() => setServersPopupOpen(false)}
        servers={servers}
        activeId={activeServerId}
        onSelect={onSelectServer}
        onCreateServer={onCreateServer}
        onExplore={onExploreServers}
      />
    </div>
  );
};
