import React, { useEffect } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../src/store';
import { getSocket, connectSocket } from '../../src/socket';
import { registerForPushNotifications } from '../../src/notifications';
import { C } from '../../src/theme';
import * as Notifications from 'expo-notifications';

export default function AppLayout() {
  const {
    isAuthenticated, addMessage, addDmMessage, setUserStatus, currentUser,
    updateMessage, removeMessage, updateDmMessage, removeDmMessage,
    addVoiceUser, removeVoiceUser,
  } = useStore();

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
    const onMessageUpdated = (msg: any) => {
      updateMessage(msg.channel_id, msg);
    };
    const onMessageDeleted = ({ id, channel_id }: any) => {
      removeMessage(channel_id, id);
    };
    const onDmMessageUpdated = (msg: any) => {
      if (!currentUser) return;
      const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      updateDmMessage(otherId, msg);
    };
    const onDmMessageDeleted = ({ id, sender_id, receiver_id }: any) => {
      if (!currentUser) return;
      const otherId = sender_id === currentUser.id ? receiver_id : sender_id;
      removeDmMessage(otherId, id);
    };
    const onVoiceUserJoined = ({ channel_id, user }: any) => {
      addVoiceUser(channel_id, user);
    };
    const onVoiceUserLeft = ({ channel_id, user_id }: any) => {
      removeVoiceUser(channel_id, user_id);
    };
    const onCallInvite = ({ from, type }: any) => {
      Notifications.scheduleNotificationAsync({
        content: {
          title: type === 'video' ? '📹 Połączenie wideo' : '📞 Połączenie głosowe',
          body: `${from?.username ?? 'Ktoś'} dzwoni do Ciebie`,
          sound: true,
        },
        trigger: null,
      });
    };

    const attach = (sock: ReturnType<typeof getSocket>) => {
      if (!sock) return;
      sock.on('new_message', onNewMessage);
      sock.on('new_dm', onNewDm);
      sock.on('user_status', onUserStatus);
      sock.on('message_updated', onMessageUpdated);
      sock.on('message_deleted', onMessageDeleted);
      sock.on('dm_message_updated', onDmMessageUpdated);
      sock.on('dm_message_deleted', onDmMessageDeleted);
      sock.on('call_invite', onCallInvite);
      sock.on('voice_user_joined', onVoiceUserJoined);
      sock.on('voice_user_left', onVoiceUserLeft);
    };

    const detach = () => {
      const sock = getSocket();
      sock?.off('new_message', onNewMessage);
      sock?.off('new_dm', onNewDm);
      sock?.off('user_status', onUserStatus);
      sock?.off('message_updated', onMessageUpdated);
      sock?.off('message_deleted', onMessageDeleted);
      sock?.off('dm_message_updated', onDmMessageUpdated);
      sock?.off('dm_message_deleted', onDmMessageDeleted);
      sock?.off('call_invite', onCallInvite);
      sock?.off('voice_user_joined', onVoiceUserJoined);
      sock?.off('voice_user_left', onVoiceUserLeft);
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
      <Tabs.Screen name="user-profile/[userId]" options={{ href: null }} />
      <Tabs.Screen name="server-settings/[serverId]" options={{ href: null }} />
      <Tabs.Screen name="member-list/[serverId]" options={{ href: null }} />
    </Tabs>
  );
}
