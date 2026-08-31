import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEMES, type ThemeId } from '../../theme/themes';
import { useTheme, useSetTheme } from '../../theme/useTheme';
import { useGatewayStore, type GatewayProfile } from '../../store/gatewayStore';
import { fetchAgentCard } from '../../ai/A2AClient';
import { type STTLanguage } from '../../store/sttStore';

const THEME_IDS: ThemeId[] = ['cosmic', 'matrix', 'ghost', 'inferno'];

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

type EditingProfile = Omit<GatewayProfile, 'id'> & { id?: string };

const EMPTY_PROFILE: EditingProfile = { name: '', baseUrl: '', appSlug: '', epSlug: '', voiceAppSlug: '', voiceSlug: '', token: '', sttLanguage: 'auto' };

export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const setTheme = useSetTheme();
  const { profiles, activeId, addProfile, updateProfile, deleteProfile, setActive } = useGatewayStore();

  const [editing, setEditing] = useState<EditingProfile | null>(null);

  const translateY = useSharedValue(500);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 180 });
      backdropOpacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withSpring(500, { damping: 22, stiffness: 180 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
      setEditing(null);
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  function startAdd() {
    setEditing({ ...EMPTY_PROFILE });
  }

  function startEdit(p: GatewayProfile) {
    setEditing({ ...p });
  }

  async function saveEditing() {
    if (!editing) return;
    const { name, baseUrl, appSlug, epSlug, voiceAppSlug, voiceSlug, token, sttLanguage } = editing;
    if (!name.trim() || !baseUrl.trim() || !appSlug.trim() || !epSlug.trim()) {
      Alert.alert('Missing fields', 'Name, URL, App Slug and EP Slug are required.');
      return;
    }
    const base = { name, baseUrl, appSlug, epSlug, voiceAppSlug: voiceAppSlug || appSlug, voiceSlug: voiceSlug || epSlug, token, sttLanguage: sttLanguage ?? 'auto' as const };
    if (editing.id) {
      await updateProfile(editing.id, base);
    } else {
      await addProfile(base);
    }
    setEditing(null);
    // Fetch agent card in background — no await, failure is silent
    fetchAgentCard(baseUrl, appSlug, epSlug, token).then((card) => {
      if (!card) return;
      // Find the profile we just saved by slug match
      const { profiles, updateProfile: up } = useGatewayStore.getState();
      const saved = profiles.find((p) => p.baseUrl === baseUrl && p.appSlug === appSlug && p.epSlug === epSlug);
      if (saved) up(saved.id, { agentCard: card, agentCardFetchedAt: Date.now() });
    });
  }

  function confirmDelete(p: GatewayProfile) {
    Alert.alert('Delete profile', `Remove "${p.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteProfile(p.id) },
    ]);
  }

  async function testProfile(p: GatewayProfile) {
    const url = `${p.baseUrl}/a2a/${p.appSlug}/${p.epSlug}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'agent/authenticatedExtendedCard', params: {} }),
      });
      if (res.ok || res.status === 401) {
        Alert.alert('Connection OK', `Reached ${url}\nStatus: ${res.status}`);
      } else {
        Alert.alert('Unexpected status', `${url}\nHTTP ${res.status}`);
      }
    } catch (e: any) {
      Alert.alert('Connection failed', `Cannot reach ${url}\n${e?.message ?? e}`);
    }
  }

  const inputStyle = [styles.input, { color: theme.textPrimary, borderColor: theme.cardBorder, backgroundColor: theme.cardBackground }];
  const labelStyle = [styles.inputLabel, { color: theme.textSecondary }];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 24, backgroundColor: theme.navBackground, borderColor: theme.navBorder },
          sheetStyle,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.textTertiary }]} />

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.textPrimary }]}>Settings</Text>

          {/* ── Gateway Profiles ── */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Gateway</Text>

          {editing ? (
            <View style={[styles.editCard, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}>
              <Text style={[styles.editTitle, { color: theme.textPrimary }]}>
                {editing.id ? 'Edit Profile' : 'New Profile'}
              </Text>

              <Text style={labelStyle}>Name</Text>
              <TextInput
                style={inputStyle}
                value={editing.name}
                onChangeText={(v) => setEditing((e) => e && { ...e, name: v })}
                placeholder="e.g. Work Gateway"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
              />

              <Text style={labelStyle}>Base URL</Text>
              <TextInput
                style={inputStyle}
                value={editing.baseUrl}
                onChangeText={(v) => setEditing((e) => e && { ...e, baseUrl: v })}
                placeholder="http://10.0.0.1:8088"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                keyboardType="url"
              />

              <Text style={labelStyle}>App Slug</Text>
              <TextInput
                style={inputStyle}
                value={editing.appSlug}
                onChangeText={(v) => setEditing((e) => e && { ...e, appSlug: v })}
                placeholder="freddy"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
              />

              <Text style={labelStyle}>EP Slug (entry point)</Text>
              <TextInput
                style={inputStyle}
                value={editing.epSlug}
                onChangeText={(v) => setEditing((e) => e && { ...e, epSlug: v })}
                placeholder="a2a-1"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
              />

              <Text style={labelStyle}>Voice App Slug</Text>
              <TextInput
                style={inputStyle}
                value={editing.voiceAppSlug}
                onChangeText={(v) => setEditing((e) => e && { ...e, voiceAppSlug: v })}
                placeholder="freddy"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
              />

              <Text style={labelStyle}>Voice Slug (TTS/STT)</Text>
              <TextInput
                style={inputStyle}
                value={editing.voiceSlug}
                onChangeText={(v) => setEditing((e) => e && { ...e, voiceSlug: v })}
                placeholder="ep-voice-1"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
              />

              <Text style={labelStyle}>Token (optional)</Text>
              <TextInput
                style={inputStyle}
                value={editing.token}
                onChangeText={(v) => setEditing((e) => e && { ...e, token: v })}
                placeholder="Bearer token"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="none"
                secureTextEntry
              />

              <Text style={[labelStyle, { marginTop: 12 }]}>Speech Language</Text>
              <View style={[styles.modeRow, { borderColor: theme.cardBorder, backgroundColor: theme.cardBackground, marginBottom: 4 }]}>
                {([['auto', 'Auto'], ['en-US', 'English'], ['he-IL', 'Hebrew']] as [STTLanguage, string][]).map(([val, label]) => {
                  const active = (editing.sttLanguage ?? 'auto') === val;
                  return (
                    <Pressable
                      key={val}
                      style={[styles.modeOption, active && styles.modeOptionActive, active && { backgroundColor: theme.accent }]}
                      onPress={() => setEditing((e) => e && { ...e, sttLanguage: val })}
                    >
                      <Text style={active ? styles.modeOptionTextActive : [styles.modeOptionText, { color: theme.textTertiary }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[styles.btn, styles.testBtn, { borderColor: theme.accent, marginTop: 16 }]}
                onPress={() => editing && testProfile(editing as GatewayProfile)}
                disabled={!editing?.baseUrl || !editing?.appSlug}
              >
                <Text style={[styles.btnText, { color: theme.accent }]}>⚡ Test Connection</Text>
              </Pressable>

              <View style={styles.editActions}>
                <Pressable
                  style={[styles.btn, { borderColor: theme.cardBorder }]}
                  onPress={() => setEditing(null)}
                >
                  <Text style={[styles.btnText, { color: theme.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, { backgroundColor: theme.accent }]}
                  onPress={saveEditing}
                >
                  <Text style={[styles.btnText, { color: '#fff' }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              {profiles.length === 0 && (
                <Text style={[styles.emptyHint, { color: theme.textTertiary }]}>
                  No gateways configured. Add one below.
                </Text>
              )}

              {profiles.map((p) => {
                const isActive = p.id === activeId;
                return (
                  <Pressable
                    key={p.id}
                    style={[
                      styles.profileRow,
                      { borderColor: isActive ? theme.accent : theme.cardBorder, backgroundColor: theme.cardBackground },
                      isActive && { borderWidth: 1.5 },
                    ]}
                    onPress={() => setActive(p.id)}
                  >
                    <View style={styles.profileLeft}>
                      <View style={[styles.activeDot, { backgroundColor: isActive ? theme.accent : 'transparent', borderColor: theme.cardBorder }]} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.profileName, { color: theme.textPrimary }]}>{p.name}</Text>
                          {p.agentCard?.capabilities?.streaming && (
                            <Text style={[styles.capBadge, { color: theme.accent, borderColor: theme.accent }]}>SSE</Text>
                          )}
                        </View>
                        {p.agentCard?.description ? (
                          <Text style={[styles.profileUrl, { color: theme.textSecondary, opacity: 1 }]} numberOfLines={1}>{p.agentCard.description}</Text>
                        ) : null}
                        <Text style={[styles.profileUrl, { color: theme.textTertiary }]} numberOfLines={1}>{p.baseUrl}/a2a/{p.appSlug}/{p.epSlug}</Text>
                      </View>
                    </View>
                    <View style={styles.profileActions}>
                      <Pressable onPress={() => testProfile(p)} hitSlop={8}>
                        <Text style={[styles.actionIcon, { color: theme.accent }]}>⚡</Text>
                      </Pressable>
                      <Pressable onPress={() => startEdit(p)} hitSlop={8}>
                        <Text style={[styles.actionIcon, { color: theme.textSecondary }]}>✎</Text>
                      </Pressable>
                      <Pressable onPress={() => confirmDelete(p)} hitSlop={8}>
                        <Text style={[styles.actionIcon, { color: theme.textTertiary }]}>✕</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}

              <Pressable
                style={[styles.addBtn, { borderColor: theme.accent }]}
                onPress={startAdd}
              >
                <Text style={[styles.addBtnText, { color: theme.accent }]}>+ Add Gateway</Text>
              </Pressable>
            </>
          )}

          {/* ── Theme ── */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 32 }]}>Theme</Text>
          <View style={styles.themeRow}>
            {THEME_IDS.map((id) => {
              const t = THEMES[id];
              const selected = theme.id === id;
              return (
                <Pressable key={id} style={styles.themeSwatch} onPress={() => setTheme(id)}>
                  <View
                    style={[
                      styles.swatchCircle,
                      { backgroundColor: t.orbStateColors.idle },
                      selected && { borderColor: theme.textPrimary, borderWidth: 2.5 },
                    ]}
                  />
                  <Text style={[styles.swatchLabel, { color: selected ? theme.textPrimary : theme.textTertiary }]}>
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ── Audio Mode ── */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Audio Mode</Text>
          <View style={[styles.modeRow, { borderColor: theme.cardBorder, backgroundColor: theme.cardBackground }]}>
            <View style={[styles.modeOption, styles.modeOptionActive, { backgroundColor: theme.accent }]}>
              <Text style={styles.modeOptionTextActive}>STT / TTS</Text>
            </View>
            <View style={styles.modeOption}>
              <Text style={[styles.modeOptionText, { color: theme.textTertiary }]}>WebRTC</Text>
              <Text style={[styles.modeBadge, { color: theme.textTertiary }]}>Soon</Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    minHeight: 320,
    maxHeight: '90%',
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.4,
  },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: 0.3, marginBottom: 24 },
  sectionLabel: {
    fontSize: 12, fontWeight: '600', letterSpacing: 1.2,
    textTransform: 'uppercase', marginBottom: 14,
  },

  // profiles
  emptyHint: { fontSize: 13, marginBottom: 12, opacity: 0.7 },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  profileLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  activeDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  profileName: { fontSize: 14, fontWeight: '600' },
  profileUrl: { fontSize: 11, marginTop: 2, opacity: 0.7 },
  capBadge: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  profileActions: { flexDirection: 'row', gap: 16, marginLeft: 8 },
  actionIcon: { fontSize: 16 },
  addBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  addBtnText: { fontSize: 14, fontWeight: '600' },

  // edit form
  editCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
    gap: 4,
  },
  editTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  testBtn: { borderWidth: 1, alignItems: 'center', paddingVertical: 10 },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  btn: {
    flex: 1, borderRadius: 8, borderWidth: 1,
    paddingVertical: 10, alignItems: 'center',
  },
  btnPrimary: { borderWidth: 0 },
  btnText: { fontSize: 14, fontWeight: '600' },

  // theme
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  themeSwatch: { alignItems: 'center', gap: 8 },
  swatchCircle: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
  swatchLabel: { fontSize: 11, letterSpacing: 0.3 },

  // audio mode
  modeRow: {
    flexDirection: 'row', borderRadius: 12, borderWidth: 1,
    overflow: 'hidden', marginBottom: 24,
  },
  modeOption: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  modeOptionActive: { borderRadius: 10, margin: 3 },
  modeOptionText: { fontSize: 14, fontWeight: '500' },
  modeOptionTextActive: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  modeBadge: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, opacity: 0.6 },
});
