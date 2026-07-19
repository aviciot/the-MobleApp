import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions, NativeModules } from 'react-native';
import { Canvas, useClock } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { TheMOrb } from '../components/orb/TheMOrb';
import type { OrbMode } from '../components/orb/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Durations, Springs } from '../theme/motion';
import { GridCardSystem } from '../components/cards/GridCardSystem';
import { TopWaveform } from '../components/ui/TopWaveform';
import { SettingsSheet } from '../components/ui/SettingsSheet';
import { useSessionStore } from '../store/sessionStore';
import { useTranscriptStore } from '../store/transcriptStore';
import { useAudioReactivity } from '../providers/AudioReactivityProvider';
import { useTheme } from '../theme/useTheme';
import { useVoicePipeline } from '../audio/useVoicePipeline';
import { useGatewayStore } from '../store/gatewayStore';

const NAV_ITEMS = [
  { label: 'Chat', icon: '💬' },
  { label: 'Memory', icon: '🗂' },
  { label: 'Agents', icon: '⬡' },
  { label: 'You', icon: '○' },
];

export function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clock = useClock();
  const theme = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { profiles, hydrated, hydrate } = useGatewayStore();

  // Hydrate from SecureStore on mount, open settings if no profiles yet
  useEffect(() => {
    hydrate().then(() => {
      if (useGatewayStore.getState().profiles.length === 0) {
        setSettingsOpen(true);
      }
    });
  }, []);

  const sessionState = useSessionStore((s) => s.state);
  const liveText = useTranscriptStore((s) => s.liveText);
  const liveSpeaker = useTranscriptStore((s) => s.liveSpeaker);

  const cx = width / 2;
  const cy = height * 0.72;
  const baseRadius = Math.min(width, height) * 0.26;

  const energy = useSharedValue(0.3);
  const amplitude = useSharedValue(0.05);

  const { startRecording, stopRecording, cancel } = useVoicePipeline({ energy, amplitude });

  const [waveformColor, setWaveformColor] = useState(theme.waveformColor);

  const stateLabel: Record<string, string> = {
    idle: "Hold mic to speak",
    connecting: 'Connecting...',
    userSpeaking: "Listening...",
    aiSpeaking: "Speaking...",
    thinking: 'Thinking...',
    error: 'Error',
  };

  useEffect(() => {
    switch (sessionState) {
      case 'userSpeaking':
        setWaveformColor(theme.orbStateColors.user);
        energy.value = withSpring(0.85, Springs.soft);
        amplitude.value = withTiming(0.4, { duration: Durations.base });
        break;
      case 'aiSpeaking':
        setWaveformColor(theme.orbStateColors.ai);
        energy.value = withSpring(0.75, Springs.soft);
        amplitude.value = withTiming(0.35, { duration: Durations.base });
        break;
      case 'thinking':
        setWaveformColor(theme.orbStateColors.thinking);
        energy.value = withRepeat(
          withSequence(withTiming(0.6, { duration: 900 }), withTiming(0.3, { duration: 900 })),
          -1, false,
        );
        amplitude.value = withTiming(0.15, { duration: Durations.slow });
        break;
      default:
        setWaveformColor(theme.orbStateColors.idle);
        energy.value = withSpring(0.3, Springs.soft);
        amplitude.value = withTiming(0.05, { duration: Durations.slow });
    }
  }, [sessionState, theme]);

  const orbMode: OrbMode = (() => {
    switch (sessionState) {
      case 'userSpeaking': return 'userSpeaking';
      case 'aiSpeaking':   return 'aiSpeaking';
      case 'thinking':     return 'listening';
      default:             return 'idle';
    }
  })();

  const isSpeaking = sessionState === 'userSpeaking' || sessionState === 'aiSpeaking';
  const isRecording = sessionState === 'userSpeaking';
  const isBusy = sessionState === 'thinking' || sessionState === 'aiSpeaking';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <TheMOrb
          cx={cx}
          cy={cy}
          radius={baseRadius}
          mode={orbMode}
          energy={energy}
          clock={clock}
        />
      </Canvas>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={[styles.headerBtn, { backgroundColor: theme.buttonBg, borderColor: theme.buttonBorder }]}
          onPress={() => setSettingsOpen(true)}
        >
          <Text style={[styles.headerBtnText, { color: theme.textSecondary }]}>☰</Text>
        </Pressable>
        <View style={styles.headerRight}>
          {/* DEV ONLY */}
          <Pressable
            style={styles.devBtn}
            onPress={() => NativeModules.DevSettings?.reload()}
            onLongPress={() => NativeModules.DevSettings?.openDebugger?.()}
          >
            <Text style={styles.devBtnText}>⚡ DEV</Text>
          </Pressable>
          <Pressable
            style={[styles.headerBtn, { backgroundColor: theme.buttonBg, borderColor: theme.buttonBorder }]}
            onPress={() => setSettingsOpen(true)}
          >
            <Text style={[styles.headerBtnText, { color: theme.textSecondary }]}>✦</Text>
          </Pressable>
        </View>
      </View>

      {/* Status */}
      <View style={[styles.statusArea, { top: insets.top + 52 }]}>
        <TopWaveform amplitude={amplitude} color={waveformColor} visible={isSpeaking} />
        <Text style={[styles.stateLabel, { color: theme.textPrimary }]}>
          {stateLabel[sessionState] ?? "Hold mic to speak"}
        </Text>
        {liveText ? (
          <Text style={[styles.liveText, { color: theme.textSecondary }]} numberOfLines={2}>
            {liveText}
          </Text>
        ) : null}
      </View>

      {/* Cards */}
      <View style={[styles.cardArea, { top: insets.top + 140, bottom: height - cy + baseRadius * 0.55 }]}>
        <GridCardSystem />
      </View>

      {/* Mic button — sits just below the orb */}
      <View style={[styles.micArea, { bottom: insets.bottom + 80 }]}>
        {isBusy ? (
          <Pressable style={[styles.micBtn, styles.micBtnCancel, { borderColor: theme.accent }]} onPress={cancel}>
            <Text style={[styles.micIcon, { color: theme.accent }]}>✕</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.micBtn,
              { borderColor: isRecording ? theme.orbStateColors.user : theme.accent },
              isRecording && { backgroundColor: theme.orbStateColors.user + '22' },
            ]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Text style={styles.micIcon}>🎤</Text>
          </Pressable>
        )}
      </View>

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8, backgroundColor: theme.navBackground, borderTopColor: theme.navBorder }]}>
        {NAV_ITEMS.map((item, i) => (
          <Pressable key={item.label} style={styles.navItem}>
            <Text style={[styles.navIcon, { color: i === 0 ? theme.navIconActive : theme.navIconInactive }]}>{item.icon}</Text>
            <Text style={[styles.navLabel, { color: i === 0 ? theme.navIconActive : theme.navIconInactive }]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 40,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,180,0,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,180,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devBtnText: {
    color: '#FFB400',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { fontSize: 16 },
  statusArea: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 30,
    paddingHorizontal: 24,
  },
  stateLabel: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  liveText: {
    fontSize: 14,
    marginTop: 4,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  cardArea: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
  },
  micArea: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
  micBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  micBtnCancel: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  micIcon: {
    fontSize: 26,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    zIndex: 40,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navIcon: { fontSize: 18 },
  navLabel: { fontSize: 11, letterSpacing: 0.3 },
});
