import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { serversApi, type ServerMember } from '../../../src/api';
import { useStore } from '../../../src/store';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { C, STATUS_COLOR } from '../../../src/theme';
import { useT, getT } from '../../../src/i18n';

type Section = { title: string; data: ServerMember[] };

export default function MemberListScreen() {
  const t = useT();
  const { serverId, serverName } = useLocalSearchParams<{ serverId: string; serverName?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeServer } = useStore();

  const [members, setMembers] = useState<ServerMember[]>([]);
  const [loading, setLoading] = useState(true);

  const displayName = serverName ?? activeServer?.name ?? t.serverFallback;

  useEffect(() => {
    if (!serverId) return;
    serversApi
      .members(serverId)
      .then(setMembers)
      .catch(() => { const gt = getT(); Alert.alert(gt.error, gt.errLoadMembers); })
      .finally(() => setLoading(false));
  }, [serverId]);

  const online = members.filter((m) => m.status !== 'offline');
  const offline = members.filter((m) => m.status === 'offline');
  const sections: Section[] = [];
  if (online.length > 0) sections.push({ title: t.onlineCount(online.length), data: online });
  if (offline.length > 0) sections.push({ title: t.offlineCount(offline.length), data: offline });

  type ListItem =
    | { type: 'header'; title: string }
    | { type: 'member'; member: ServerMember };

  const listData: ListItem[] = sections.flatMap((sec) => [
    { type: 'header' as const, title: sec.title },
    ...sec.data.map((m) => ({ type: 'member' as const, member: m })),
  ]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return <Text style={styles.sectionHeader}>{item.title}</Text>;
    }
    const { member } = item;
    return (
      <TouchableOpacity
        style={styles.memberRow}
        onPress={() =>
          router.push({
            pathname: '/(app)/user-profile/[userId]',
            params: { userId: member.id, username: member.username },
          })
        }
      >
        <UserAvatar
          url={member.avatar_url}
          username={member.username}
          size={40}
          status={member.status}
          showStatus
        />
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, member.status === 'offline' && styles.memberNameOffline]}>
            {member.username}
          </Text>
          {!!member.role_name && (
            <View
              style={[
                styles.roleBadge,
                member.role_color ? { backgroundColor: member.role_color + '33' } : {},
              ]}
            >
              <Text
                style={[
                  styles.roleText,
                  member.role_color ? { color: member.role_color } : {},
                ]}
              >
                {member.role_name}
              </Text>
            </View>
          )}
        </View>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: STATUS_COLOR[member.status] ?? C.offline },
          ]}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t.membersTitle}</Text>
          <Text style={styles.headerSub}>{displayName}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{members.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={C.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, idx) =>
            item.type === 'header' ? `header-${idx}` : item.member.id
          }
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: C.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    color: C.textSub,
    fontSize: 13,
    marginTop: 1,
  },
  countBadge: {
    width: 40,
    alignItems: 'flex-end',
  },
  countText: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  list: {
    paddingVertical: 8,
  },
  sectionHeader: {
    color: C.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  memberInfo: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    color: C.text,
    fontSize: 15,
    fontWeight: '600',
  },
  memberNameOffline: {
    color: C.textSub,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.accent + '22',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
