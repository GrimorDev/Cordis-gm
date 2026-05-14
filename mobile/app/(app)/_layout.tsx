import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../src/store';
import { getSocket, connectSocket } from '../../src/socket';
import { registerForPushNotifications } from '../../src/notifications';
import { C } from '../../src/theme';
import { useT, getT } from '../../src/i18n';
import * as Notifications from 'expo-notifications';

function TabItem({ tab, focused, badge, onPress }: {
  tab: typeof TAB_DEFS[0];
  focused: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const anim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      damping: 16,
      stiffness: 260,
    }).start();
  }, [focused]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 70, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 300 }),
    ]).start();
    onPress();
  };

  const pillOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const pillScale  = anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const iconY      = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });
  const iconColor  = focused ? '#fff' : 'rgba(160,160,190,0.75)';

  return (
    <TouchableOpacity style={styles.tabItem} onPress={handlePress} activeOpacity={1}>
      {/* Pill background */}
      <Animated.View style={[
        styles.tabPillBg,
        { opacity: pillOpacity, transform: [{ scale: pillScale }] },
      ]} />

      <Animated.View style={[
        styles.tabIconWrap,
        { transform: [{ scale: scaleAnim }, { translateY: iconY }] },
      ]}>
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

      <Text style={[styles.tabLabel, { color: focused ? C.accentLight : 'rgba(150,150,180,0.7)' }]}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  );
}

function TabBar({ state, navigation }: any) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { dmConversations } = useStore();
  const totalUnread = dmConversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  const TAB_DEFS = [
    { name: 'index',   icon: 'server',        label: t.servers      },
    { name: 'dms',     icon: 'chatbubbles',   label: t.dmsTitle     },
    { name: 'friends', icon: 'people',        label: t.friendsTitle },
    { name: 'profile', icon: 'person-circle', label: t.tabProfile   },
  ];

  return (
    <View style={[
      styles.tabBar,
      {
        paddingBottom: insets.bottom > 0 ? insets.bottom + 2 : 10,
        height: 68 + (insets.bottom > 0 ? insets.bottom + 2 : 10),
      },
    ]}>
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
  const t = useT();
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
      const gt = getT();
      Notifications.scheduleNotificationAsync({
        content: {
          title: type === 'video' ? `📹 ${gt.videoCallLabel}` : `📞 ${gt.voiceCallLabel}`,
          body: `${from?.username ?? '?'} ${gt.callingYou}`,
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
      <Tabs.Screen name="index"                   options={{ title: t.servers       }} />
      <Tabs.Screen name="channel/[id]"            options={{ href: null             }} />
      <Tabs.Screen name="dms"                     options={{ title: t.dmsTitle      }} />
      <Tabs.Screen name="dm/[userId]"             options={{ href: null             }} />
      <Tabs.Screen name="friends"                 options={{ title: t.friendsTitle  }} />
      <Tabs.Screen name="profile"                 options={{ title: t.tabProfile    }} />
      <Tabs.Screen name="user-profile/[userId]"   options={{ href: null           }} />
      <Tabs.Screen name="server-settings/[serverId]" options={{ href: null        }} />
      <Tabs.Screen name="member-list/[serverId]"  options={{ href: null           }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0e0e18',
    paddingTop: 6,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(99,102,241,0.3)',
    elevation: 50,
    shadowColor: '#000',
    shadowOpacity: 0.8,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -8 },
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  tabPillBg: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 6,
    right: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(99,102,241,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.45)',
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
    borderColor: C.bgFloating,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
