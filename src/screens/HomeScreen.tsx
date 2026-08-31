import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Canvas, useClock } from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
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
import { AgentsSheet } from '../components/ui/AgentsSheet';
import { ConversationSheet } from '../components/ui/ConversationSheet';
import { useSessionStore } from '../store/sessionStore';
import { useTranscriptStore } from '../store/transcriptStore';
import { useCardStore } from '../store/cardStore';
import { useTheme } from '../theme/useTheme';
import { useVoicePipeline } from '../audio/useVoicePipeline';
import { useGatewayStore } from '../store/gatewayStore';
import { useSessionModeStore } from '../store/sessionModeStore';
import { DEV_PROFILES } from '../config.dev';
import { resetContextForProfile } from '../ai/A2AClient';

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
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  const { mode, toggle: toggleMode } = useSessionModeStore();

  const { profiles, hydrated, hydrate, activeId, activeProfile } = useGatewayStore();
  const activeAgent = activeProfile();

  // Hydrate from SecureStore on mount, seed dev profiles if none exist
  useEffect(() => {
    hydrate().then(() => {
      const store = useGatewayStore.getState();
      if (store.profiles.length === 0) {
        DEV_PROFILES.forEach((p) => store.addProfile(p));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sessionState = useSessionStore((s) => s.state);
  const liveText = useTranscriptStore((s) => s.liveText);
  const liveSpeaker = useTranscriptStore((s) => s.liveSpeaker);
  const finalizedTurns = useTranscriptStore((s) => s.finalizedTurns);

  // Keep last spoken text visible while AI is thinking/speaking.
  // Also capture during 'thinking' — the final STT result arrives after state
  // transitions away from 'userSpeaking', so we must catch it in both states.
  const lastSpokenRef = useRef('');
  const [lastSpoken, setLastSpoken] = useState('');
  useEffect(() => {
    if ((sessionState === 'userSpeaking' || sessionState === 'thinking') && liveSpeaker === 'user' && liveText) {
      lastSpokenRef.current = liveText;
      setLastSpoken(liveText);
    }
    if (sessionState === 'idle') {
      setLastSpoken('');
      lastSpokenRef.current = '';
    }
  }, [sessionState, liveText, liveSpeaker]);

  // Pulsing dot opacity for active states
  const dotOpacity = useSharedValue(0);
  useEffect(() => {
    if (sessionState === 'userSpeaking' || sessionState === 'thinking' || sessionState === 'aiSpeaking') {
      dotOpacity.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.2, { duration: 500 })), -1, false);
    } else {
      dotOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [sessionState]);

  const cx = width / 2;
  const cy = height * 0.72;
  const baseRadius = Math.min(width, height) * 0.26;

  const energy = useSharedValue(0.3);
  const amplitude = useSharedValue(0.05);

  const { startRecording, stopRecording, cancel } = useVoicePipeline({ energy, amplitude });

  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

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
        energy.value = withTiming(0.75, { duration: 1200 });
        amplitude.value = withTiming(0.4, { duration: Durations.base });
        break;
      case 'aiSpeaking':
        setWaveformColor(theme.orbStateColors.ai);
        energy.value = withTiming(0.65, { duration: 1400 });
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

      {/* Invisible press target over orb */}
      <Pressable
        style={[styles.orbPressArea, { top: cy - baseRadius, left: cx - baseRadius, width: baseRadius * 2, height: baseRadius * 2, borderRadius: baseRadius }]}
        onPressIn={!isBusy ? startRecording : undefined}
        onPressOut={!isBusy ? stopRecording : undefined}
        onPress={isBusy ? cancel : undefined}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={[styles.headerBtn, { backgroundColor: theme.buttonBg, borderColor: theme.buttonBorder }]}
          onPress={() => setSettingsOpen(true)}
        >
          <Text style={[styles.headerBtnText, { color: theme.textSecondary }]}>☰</Text>
        </Pressable>
        <View style={styles.headerRight}>
          {/* Mode toggle */}
          <Pressable
            style={[styles.modeToggle, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
            onPress={toggleMode}
          >
            <Text style={[styles.modeToggleText, { color: theme.accent }]}>
              {mode === 'voice' ? '🎙 Voice' : '💬 Chat'}
            </Text>
          </Pressable>
          {/* Conversation history button */}
          <Pressable
            style={[styles.headerBtn, { backgroundColor: theme.buttonBg, borderColor: theme.buttonBorder }]}
            onPress={() => setConversationOpen(true)}
          >
            <Text style={[styles.headerBtnText, { color: theme.textSecondary }]}>💬</Text>
          </Pressable>
        </View>
      </View>

      {/* Status — tap to open conversation */}
      <Pressable style={[styles.statusArea, { top: insets.top + 52 }]} onPress={() => setConversationOpen(true)}>
        <TopWaveform amplitude={amplitude} color={waveformColor} visible={isSpeaking} />

        {/* State label row with pulsing dot */}
        <View style={styles.stateLabelRow}>
          <Animated.View style={[styles.stateDot, { backgroundColor: sessionState === 'userSpeaking' ? theme.orbStateColors.user : sessionState === 'aiSpeaking' ? theme.orbStateColors.ai : theme.accent }, dotStyle]} />
          <Text style={[styles.stateLabel, { color: theme.textPrimary }]}>
            {stateLabel[sessionState] ?? 'Hold orb to speak'}
          </Text>
        </View>

        {/* Live STT text while speaking or while final result arrives during thinking */}
        {(sessionState === 'userSpeaking' || (sessionState === 'thinking' && liveSpeaker === 'user')) && liveText ? (
          <Text style={[styles.liveText, { color: theme.orbStateColors.user }]} numberOfLines={2}>
            "{liveText}"
          </Text>
        ) : null}

        {/* Keep user's words visible while AI thinks / speaks */}
        {(sessionState === 'thinking' || sessionState === 'aiSpeaking') && lastSpoken ? (
          <Text style={[styles.liveText, { color: theme.textTertiary }]} numberOfLines={2}>
            "{lastSpoken}"
          </Text>
        ) : null}

        {/* Tap hint */}
        {sessionState === 'idle' && finalizedTurns.length > 0 && (
          <Text style={[styles.tapHint, { color: theme.textTertiary }]}>
            tap to view conversation ({finalizedTurns.length})
          </Text>
        )}
      </Pressable>

      {/* Cards */}
      <View style={[styles.cardArea, { top: insets.top + 140, bottom: height - cy + baseRadius * 0.55 }]}>
        <GridCardSystem />
      </View>


      {/* Active agent chip */}
      {activeAgent && (
        <Pressable
          style={[styles.agentChip, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }]}
          onPress={() => setAgentsOpen(true)}
        >
          <View style={[styles.agentDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.agentChipText, { color: theme.textSecondary }]} numberOfLines={1}>
            {activeAgent.name}
          </Text>
        </Pressable>
      )}

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8, backgroundColor: theme.navBackground, borderTopColor: theme.navBorder }]}>
        {NAV_ITEMS.map((item, i) => {
          const isAgents = item.label === 'Agents';
          const isActive = i === 0;
          return (
            <Pressable
              key={item.label}
              style={styles.navItem}
              onPress={isAgents ? () => setAgentsOpen(true) : undefined}
            >
              <Text style={[styles.navIcon, { color: isActive ? theme.navIconActive : theme.navIconInactive }]}>{item.icon}</Text>
              <Text style={[styles.navLabel, { color: isActive ? theme.navIconActive : theme.navIconInactive }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AgentsSheet
        visible={agentsOpen}
        onClose={() => setAgentsOpen(false)}
        onAgentSwitch={() => {
          cancel();
          const prev = activeProfile();
          if (prev) resetContextForProfile(prev.baseUrl, prev.appSlug);
          useTranscriptStore.getState().clearLive();
          useTranscriptStore.getState().finalizeTurn();
          useCardStore.getState().clearCards();
        }}
      />
      <ConversationSheet
        visible={conversationOpen}
        onClose={() => setConversationOpen(false)}
        mode={mode}
      />
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
  stateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  stateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stateLabel: {
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0.5,
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
  orbPressArea: {
    position: 'absolute',
    zIndex: 40,
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
  modeToggle: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleText: { fontSize: 12, fontWeight: '600' },
  tapHint: {
    fontSize: 11,
    marginTop: 6,
    opacity: 0.5,
    letterSpacing: 0.3,
  },
  agentChip: {
    position: 'absolute',
    bottom: 72,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 30,
  },
  agentDot: { width: 6, height: 6, borderRadius: 3 },
  agentChipText: { fontSize: 12, fontWeight: '500' },
});
