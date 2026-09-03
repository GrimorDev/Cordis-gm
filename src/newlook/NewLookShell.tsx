import React from 'react';
import './newlook.css';
import type { NewLookShellProps } from './types';
import { ServerRail } from './ServerRail';
import { ChannelList } from './ChannelList';
import { ChatColumn } from './ChatColumn';
import { InfoPanel } from './InfoPanel';

/** Opt-in alternate desktop shell ("Nowy wygląd" in Settings). Composes the
 *  4 reference-image zones — server rail, channel/DM list, chat, info panel
 *  — from real app state passed down as props; no local data-fetching or
 *  socket wiring of its own (App.tsx already owns all of that). */
export function NewLookShell(props: NewLookShellProps) {
  return (
    <div className="nl-root">
      <ServerRail {...props} />
      <ChannelList {...props} />
      <ChatColumn {...props} />
      <InfoPanel {...props} />
    </div>
  );
}
