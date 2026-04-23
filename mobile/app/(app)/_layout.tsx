import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../src/store';
import { getSocket, connectSocket } from '../../src/socket';
import { registerForPushNotifications } from '../../src/notifications';
import { C } from '../../src/theme';
import * as Notifications from 'expo-notifications';

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={(focused ? name : `${name}-outline`) as any} size={24} color={color} />
      {focused && (
        <View style={{
          position: 'absolute', bottom: -6,
          width: 4, height: 4, borderRadius: 2,
          backgroundColor: color,
        }} />
      )}
    </View>
  );
}

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const {
    isAuthenticated, addMessage, addDmMessage, setUserStatus, currentUser,
    updateMessage, removeMessage, updateDmMessage, removeDmMessage,
    addVoiceUser, removeVoiceUser,
  } = useStore();

  useEffect(() => {
    if (!currentUser) return;

    const onNewMessage = (msg: any) => { addMessage(msg.channel_id, msg); };
    const onNewDm = (msg: any) => {
      const otherId = msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;
      addDmMessage(otherId, msg);
    };
    const onUserStatus = ({ user_id, status }: any) => { setUserStatus(user_id, status); };
    const onMessageUpdated = (msg: any) => { updateMessage(msg.channel_id, msg); };
    const onMessageDeleted = ({ id, channel_id }: any) => { removeMessage(channel_id, id); };
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
    const onVoiceUserJoined = ({ channel_id, user }: any) => { addVoiceUser(channel_id, user); };
    const onVoiceUserLeft = ({ channel_id, user_id }: any) => { removeVoiceUser(channel_id, user_id); };
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
      attach(existing);
      return detach;
    }

    let cancelled = false;
    connectSocket()
      .then(sock => { if (!cancelled) attach(sock); })
      .catch(() => {});

    return () => {
      cancelled = true;
      detach();
    };
  }, [currentUser?.id]);

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
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          elevation: 20,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Serwery',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="server" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="channel/[id]" options={{ href: null }} />
      <Tabs.Screen
        name="dms"
        options={{
          title: 'Wiadomości',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubbles" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="dm/[userId]" options={{ href: null }} />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Znajomi',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="people" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-circle" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="user-profile/[userId]" options={{ href: null }} />
      <Tabs.Screen name="server-settings/[serverId]" options={{ href: null }} />
      <Tabs.Screen name="member-list/[serverId]" options={{ href: null }} />
    </Tabs>
  );
}
