import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  serversApi,
  channelsApi,
  type Server,
  type Channel,
  type ServerMember,
  type ServerBan,
} from '../../../src/api';
import { useStore } from '../../../src/store';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { C } from '../../../src/theme';

type Tab = 'basic' | 'channels' | 'members' | 'bans';

const TABS: { key: Tab; label: string }[] = [
  { key: 'basic', label: 'Podstawowe' },
  { key: 'channels', label: 'Kanały' },
  { key: 'members', label: 'Członkowie' },
  { key: 'bans', label: 'Bany' },
];

const CHANNEL_ICON: Record<string, keyof typeof import('@expo/vector-icons/build/Ionicons').glyphMap> = {
  text: 'chatbubble-outline',
  voice: 'mic-outline',
  forum: 'albums-outline',
  announcement: 'megaphone-outline',
};

export default function ServerSettingsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { removeServer, setChannels, channels: storeChannels } = useStore();

  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('basic');

  // Basic tab state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Channels tab state
  const [channels, setLocalChannels] = useState<Channel[]>([]);
  const [newChanName, setNewChanName] = useState('');
  const [newChanType, setNewChanType] = useState<'text' | 'voice'>('text');
  const [addingChan, setAddingChan] = useState(false);

  // Members tab state
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Bans tab state
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [bansLoading, setBansLoading] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    serversApi
      .get(serverId)
      .then((s) => {
        setServer(s);
        setName(s.name);
        setDescription(s.description ?? '');
      })
      .catch(() => Alert.alert('Błąd', 'Nie udało się załadować serwera.'))
      .finally(() => setLoading(false));

    channelsApi.list(serverId).then((list) => {
      setLocalChannels(list);
    });
  }, [serverId]);

  const loadMembers = useCallback(() => {
    if (!serverId || membersLoading) return;
    setMembersLoading(true);
    serversApi
      .members(serverId)
      .then(setMembers)
      .catch(() => Alert.alert('Błąd', 'Nie udało się załadować członków.'))
      .finally(() => setMembersLoading(false));
  }, [serverId]);

  const loadBans = useCallback(() => {
    if (!serverId || bansLoading) return;
    setBansLoading(true);
    serversApi
      .getBans(serverId)
      .then(setBans)
      .catch(() => Alert.alert('Błąd', 'Nie udało się załadować banów.'))
      .finally(() => setBansLoading(false));
  }, [serverId]);

  useEffect(() => {
    if (activeTab === 'members') loadMembers();
    if (activeTab === 'bans') loadBans();
  }, [activeTab]);

  const handleSave = async () => {
    if (!serverId || !name.trim()) return;
    setSaving(true);
    try {
      const updated = await serversApi.update(serverId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setServer(updated);
      Alert.alert('Zapisano', 'Ustawienia serwera zostały zaktualizowane.');
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się zapisać.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteServer = () => {
    Alert.alert(
      'Usuń serwer',
      `Czy na pewno chcesz usunąć serwer "${server?.name}"? Tej operacji nie można cofnąć.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            try {
              await serversApi.delete(serverId!);
              removeServer(serverId!);
              router.replace('/(app)');
            } catch (e: any) {
              Alert.alert('Błąd', e.message ?? 'Nie udało się usunąć serwera.');
            }
          },
        },
      ],
    );
  };

  const handleAddChannel = async () => {
    if (!serverId || !newChanName.trim()) return;
    setAddingChan(true);
    try {
      const ch = await channelsApi.create(serverId, newChanName.trim(), newChanType);
      setLocalChannels((prev) => [...prev, ch]);
      setNewChanName('');
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się utworzyć kanału.');
    } finally {
      setAddingChan(false);
    }
  };

  const handleDeleteChannel = (ch: Channel) => {
    Alert.alert('Usuń kanał', `Usunąć kanał #${ch.name}?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          try {
            await channelsApi.delete(ch.id);
            setLocalChannels((prev) => prev.filter((c) => c.id !== ch.id));
          } catch (e: any) {
            Alert.alert('Błąd', e.message ?? 'Nie udało się usunąć kanału.');
          }
        },
      },
    ]);
  };

  const handleKick = (member: ServerMember) => {
    Alert.alert('Wyrzuć użytkownika', `Wyrzucić ${member.username}?`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyrzuć',
        style: 'destructive',
        onPress: async () => {
          try {
            await serversApi.kick(serverId!, member.id);
            setMembers((prev) => prev.filter((m) => m.id !== member.id));
            Alert.alert('Gotowe', `${member.username} został wyrzucony.`);
          } catch (e: any) {
            Alert.alert('Błąd', e.message ?? 'Nie udało się wyrzucić użytkownika.');
          }
        },
      },
    ]);
  };

  const handleBan = (member: ServerMember) => {
    Alert.prompt(
      'Zbanuj użytkownika',
      `Podaj powód bana dla ${member.username} (opcjonalnie):`,
      async (reason) => {
        try {
          await serversApi.ban(serverId!, member.id, reason || undefined);
          setMembers((prev) => prev.filter((m) => m.id !== member.id));
          Alert.alert('Gotowe', `${member.username} został zbanowany.`);
        } catch (e: any) {
          Alert.alert('Błąd', e.message ?? 'Nie udało się zbanować użytkownika.');
        }
      },
      'plain-text',
    );
  };

  const handleMemberOptions = (member: ServerMember) => {
    Alert.alert(member.username, 'Co chcesz zrobić?', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Wyrzuć', onPress: () => handleKick(member) },
      { text: 'Zbanuj', style: 'destructive', onPress: () => handleBan(member) },
    ]);
  };

  const handleUnban = async (ban: ServerBan) => {
    try {
      await serversApi.unban(serverId!, ban.user_id);
      setBans((prev) => prev.filter((b) => b.user_id !== ban.user_id));
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się odbanować.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={C.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ustawienia serwera</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tab content */}
      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* ── BASIC ── */}
        {activeTab === 'basic' && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Nazwa serwera</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nazwa serwera"
                placeholderTextColor={C.textMuted}
              />
              <Text style={[styles.label, { marginTop: 12 }]}>Opis</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Opis serwera (opcjonalnie)"
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.btnPrimary, saving && styles.btnDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.btnText}>{saving ? 'Zapisywanie…' : 'Zapisz zmiany'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.card, styles.dangerCard]}>
              <Text style={styles.dangerTitle}>Strefa zagrożenia</Text>
              <TouchableOpacity style={styles.btnDanger} onPress={handleDeleteServer}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.btnText}>Usuń serwer</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── CHANNELS ── */}
        {activeTab === 'channels' && (
          <>
            <View style={styles.card}>
              <Text style={styles.label}>Nowy kanał</Text>
              <TextInput
                style={styles.input}
                value={newChanName}
                onChangeText={setNewChanName}
                placeholder="Nazwa kanału"
                placeholderTextColor={C.textMuted}
              />
              <View style={styles.typeRow}>
                {(['text', 'voice'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, newChanType === t && styles.typeBtnActive]}
                    onPress={() => setNewChanType(t)}
                  >
                    <Ionicons
                      name={t === 'text' ? 'chatbubble-outline' : 'mic-outline'}
                      size={14}
                      color={newChanType === t ? '#fff' : C.textSub}
                    />
                    <Text style={[styles.typeBtnText, newChanType === t && styles.typeBtnTextActive]}>
                      {t === 'text' ? 'Tekstowy' : 'Głosowy'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.btnPrimary, (!newChanName.trim() || addingChan) && styles.btnDisabled]}
                onPress={handleAddChannel}
                disabled={!newChanName.trim() || addingChan}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.btnText}>{addingChan ? 'Tworzenie…' : 'Utwórz kanał'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Istniejące kanały</Text>
              {channels.length === 0 && (
                <Text style={styles.emptyText}>Brak kanałów.</Text>
              )}
              {channels.map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  style={styles.row}
                  onLongPress={() => handleDeleteChannel(ch)}
                >
                  <Ionicons
                    name={CHANNEL_ICON[ch.type] ?? 'chatbubble-outline'}
                    size={18}
                    color={C.textSub}
                  />
                  <Text style={styles.rowText}>{ch.name}</Text>
                  <TouchableOpacity onPress={() => handleDeleteChannel(ch)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── MEMBERS ── */}
        {activeTab === 'members' && (
          <View style={styles.card}>
            {membersLoading ? (
              <ActivityIndicator color={C.accent} />
            ) : members.length === 0 ? (
              <Text style={styles.emptyText}>Brak członków.</Text>
            ) : (
              members.map((m) => (
                <TouchableOpacity key={m.id} style={styles.memberRow} onPress={() => handleMemberOptions(m)}>
                  <UserAvatar url={m.avatar_url} username={m.username} size={36} status={m.status} showStatus />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.username}</Text>
                    {!!m.role_name && (
                      <View style={[styles.roleBadge, m.role_color ? { backgroundColor: m.role_color + '33' } : {}]}>
                        <Text style={[styles.roleText, m.role_color ? { color: m.role_color } : {}]}>
                          {m.role_name}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="ellipsis-vertical" size={18} color={C.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ── BANS ── */}
        {activeTab === 'bans' && (
          <View style={styles.card}>
            {bansLoading ? (
              <ActivityIndicator color={C.accent} />
            ) : bans.length === 0 ? (
              <Text style={styles.emptyText}>Brak zbanowanych użytkowników.</Text>
            ) : (
              bans.map((ban) => (
                <View key={ban.user_id} style={styles.banRow}>
                  <UserAvatar url={ban.avatar_url} username={ban.username} size={36} />
                  <View style={styles.banInfo}>
                    <Text style={styles.memberName}>{ban.username}</Text>
                    {!!ban.reason && <Text style={styles.banReason}>{ban.reason}</Text>}
                    <Text style={styles.banDate}>
                      {new Date(ban.banned_at).toLocaleDateString('pl-PL')}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.unbanBtn} onPress={() => handleUnban(ban)}>
                    <Text style={styles.unbanText}>Odbanuj</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
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
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 40,
  },
  headerTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '700',
  },
  tabBar: {
    backgroundColor: C.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexGrow: 0,
  },
  tabBarContent: {
    paddingHorizontal: 12,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: C.accent,
  },
  tabText: {
    color: C.textSub,
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: C.accent,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    gap: 8,
  },
  dangerCard: {
    borderColor: C.danger + '44',
  },
  dangerTitle: {
    color: C.danger,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  label: {
    color: C.textSub,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: C.bgInput,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 4,
  },
  textarea: {
    height: 96,
    paddingTop: 10,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  btnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.danger,
    borderRadius: 10,
    paddingVertical: 12,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bgInput,
  },
  typeBtnActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  typeBtnText: {
    color: C.textSub,
    fontSize: 13,
    fontWeight: '600',
  },
  typeBtnTextActive: {
    color: '#fff',
  },
  emptyText: {
    color: C.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowText: {
    flex: 1,
    color: C.text,
    fontSize: 15,
  },
  deleteBtn: {
    padding: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
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
  banRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  banInfo: {
    flex: 1,
    gap: 2,
  },
  banReason: {
    color: C.textSub,
    fontSize: 13,
  },
  banDate: {
    color: C.textMuted,
    fontSize: 12,
  },
  unbanBtn: {
    backgroundColor: C.bgElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  unbanText: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
