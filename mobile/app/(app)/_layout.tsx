import React, { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../src/store';
import { getSocket, connectSocket } from '../../src/socket';
import { registerForPushNotifications } from '../../src/notifications';
import { C } from '../../src/theme';

export default function AppLayout() {
  const { isAuthenticated, addMessage, addDmMessage, setUserStatus, currentUser } = useStore();

  // Socket event listeners — attach after socket connects (handles cold start & reconnect)
  useEffect(() => {
    if (!currentUser) return;

    const onNewMessage = (msg: any) => {
      addMessage(msg.channel_id, msg);
    };
    const onNewDm = (msg: any) => {
      // otherId = the person we're talking to (not us)
      const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      addDmMessage(otherId, msg);
    };
    const onUserStatus = ({ user_id, status }: any) => {
      setUserStatus(user_id, status);
    };

    const attach = (sock: ReturnType<typeof getSocket>) => {
      if (!sock) return;
      sock.on('new_message', onNewMessage);
      sock.on('new_dm', onNewDm);
      sock.on('user_status', onUserStatus);
    };

    const detach = () => {
      const sock = getSocket();
      sock?.off('new_message', onNewMessage);
      sock?.off('new_dm', onNewDm);
      sock?.off('user_status', onUserStatus);
    };

    const existing = getSocket();
    if (existing) {
      // Socket already exists (normal case after login / token restore)
      attach(existing);
      return detach;
    }

    // Socket not yet initialized — connect first, then attach
    let cancelled = false;
    connectSocket()
      .then(sock => { if (!cancelled) attach(sock); })
      .catch(() => {});

    return () => {
      cancelled = true;
      detach();
    };
  }, [currentUser?.id]);

  // Register push token once when user is authenticated
  useEffect(() => {
    if (!currentUser) return;
    registerForPushNotifications().catch(() => {});
  }, [currentUser?.id]);

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bgCard,
          borderTopColor: C.border,
          borderTopWidth: 1,
          height: 60,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Serwery',
          tabBarIcon: ({ color, size }) => <Ionicons name="server-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="channel/[id]"
        options={{ href: null }} // hidden tab
      />
      <Tabs.Screen
        name="dms"
        options={{
          title: 'Wiadomości',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dm/[userId]"
        options={{ href: null }} // hidden tab
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Znajomi',
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
