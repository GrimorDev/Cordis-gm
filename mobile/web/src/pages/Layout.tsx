import React, { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { getSocket } from '../socket';
import type { Message, DmMessage } from '../api';

const C = {
  bg: '#09090b',
  bgCard: '#18181b',
  border: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textSub: '#a1a1aa',
  accent: '#6366f1',
};

const tabs = [
  { path: '/servers', label: 'Serwery', icon: ServerIcon },
  { path: '/dms',     label: 'DM',      icon: ChatIcon },
  { path: '/friends', label: 'Znajomi', icon: UsersIcon },
  { path: '/profile', label: 'Profil',  icon: UserIcon },
];

function ServerIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? C.accent : C.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { addMessage, addDmMessage, setUserStatus, currentUser } = useStore();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (msg: Message) => {
      addMessage(msg.channel_id, msg);
    };

    const onMessageUpdated = (msg: Message) => {
      const { updateMessage } = useStore.getState();
      updateMessage(msg.channel_id, msg);
    };

    const onMessageDeleted = ({ id, channel_id }: { id: string; channel_id: string }) => {
      const { removeMessage } = useStore.getState();
      removeMessage(channel_id, id);
    };

    const onNewDm = (msg: DmMessage) => {
      const myId = currentUser?.id;
      const otherUserId = msg.sender_id === myId
        ? msg.conversation_id
        : msg.sender_id;
      addDmMessage(otherUserId, msg);
    };

    const onUserStatus = ({ user_id, status }: { user_id: string; status: string }) => {
      setUserStatus(user_id, status);
    };

    socket.on('new_message', onNewMessage);
    socket.on('message_updated', onMessageUpdated);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('new_dm', onNewDm);
    socket.on('user_status', onUserStatus);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_updated', onMessageUpdated);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('new_dm', onNewDm);
      socket.off('user_status', onUserStatus);
    };
  }, [currentUser]);

  const isChannelOrDM =
    location.pathname.startsWith('/channel/') ||
    location.pathname.startsWith('/dm/');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>

      {!isChannelOrDM && (
        <nav
          style={{
            display: 'flex',
            background: C.bgCard,
            borderTop: `1px solid ${C.border}`,
            height: 60,
            paddingBottom: 'env(safe-area-inset-bottom)',
            flexShrink: 0,
          }}
        >
          {tabs.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + '/');
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: active ? C.accent : C.textSub,
                  fontSize: 10,
                  fontWeight: active ? 600 : 400,
                  padding: '6px 0',
                }}
              >
                <Icon active={active} />
                {label}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
