import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal, Switch,
  Image, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  serversApi, channelsApi,
  type Server, type ServerMember, type ServerBan, type ChannelFull,
} from '../../../src/api';
import { useStore } from '../../../src/store';
import { UserAvatar } from '../../../src/components/UserAvatar';
import { C } from '../../../src/theme';
import { STATIC_BASE } from '../../../src/config';

function resolveUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : `${STATIC_BASE}${url}`;
}

type Tab = 'basic' | 'channels' | 'members' | 'bans';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'basic',    label: 'Ogólne',    icon: 'settings-outline' },
  { key: 'channels', label: 'Kanały',    icon: 'chatbox-outline'  },
  { key: 'members',  label: 'Członkowie',icon: 'people-outline'   },
  { key: 'bans',     label: 'Bany',      icon: 'ban-outline'      },
];

const ACCENT_COLORS = [
  '#f59e0b','#8b5cf6','#ec4899','#3b82f6','#10b981',
  '#14b8a6','#06b6d4','#f97316','#ef4444','#6366f1',
];

const SLOWMODE_OPTIONS = [
  { label: 'Wyłączony', value: 0 },
  { label: '5 sekund',  value: 5 },
  { label: '10 sekund', value: 10 },
  { label: '30 sekund', value: 30 },
  { label: '1 minuta',  value: 60 },
  { label: '5 minut',   value: 300 },
  { label: '30 minut',  value: 1800 },
  { label: '1 godzina', value: 3600 },
  { label: '6 godzin',  value: 21600 },
];

const BITRATE_OPTIONS = [8, 16, 24, 32, 48, 64, 72, 96];

