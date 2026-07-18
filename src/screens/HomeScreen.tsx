import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { Canvas, useClock } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Durations, Springs } from '../theme/motion';
import { GlowOrb } from '../components/orb/GlowOrb';
import { OrbWaveform } from '../components/orb/OrbWaveform';
import { OrbParticles } from '../components/orb/OrbParticles';
import { ParticleField } from '../components/orb/ParticleField';
import { HolographicLogo } from '../components/orb/HolographicLogo';
import { GridCardSystem } from '../components/cards/GridCardSystem';
import { TopWaveform } from '../components/ui/TopWaveform';
import { useSessionStore } from '../store/sessionStore';
import { useCardStore } from '../store/cardStore';
import { useTranscriptStore } from '../store/transcriptStore';
import { useAudioReactivity } from '../providers/AudioReactivityProvider';

function useDemoMode() {
  const { setState } = useSessionStore();
  const { addCard } = useCardStore();
  const { appendToken, setLiveSpeaker, finalizeTurn } = useTranscriptStore();
  const tokenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setState('idle');

    const schedule = [
      { t: 800,  fn: () => { setState('userSpeaking'); setLiveSpeaker('user'); appendToken('Tell me about Q2 performance'); } },
      { t: 2200, fn: () => { finalizeTurn(); setState('thinking'); } },
      { t: 3400, fn: () => {
        setState('aiSpeaking');
        setLiveSpeaker('ai');
        const words = ['Q2', 'revenue', 'grew', '+24%', 'YoY,', 'driven', 'by', 'strong', 'enterprise', 'deals.'];
        let i = 0;
        tokenIntervalRef.current = setInterval(() => {
          if (i < words.length) appendToken((i === 0 ? '' : ' ') + words[i++]);
          else { clearInterval(tokenIntervalRef.current!); finalizeTurn(); }
        }, 160);
      }},
      { t: 4200, fn: () => addCard({ id: '1', type: 'status', text: 'WebRTC Connected', level: 'success', autoDismissMs: 4000, createdAt: Date.now() }) },
      { t: 5500, fn: () => addCard({ id: '2', type: 'chart', chartLabel: '+24%', series: [10,14,12,18,22,20,24], chartKind: 'bar', createdAt: Date.now() }) },
      { t: 7000, fn: () => addCard({ id: '3', type: 'text', title: 'Q2 Performance', markdown: 'Strong revenue growth driven by enterprise deals. Margins improving quarter-on-quarter.', createdAt: Date.now() }) },
      { t: 9000, fn: () => addCard({ id: '4', type: 'file', fileName: 'Board_Brief.pdf', sizeBytes: 2700000, mimeType: 'application/pdf', createdAt: Date.now() }) },
      { t: 11000, fn: () => { setState('userSpeaking'); setLiveSpeaker('user'); appendToken('Show me the competitive landscape'); } },
      { t: 13000, fn: () => { finalizeTurn(); setState('thinking'); } },
      { t: 14000, fn: () => { setState('aiSpeaking'); setLiveSpeaker('ai'); appendToken('Here is the competitive landscape overview.'); } },
      { t: 15500, fn: () => addCard({ id: '5', type: 'image', fileName: 'competitive_landscape.jpg', createdAt: Date.now() }) },
      { t: 17000, fn: () => { finalizeTurn(); setState('idle'); } },
    ];

    const timers = schedule.map(({ t, fn }) => setTimeout(fn, t));
    return () => {
      timers.forEach(clearTimeout);
      if (tokenIntervalRef.current) clearInterval(tokenIntervalRef.current);
    };
  }, []);
}

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
  const { userLevel, aiLevel } = useAudioReactivity();

  const sessionState = useSessionStore((s) => s.state);
  const liveText = useTranscriptStore((s) => s.liveText);
  const liveSpeaker = useTranscriptStore((s) => s.liveSpeaker);

  // Orb anchored at bottom — center X, 68% down the screen
  const cx = width / 2;
  const cy = height * 0.68;
  const baseRadius = Math.min(width, height) * 0.22;

  const fieldIntensity = useSharedValue(0.5);
  const energy = useSharedValue(0.3);
  const amplitude = useSharedValue(0.05);

  const [primaryColor, setPrimaryColor] = React.useState<string>(Colors.orbIdle);
  const [secondaryColor, setSecondaryColor] = React.useState<string>(Colors.orbIdleSecondary);

  const stateLabel = {
    idle: "I'm listening...",
    connecting: 'Connecting...',
    userSpeaking: "I'm listening...",
    aiSpeaking: "I'm speaking...",
    thinking: 'Thinking...',
    error: 'Error',
  }[sessionState];

  useEffect(() => {
    switch (sessionState) {
      case 'userSpeaking':
        setPrimaryColor(Colors.orbUser);
        setSecondaryColor(Colors.orbUserSecondary);
        energy.value = withSpring(0.85, Springs.soft);
        amplitude.value = withTiming(0.4, { duration: Durations.base });
        fieldIntensity.value = withTiming(0.8, { duration: Durations.slow });
        break;
      case 'aiSpeaking':
        setPrimaryColor(Colors.orbAI);
        setSecondaryColor(Colors.orbAISecondary);
        energy.value = withSpring(0.75, Springs.soft);
        amplitude.value = withTiming(0.35, { duration: Durations.base });
        fieldIntensity.value = withTiming(0.9, { duration: Durations.slow });
        break;
      case 'thinking':
        setPrimaryColor(Colors.orbThinking);
        setSecondaryColor(Colors.orbThinkingSecondary);
        energy.value = withRepeat(
          withSequence(withTiming(0.6, { duration: 900 }), withTiming(0.3, { duration: 900 })),
          -1, false,
        );
        amplitude.value = withTiming(0.15, { duration: Durations.slow });
        break;
      default:
        setPrimaryColor(Colors.orbIdle);
        setSecondaryColor(Colors.orbIdleSecondary);
        energy.value = withSpring(0.3, Springs.soft);
        amplitude.value = withTiming(0.05, { duration: Durations.slow });
        fieldIntensity.value = withTiming(0.5, { duration: Durations.slow });
    }
  }, [sessionState]);

  useDemoMode();

  const isSpeaking = sessionState === 'userSpeaking' || sessionState === 'aiSpeaking';

  return (
    <View style={styles.container}>
      {/* Full screen Skia canvas */}
      <Canvas style={StyleSheet.absoluteFill}>
        <ParticleField width={width} height={height} count={80} intensity={fieldIntensity} clock={clock} />
        <GlowOrb
          cx={cx} cy={cy} baseRadius={baseRadius}
          amplitude={amplitude} clock={clock}
          primaryColor={primaryColor} secondaryColor={secondaryColor}
        />
        <OrbParticles
          cx={cx} cy={cy} orbitRadius={baseRadius} count={200}
          amplitude={amplitude} energy={energy} clock={clock} color={primaryColor}
        />
        <HolographicLogo
          cx={cx} cy={cy} size={baseRadius * 1.6}
          clock={clock} amplitude={amplitude} energy={energy}
        />

      </Canvas>

      {/* Top header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>☰</Text>
        </Pressable>
        <Pressable style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>✦</Text>
        </Pressable>
      </View>

      {/* Waveform + status — just below header */}
      <View style={[styles.statusArea, { top: insets.top + 52 }]}>
        <TopWaveform amplitude={amplitude} color={primaryColor} visible={isSpeaking} />
        <Text style={styles.stateLabel}>{stateLabel}</Text>
        {liveText ? <Text style={styles.liveText} numberOfLines={1}>{liveText}</Text> : null}
      </View>

      {/* Cards grid — scrollable area between status and orb */}
      <View style={[styles.cardArea, { top: insets.top + 140, bottom: height - cy + baseRadius * 0.6 }]}>
        <GridCardSystem />
      </View>

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 8 }]}>
        {NAV_ITEMS.map((item, i) => (
          <Pressable key={item.label} style={styles.navItem}>
            <Text style={[styles.navIcon, i === 0 && styles.navIconActive]}>{item.icon}</Text>
            <Text style={[styles.navLabel, i === 0 && styles.navLabelActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 40,
  },
  headerBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(150,100,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { color: Colors.textSecondary, fontSize: 16 },
  statusArea: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 30,
    paddingHorizontal: 24,
  },
  stateLabel: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '300',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  liveText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  cardArea: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(8,6,24,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(150,100,255,0.15)',
    paddingTop: 10,
    zIndex: 40,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  navIcon: { fontSize: 18, color: Colors.textTertiary },
  navIconActive: { color: Colors.accent },
  navLabel: { fontSize: 11, color: Colors.textTertiary, letterSpacing: 0.3 },
  navLabelActive: { color: Colors.accent },
});
