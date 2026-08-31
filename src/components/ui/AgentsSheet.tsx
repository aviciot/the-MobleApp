import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { useGatewayStore, type GatewayProfile } from '../../store/gatewayStore';

interface AgentsSheetProps {
  visible: boolean;
  onClose: () => void;
  onAgentSwitch?: () => void;
}

export function AgentsSheet({ visible, onClose, onAgentSwitch }: AgentsSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { profiles, activeId, setActive } = useGatewayStore();

  const translateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 180 });
      backdropOpacity.value = withTiming(1, { duration: 250 });
    } else {
      translateY.value = withSpring(600, { damping: 22, stiffness: 180 });
      backdropOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  async function selectAgent(p: GatewayProfile) {
    onAgentSwitch?.();
    await setActive(p.id);
    onClose();
  }

  async function testAgent(p: GatewayProfile) {
    const url = `${p.baseUrl}/a2a/${p.appSlug}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(p.token ? { Authorization: `Bearer ${p.token}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'agent/authenticatedExtendedCard', params: {} }),
      });
      Alert.alert(res.ok || res.status === 401 ? 'Reachable' : 'Unexpected status', `HTTP ${res.status}`);
    } catch (e: any) {
      Alert.alert('Unreachable', e?.message ?? String(e));
    }
  }

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

        <Text style={[styles.title, { color: theme.textPrimary }]}>Agents</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Select an agent to talk to
        </Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {profiles.length === 0 && (
            <Text style={[styles.empty, { color: theme.textTertiary }]}>
              No agents configured. Add one in Settings.
            </Text>
          )}

          {profiles.map((p) => {
            const isActive = p.id === activeId;
            return (
              <Pressable
                key={p.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: isActive ? theme.accent : theme.cardBorder,
                  },
                  isActive && styles.cardActive,
                ]}
                onPress={() => selectAgent(p)}
              >
                {/* Avatar circle */}
                <View style={[styles.avatar, { backgroundColor: isActive ? theme.accent : theme.cardBorder }]}>
                  <Text style={styles.avatarText}>
                    {p.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={[styles.cardName, { color: theme.textPrimary }]}>{p.name}</Text>
                  <Text style={[styles.cardUrl, { color: theme.textTertiary }]} numberOfLines={1}>
                    {p.baseUrl}/a2a/{p.appSlug}
                  </Text>
                </View>

                {/* Right side */}
                <View style={styles.cardRight}>
                  {isActive && (
                    <View style={[styles.activeBadge, { backgroundColor: theme.accent }]}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                  <Pressable onPress={() => testAgent(p)} hitSlop={8} style={styles.testBtn}>
                    <Text style={[styles.testBtnText, { color: theme.accent }]}>⚡</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
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
    maxHeight: '80%',
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
    opacity: 0.4,
  },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: 0.3 },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 20, opacity: 0.7 },
  list: { gap: 12, paddingBottom: 8 },
  empty: { fontSize: 13, textAlign: 'center', marginTop: 24 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  cardActive: { borderWidth: 1.5 },
  avatar: {
    width: 44, height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600' },
  cardUrl: { fontSize: 11, marginTop: 3, opacity: 0.7 },
  cardRight: { alignItems: 'center', gap: 6 },
  activeBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  testBtn: { padding: 4 },
  testBtnText: { fontSize: 16 },
});