// ── Channel editor modal ──────────────────────────────────────────────────────
function ChannelEditorModal({
  channel,
  onClose,
  onSave,
}: {
  channel: ChannelFull | null;
  onClose: () => void;
  onSave: (ch: ChannelFull) => void;
}) {
  const isVoice = channel?.type === 'voice';

  const [name, setName] = useState(channel?.name ?? '');
  const [description, setDescription] = useState(channel?.description ?? '');
  const [isPrivate, setIsPrivate] = useState(channel?.is_private ?? false);
  const [slowmode, setSlowmode] = useState(channel?.slowmode_seconds ?? 0);
  const [userLimit, setUserLimit] = useState(String(channel?.user_limit ?? 0));
  const [bitrate, setBitrate] = useState(channel?.bitrate ?? 64);
  const [gradient, setGradient] = useState(channel?.background_gradient ?? '');
  const [saving, setSaving] = useState(false);
  const [showSlowmode, setShowSlowmode] = useState(false);

  useEffect(() => {
    if (channel) {
      setName(channel.name ?? '');
      setDescription(channel.description ?? '');
      setIsPrivate(channel.is_private ?? false);
      setSlowmode(channel.slowmode_seconds ?? 0);
      setUserLimit(String(channel.user_limit ?? 0));
      setBitrate(channel.bitrate ?? 64);
      setGradient(channel.background_gradient ?? '');
    }
  }, [channel?.id]);

  const handleSave = async () => {
    if (!channel || !name.trim()) return;
    setSaving(true);
    try {
      const limit = parseInt(userLimit) || 0;
      const updated = await channelsApi.update(channel.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        is_private: isPrivate,
        ...(!isVoice ? { slowmode_seconds: slowmode } : {}),
        ...(isVoice ? { user_limit: Math.max(0, Math.min(99, limit)), bitrate } : {}),
        ...(!isVoice && gradient.trim() ? { background_gradient: gradient.trim() } : {}),
      });
      onSave({ ...channel, ...updated, name: name.trim(), description: description.trim() || null,
        is_private: isPrivate, slowmode_seconds: slowmode, user_limit: limit, bitrate,
        background_gradient: gradient.trim() || null });
      onClose();
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się zapisać.');
    } finally { setSaving(false); }
  };

  if (!channel) return null;

  const slowmodeLabel = SLOWMODE_OPTIONS.find(o => o.value === slowmode)?.label ?? 'Wyłączony';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={ed.overlay}>
        <View style={ed.container}>
          {/* Header */}
          <View style={ed.header}>
            <TouchableOpacity onPress={onClose} style={ed.closeBtn}>
              <Ionicons name="close" size={22} color={C.textMuted} />
            </TouchableOpacity>
            <Text style={ed.title}>
              {isVoice ? '🎙 Kanał głosowy' : '# Kanał tekstowy'}
            </Text>
            <TouchableOpacity
              style={[ed.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!name.trim() || saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={ed.saveBtnText}>Zapisz</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={ed.scroll} contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 48 }}>
            {/* Name */}
            <View>
              <Text style={ed.label}>NAZWA</Text>
              <TextInput
                style={ed.input}
                value={name}
                onChangeText={setName}
                placeholder="Nazwa kanału…"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                maxLength={100}
              />
            </View>

            {/* Description */}
            <View>
              <Text style={ed.label}>OPIS (OPCJONALNIE)</Text>
              <TextInput
                style={[ed.input, ed.inputMulti]}
                value={description}
                onChangeText={setDescription}
                placeholder="Opis kanału…"
                placeholderTextColor={C.textMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />
            </View>

            {/* Private toggle */}
            <View style={ed.row}>
              <View style={ed.rowLeft}>
                <Ionicons name="lock-closed-outline" size={18} color={C.textSub} />
                <View>
                  <Text style={ed.rowTitle}>Prywatny</Text>
                  <Text style={ed.rowSub}>Dostępny dla wybranych ról</Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: C.border, true: C.accent + '99' }}
                thumbColor={isPrivate ? C.accent : C.textMuted}
              />
            </View>

            {/* TEXT-ONLY: Slowmode */}
            {!isVoice && (
              <View>
                <Text style={ed.label}>TRYB WOLNY</Text>
                <TouchableOpacity style={ed.picker} onPress={() => setShowSlowmode(true)}>
                  <Ionicons name="timer-outline" size={16} color={C.textMuted} />
                  <Text style={ed.pickerText}>{slowmodeLabel}</Text>
                  <Ionicons name="chevron-down" size={14} color={C.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {/* TEXT-ONLY: Gradient */}
            {!isVoice && (
              <View>
                <Text style={ed.label}>GRADIENT CSS (OPCJONALNIE)</Text>
                <TextInput
                  style={ed.input}
                  value={gradient}
                  onChangeText={setGradient}
                  placeholder="linear-gradient(to right, #2c5364, #0f2027)"
                  placeholderTextColor={C.textMuted}
                  autoCapitalize="none"
                />
                {gradient.trim() !== '' && (
                  <View style={[ed.gradientPreview, { background: gradient } as any]}>
                    <Text style={ed.gradientPreviewText}>Podgląd gradientu</Text>
                  </View>
                )}
              </View>
            )}

            {/* VOICE-ONLY: User limit */}
            {isVoice && (
              <View>
                <View style={ed.sliderHeader}>
                  <Text style={ed.label}>LIMIT UŻYTKOWNIKÓW</Text>
                  <Text style={ed.sliderValue}>{parseInt(userLimit) === 0 ? '∞' : userLimit}</Text>
                </View>
                <TextInput
                  style={ed.input}
                  value={userLimit}
                  onChangeText={v => setUserLimit(v.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0 = brak limitu"
                  placeholderTextColor={C.textMuted}
                  maxLength={2}
                />
                <Text style={ed.hint}>0 = brak limitu, max 99</Text>
              </View>
            )}

            {/* VOICE-ONLY: Bitrate */}
            {isVoice && (
              <View>
                <View style={ed.sliderHeader}>
                  <Text style={ed.label}>PRĘDKOŚĆ STRUMIENIOWANIA</Text>
                  <Text style={ed.sliderValue}>{bitrate} kbps</Text>
                </View>
                <View style={ed.bitrateGrid}>
                  {BITRATE_OPTIONS.map(b => (
                    <TouchableOpacity
                      key={b}
                      style={[ed.bitrateBtn, bitrate === b && ed.bitrateBtnActive]}
                      onPress={() => setBitrate(b)}
                    >
                      <Text style={[ed.bitrateBtnText, bitrate === b && { color: '#fff' }]}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={ed.hint}>kbps — wyższa wartość = lepsza jakość dźwięku</Text>
              </View>
            )}
          </ScrollView>

          {/* Slowmode picker modal */}
          <Modal visible={showSlowmode} transparent animationType="fade" onRequestClose={() => setShowSlowmode(false)}>
            <TouchableOpacity style={ed.pickerOverlay} activeOpacity={1} onPress={() => setShowSlowmode(false)}>
              <View style={ed.pickerSheet} onStartShouldSetResponder={() => true}>
                <Text style={ed.pickerSheetTitle}>Tryb wolny</Text>
                {SLOWMODE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[ed.pickerOption, slowmode === opt.value && ed.pickerOptionActive]}
                    onPress={() => { setSlowmode(opt.value); setShowSlowmode(false); }}
                  >
                    <Text style={[ed.pickerOptionText, slowmode === opt.value && { color: C.accent }]}>
                      {opt.label}
                    </Text>
                    {slowmode === opt.value && <Ionicons name="checkmark" size={18} color={C.accent} />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ServerSettingsScreen() {
  const { serverId } = useLocalSearchParams<{ serverId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { removeServer, setChannels: setStoreChannels } = useStore();

  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('basic');

  // Basic tab
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accentColor, setAccentColor] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Channels tab
  const [channels, setLocalChannels] = useState<ChannelFull[]>([]);
  const [newChanName, setNewChanName] = useState('');
  const [newChanType, setNewChanType] = useState<'text' | 'voice'>('text');
  const [addingChan, setAddingChan] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChannelFull | null>(null);

  // Members tab
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // Bans tab
  const [bans, setBans] = useState<ServerBan[]>([]);
  const [bansLoading, setBansLoading] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    serversApi.get(serverId)
      .then(s => {
        setServer(s);
        setName(s.name);
        setDescription(s.description ?? '');
        setAccentColor((s as any).accent_color ?? '');
        setIconUrl(s.icon_url);
      })
      .catch(() => Alert.alert('Błąd', 'Nie udało się załadować serwera.'))
      .finally(() => setLoading(false));

    channelsApi.list(serverId).then(setLocalChannels);
  }, [serverId]);

  const loadMembers = useCallback(() => {
    if (!serverId || membersLoading) return;
    setMembersLoading(true);
    serversApi.members(serverId).then(setMembers).catch(() => {}).finally(() => setMembersLoading(false));
  }, [serverId]);

  const loadBans = useCallback(() => {
    if (!serverId || bansLoading) return;
    setBansLoading(true);
    serversApi.getBans(serverId).then(setBans).catch(() => {}).finally(() => setBansLoading(false));
  }, [serverId]);

  useEffect(() => {
    if (activeTab === 'members') loadMembers();
    if (activeTab === 'bans') loadBans();
  }, [activeTab]);

  // ── Icon upload ──────────────────────────────────────────────────────────
  const handleIconUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Brak uprawnień', 'Musisz przyznać dostęp do galerii.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const fd = new FormData();
    fd.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'icon.jpg' } as any);
    setUploadingIcon(true);
    try {
      const { url } = await serversApi.uploadImage(fd, 'servers');
      setIconUrl(url);
      await serversApi.update(serverId!, { icon_url: url });
      setServer(s => s ? { ...s, icon_url: url } : s);
      Alert.alert('Gotowe!', 'Ikona serwera zaktualizowana.');
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Upload nie powiódł się.');
    } finally { setUploadingIcon(false); }
  };

  // ── Save basic settings ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!serverId || !name.trim()) return;
    setSaving(true);
    try {
      const updated = await serversApi.update(serverId, {
        name: name.trim(),
        description: description.trim() || undefined,
        accent_color: accentColor || undefined,
      });
      setServer(updated);
      Alert.alert('Zapisano!', 'Ustawienia serwera zaktualizowane.');
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się zapisać.');
    } finally { setSaving(false); }
  };

  // ── Delete server ────────────────────────────────────────────────────────
  const handleDeleteServer = () => {
    Alert.alert('Usuń serwer', `Usunąć "${server?.name}"? Tej operacji nie można cofnąć.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: async () => {
          try {
            await serversApi.delete(serverId!);
            removeServer(serverId!);
            router.replace('/(app)');
          } catch (e: any) { Alert.alert('Błąd', e.message ?? 'Nie udało się usunąć.'); }
        },
      },
    ]);
  };

  // ── Add channel ──────────────────────────────────────────────────────────
  const handleAddChannel = async () => {
    if (!serverId || !newChanName.trim()) return;
    setAddingChan(true);
    try {
      const ch = await channelsApi.create(serverId, newChanName.trim(), newChanType);
      setLocalChannels(prev => [...prev, ch as ChannelFull]);
      setNewChanName('');
    } catch (e: any) {
      Alert.alert('Błąd', e.message ?? 'Nie udało się utworzyć kanału.');
    } finally { setAddingChan(false); }
  };

  // ── Delete channel ───────────────────────────────────────────────────────
  const handleDeleteChannel = (ch: ChannelFull) => {
    Alert.alert('Usuń kanał', `Usunąć #${ch.name}? Tej operacji nie można cofnąć.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: async () => {
          try {
            await channelsApi.delete(ch.id);
            setLocalChannels(prev => prev.filter(c => c.id !== ch.id));
          } catch (e: any) { Alert.alert('Błąd', e.message ?? 'Nie udało się usunąć kanału.'); }
        },
      },
    ]);
  };

  // ── Member actions ───────────────────────────────────────────────────────
  const handleMemberOptions = (member: ServerMember) => {
    Alert.alert(member.username, 'Co chcesz zrobić?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Wyrzuć', onPress: () => Alert.alert('Wyrzuć', `Wyrzucić ${member.username}?`, [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Wyrzuć', style: 'destructive', onPress: async () => {
            try { await serversApi.kick(serverId!, member.id); setMembers(prev => prev.filter(m => m.id !== member.id)); }
            catch (e: any) { Alert.alert('Błąd', e.message); }
          }},
        ]),
      },
      {
        text: 'Zbanuj', style: 'destructive', onPress: () => Alert.prompt(
          'Powód bana', `Powód dla ${member.username} (opcjonalnie):`,
          async (reason) => {
            try { await serversApi.ban(serverId!, member.id, reason || undefined); setMembers(prev => prev.filter(m => m.id !== member.id)); }
            catch (e: any) { Alert.alert('Błąd', e.message); }
          }, 'plain-text',
        ),
      },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={C.accent} size="large" /></View>;
  }

  const resolvedIcon = resolveUrl(iconUrl);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <UserAvatar url={resolvedIcon} username={server?.name ?? ''} size={28} />
          <Text style={styles.headerTitle} numberOfLines={1}>{server?.name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabBar} contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={14}
              color={activeTab === t.key ? C.accent : C.textMuted}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 48 }}>

        {/* ─── BASIC ─── */}
        {activeTab === 'basic' && (
          <>
            {/* Icon */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>IKONA SERWERA</Text>
              <View style={styles.iconRow}>
                <TouchableOpacity style={styles.iconWrap} onPress={handleIconUpload} activeOpacity={0.8}>
                  {uploadingIcon ? (
                    <View style={[styles.iconPlaceholder, { backgroundColor: C.bgElevated }]}>
                      <ActivityIndicator color={C.accent} />
                    </View>
                  ) : resolvedIcon ? (
                    <Image source={{ uri: resolvedIcon }} style={styles.iconImg} />
                  ) : (
                    <View style={styles.iconPlaceholder}>
                      <Ionicons name="image-outline" size={28} color={C.textMuted} />
                    </View>
                  )}
                  <View style={styles.iconEditBadge}>
                    <Ionicons name="camera" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
                <View style={styles.iconHint}>
                  <Text style={styles.iconHintTitle}>Zmień ikonę serwera</Text>
                  <Text style={styles.iconHintSub}>Dotknij aby przesłać zdjęcie</Text>
                </View>
              </View>
            </View>

            {/* Name & description */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>NAZWA</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nazwa serwera"
                placeholderTextColor={C.textMuted}
                maxLength={100}
              />
              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>OPIS</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Krótki opis serwera…"
                placeholderTextColor={C.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={300}
              />
            </View>

            {/* Accent color */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>KOLOR AKCENTU SERWERA</Text>
              <View style={styles.colorGrid}>
                {ACCENT_COLORS.map(col => (
                  <TouchableOpacity
                    key={col}
                    style={[styles.colorSwatch, { backgroundColor: col }, accentColor === col && styles.colorSwatchActive]}
                    onPress={() => setAccentColor(col)}
                    activeOpacity={0.8}
                  >
                    {accentColor === col && <Ionicons name="checkmark" size={18} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </View>
              {accentColor !== '' && (
                <TouchableOpacity onPress={() => setAccentColor('')} style={styles.clearColorBtn}>
                  <Text style={styles.clearColorText}>Wyczyść kolor</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.btnPrimary, (saving || !name.trim()) && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.btnText}>Zapisz zmiany</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Danger zone */}
            <View style={[styles.card, styles.dangerCard]}>
              <Text style={styles.dangerTitle}>⚠️ Strefa zagrożenia</Text>
              <Text style={styles.dangerSubtext}>Usunięcie serwera jest nieodwracalne. Wszystkie kanały i wiadomości zostaną utracone.</Text>
              <TouchableOpacity style={styles.btnDanger} onPress={handleDeleteServer}>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.btnText}>Usuń serwer</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ─── CHANNELS ─── */}
        {activeTab === 'channels' && (
          <>
            {/* Add channel */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>UTWÓRZ NOWY KANAŁ</Text>
              <TextInput
                style={styles.input}
                value={newChanName}
                onChangeText={setNewChanName}
                placeholder="Nazwa kanału"
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                maxLength={100}
              />
              <View style={styles.typeRow}>
                {(['text', 'voice'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, newChanType === t && styles.typeBtnActive]}
                    onPress={() => setNewChanType(t)}
                  >
                    <Ionicons name={t === 'text' ? 'chatbubble-outline' : 'mic-outline'} size={14}
                      color={newChanType === t ? '#fff' : C.textSub} />
                    <Text style={[styles.typeBtnText, newChanType === t && { color: '#fff' }]}>
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
                {addingChan
                  ? <ActivityIndicator color="#fff" />
                  : <><Ionicons name="add" size={18} color="#fff" /><Text style={styles.btnText}>Utwórz kanał</Text></>
                }
              </TouchableOpacity>
            </View>

            {/* Channel list */}
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>ISTNIEJĄCE KANAŁY ({channels.length})</Text>
              {channels.length === 0 && <Text style={styles.emptyText}>Brak kanałów.</Text>}
              {channels.map(ch => (
                <View key={ch.id} style={styles.chRow}>
                  <View style={[styles.chIcon, { backgroundColor: ch.type === 'voice' ? '#22c55e22' : C.accentMuted }]}>
                    <Ionicons
                      name={ch.type === 'voice' ? 'mic-outline' : ch.type === 'announcement' ? 'megaphone-outline' : 'chatbubble-outline'}
                      size={14}
                      color={ch.type === 'voice' ? '#22c55e' : C.accent}
                    />
                  </View>
                  <View style={styles.chInfo}>
                    <Text style={styles.chName}>{ch.name}</Text>
                    {ch.is_private && (
                      <View style={styles.privateBadge}>
                        <Ionicons name="lock-closed" size={10} color={C.textMuted} />
                        <Text style={styles.privateBadgeText}>Prywatny</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.chEditBtn} onPress={() => setEditingChannel(ch)}>
                    <Ionicons name="pencil-outline" size={16} color={C.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.chDeleteBtn} onPress={() => handleDeleteChannel(ch)}>
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ─── MEMBERS ─── */}
        {activeTab === 'members' && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CZŁONKOWIE ({members.length})</Text>
            {membersLoading ? (
              <ActivityIndicator color={C.accent} style={{ padding: 20 }} />
            ) : members.length === 0 ? (
              <Text style={styles.emptyText}>Brak członków.</Text>
            ) : (
              members.map(m => (
                <TouchableOpacity key={m.id} style={styles.memberRow} onPress={() => handleMemberOptions(m)} activeOpacity={0.7}>
                  <UserAvatar url={m.avatar_url} username={m.username} size={40} status={m.status} showStatus />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.username}</Text>
                    {m.role_name && (
                      <View style={[styles.roleBadge, { backgroundColor: (m.role_color ?? C.accent) + '22' }]}>
                        <Text style={[styles.roleText, { color: m.role_color ?? C.accent }]}>{m.role_name}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="ellipsis-vertical" size={18} color={C.textMuted} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ─── BANS ─── */}
        {activeTab === 'bans' && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ZBANOWANI ({bans.length})</Text>
            {bansLoading ? (
              <ActivityIndicator color={C.accent} style={{ padding: 20 }} />
            ) : bans.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark-outline" size={40} color={C.success} />
                <Text style={styles.emptyText}>Brak zbanowanych użytkowników</Text>
              </View>
            ) : (
              bans.map(ban => (
                <View key={ban.user_id} style={styles.banRow}>
                  <UserAvatar url={ban.avatar_url} username={ban.username} size={40} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{ban.username}</Text>
                    {ban.reason && <Text style={styles.banReason} numberOfLines={1}>{ban.reason}</Text>}
                    <Text style={styles.banDate}>{new Date(ban.banned_at).toLocaleDateString('pl-PL')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.unbanBtn}
                    onPress={async () => {
                      try {
                        await serversApi.unban(serverId!, ban.user_id);
                        setBans(prev => prev.filter(b => b.user_id !== ban.user_id));
                      } catch (e: any) { Alert.alert('Błąd', e.message); }
                    }}
                  >
                    <Text style={styles.unbanText}>Odbanuj</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Channel editor */}
      <ChannelEditorModal
        channel={editingChannel}
        onClose={() => setEditingChannel(null)}
        onSave={updated => {
          setLocalChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
        }}
      />
    </View>
  );
}

// ── Editor styles ─────────────────────────────────────────────────────────────
const ed = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: C.bgCard,
    paddingTop: 52,
  },
  closeBtn: { width: 40, alignItems: 'flex-start' },
  title: { color: C.text, fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
  saveBtn: { backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scroll: { flex: 1 },
  label: { color: C.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 },
  input: {
    backgroundColor: C.bgInput, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  inputMulti: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.bgCard, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowTitle: { color: C.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  picker: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.bgCard, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerText: { flex: 1, color: C.text, fontSize: 15 },
  gradientPreview: {
    height: 40, borderRadius: 10, marginTop: 8,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  gradientPreviewText: { color: '#fff', fontSize: 12, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 4 },
  sliderHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sliderValue: { color: C.accent, fontSize: 14, fontWeight: '700' },
  hint: { color: C.textMuted, fontSize: 12, marginTop: 4 },
  bitrateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  bitrateBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, backgroundColor: C.bgCard,
  },
  bitrateBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  bitrateBtnText: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: C.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 4, borderTopWidth: 1, borderColor: C.border,
  },
  pickerSheetTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 10,
  },
  pickerOptionActive: { backgroundColor: C.accentMuted },
  pickerOptionText: { color: C.textSub, fontSize: 15 },
});

// ── Screen styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  centered: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: { width: 40 },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },

  tabBar: { backgroundColor: C.bgCard, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 12, gap: 4 },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.accent },
  tabText: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: C.accent },

  content: { flex: 1 },
  card: {
    backgroundColor: C.bgCard, borderRadius: 18, borderWidth: 1,
    borderColor: C.border, padding: 16, gap: 10,
  },
  dangerCard: { borderColor: C.danger + '44' },
  sectionLabel: {
    color: C.textMuted, fontSize: 11, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: C.bgInput, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    color: C.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15,
  },
  textarea: { height: 90, textAlignVertical: 'top', paddingTop: 11 },

  // Icon
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconWrap: { position: 'relative' },
  iconImg: { width: 72, height: 72, borderRadius: 18 },
  iconPlaceholder: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: C.bgElevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border, borderStyle: 'dashed',
  },
  iconEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bgCard,
  },
  iconHint: { flex: 1 },
  iconHintTitle: { color: C.text, fontSize: 14, fontWeight: '600' },
  iconHintSub: { color: C.textMuted, fontSize: 12, marginTop: 2 },

  // Color swatch grid
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorSwatch: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  colorSwatchActive: { borderColor: '#fff', transform: [{ scale: 1.1 }] },
  clearColorBtn: { alignSelf: 'flex-start' },
  clearColorText: { color: C.textMuted, fontSize: 13 },

  // Buttons
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14,
    shadowColor: C.accent, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.danger, borderRadius: 14, paddingVertical: 13,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  dangerTitle: { color: C.danger, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  dangerSubtext: { color: C.textMuted, fontSize: 13, lineHeight: 19 },

  // Type selector
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.bgInput,
  },
  typeBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  typeBtnText: { color: C.textSub, fontSize: 13, fontWeight: '600' },

  // Channel rows
  chRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  chIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  chInfo: { flex: 1 },
  chName: { color: C.text, fontSize: 14, fontWeight: '600' },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.bgElevated, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 3,
  },
  privateBadgeText: { color: C.textMuted, fontSize: 10, fontWeight: '600' },
  chEditBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.accentMuted, borderWidth: 1, borderColor: C.borderAccent,
    alignItems: 'center', justifyContent: 'center',
  },
  chDeleteBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.dangerMuted, borderWidth: 1, borderColor: C.danger + '33',
    alignItems: 'center', justifyContent: 'center',
  },

  // Members
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  memberInfo: { flex: 1, gap: 4 },
  memberName: { color: C.text, fontSize: 15, fontWeight: '600' },
  roleBadge: {
    alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  roleText: { fontSize: 11, fontWeight: '700' },

  // Bans
  banRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  banReason: { color: C.textSub, fontSize: 12 },
  banDate: { color: C.textMuted, fontSize: 11 },
  unbanBtn: {
    backgroundColor: C.successMuted, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: C.success + '44',
  },
  unbanText: { color: C.success, fontSize: 13, fontWeight: '700' },

  emptyText: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 10 },
});
