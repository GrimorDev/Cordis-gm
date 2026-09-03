import React from 'react';
import { Search, MessageSquare, Plus, Settings } from 'lucide-react';
import type { NewLookShellProps } from './types';

type Props = Pick<NewLookShellProps,
  'currentUser' | 'staticUrl' | 'serverList' | 'activeServer' | 'activeView' |
  'onSelectServer' | 'onShowDms' | 'onOpenSettings'
>;

export function ServerRail({
  currentUser, staticUrl, serverList, activeServer, activeView,
  onSelectServer, onShowDms, onOpenSettings,
}: Props) {
  return (
    <div className="nl-rail nl-glass">
      <button className="nl-rail-icon" title="Szukaj">
        <Search size={18} />
      </button>

      <button
        className={`nl-rail-icon${activeView === 'dms' ? ' active' : ''}`}
        title="Wiadomości"
        onClick={onShowDms}
      >
        <span className="nl-rail-pip" />
        <MessageSquare size={18} />
      </button>

      <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />

      <div className="nl-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%' }}>
        {serverList.map(srv => {
          const icon = staticUrl(srv.icon_url);
          const active = activeView === 'servers' && activeServer === srv.id;
          return (
            <button
              key={srv.id}
              className={`nl-rail-icon${active ? ' active' : ''}`}
              title={srv.name}
              onClick={() => onSelectServer(srv.id)}
            >
              <span className="nl-rail-pip" />
              {icon ? (
                <img src={icon} alt="" />
              ) : (
                <span style={{ fontSize: 15, fontWeight: 700 }}>{srv.name.slice(0, 2).toUpperCase()}</span>
              )}
            </button>
          );
        })}
        <button className="nl-rail-icon" title="Dodaj serwer" style={{ color: '#4ade80' }}>
          <Plus size={18} />
        </button>
      </div>

      <button className="nl-rail-icon" title="Ustawienia" onClick={onOpenSettings}>
        {currentUser.avatar_url ? (
          <img src={staticUrl(currentUser.avatar_url) ?? ''} alt="" style={{ borderRadius: 14 }} />
        ) : (
          <Settings size={18} />
        )}
      </button>
    </div>
  );
}
