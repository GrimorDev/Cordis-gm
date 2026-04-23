import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../src/store';
import { getSocket, connectSocket } from '../../src/socket';
import { registerForPushNotifications } from '../../src/notifications';
import { C } from '../../src/theme';
import * as Notifications from 'expo-notifications';

const TAB_DEFS = [
  { name: 'index',   icon: 'server',        label: 'Serwery'    },
  { name: 'dms',     icon: 'chatbubbles',   label: 'Wiadomości' },
  { name: 'friends', icon: 'people',        label: 'Znajomi'    },
  { name: 'profile', icon: 'person-circle', label: 'Profil'     },
];

function TabItem({ tab, focused, badge, onPress }: {
  tab: typeof TAB_DEFS[0];
  focused: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      damping: 14,
      stiffness: 200,
    }).start();
  }, [focused]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] });
  const iconColor = focused ? C.accentLight : C.textMuted;

  return (
    <TouchableOpacity style={styles.tabItem} onPress={onPress} activeOpacity={0.75}>
      {focused && <View style={styles.tabPillBg} />}

      <Animated.View style={[styles.tabIconWrap, { transform: [{ scale }] }]}>
        <Ionicons
          name={(focused ? tab.icon : `${tab.icon}-outline`) as any}
          size={22}
          color={iconColor}
        />
        {(badge ?? 0) > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge! > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </Animated.View>

      <Text style={[styles.tabLabel, { color: iconColor, opacity: focused ? 1 : 0.55 }]}>
        {tab.label}
      </Text>

      {focused && <View style={styles.activeDot} />}
    </TouchableOpacity>
  );
}

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { dmConversations } = useStore();
  const totalUnread = dmConversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom, height: 58 + insets.bottom }]}>
      {TAB_DEFS.map((tab) => {
        const route = state.routes.find((r: any) => r.name === tab.name);
        if (!route) return null;
        const routeIndex = state.routes.indexOf(route);
        const focused = state.index === routeIndex;

        return (
          <TabItem
            key={tab.name}
            tab={tab}
            focused={focused}
            badge={tab.name === 'dms' ? totalUnread : undefined}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

export default function AppLayout() {
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
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"                   options={{ title: 'Serwery'     }} />
      <Tabs.Screen name="channel/[id]"            options={{ href: null           }} />
      <Tabs.Screen name="dms"                     options={{ title: 'Wiadomości'  }} />
      <Tabs.Screen name="dm/[userId]"             options={{ href: null           }} />
      <Tabs.Screen name="friends"                 options={{ title: 'Znajomi'     }} />
      <Tabs.Screen name="profile"                 options={{ title: 'Profil'      }} />
      <Tabs.Screen name="user-profile/[userId]"   options={{ href: null           }} />
      <Tabs.Screen name="server-settings/[serverId]" options={{ href: null        }} />
      <Tabs.Screen name="member-list/[serverId]"  options={{ href: null           }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: C.bgCard,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
    elevation: 30,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
    paddingVertical: 4,
  },
  tabPillBg: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 6,
    right: 6,
    borderRadius: 14,
    backgroundColor: C.accentMuted,
  },
  tabIconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    backgroundColor: C.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: C.bgCard,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  activeDot: {
    position: 'absolute',
    bottom: 1,
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
});
