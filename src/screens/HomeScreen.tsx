import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
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
import { FloatingCardSystem } from '../components/cards/FloatingCardSystem';
import { LiveTranscriptBar } from '../components/ui/LiveTranscriptBar';
import { useSessionStore } from '../store/sessionStore';
import { useCardStore } from '../store/cardStore';
import { useTranscriptStore } from '../store/transcriptStore';
import { useAudioReactivity } from '../providers/AudioReactivityProvider';

// Demo mode: cycles through states + adds cards automatically for testing
function useDemoMode() {
  const { setState } = useSessionStore();
  const { addCard } = useCardStore();
  const { appendToken, setLiveSpeaker, finalizeTurn } = useTranscriptStore();
  const tokenIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Start connected
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
      { t: 7000, fn: () => addCard({ id: '3', type: 'text', title: 'Q2 Performance', markdown: 'Strong revenue growth driven by enterprise deals. Margins improving quarter-on-quarter. Pipeline looks healthy for Q3.', createdAt: Date.now() }) },
      { t: 9000, fn: () => addCard({ id: '4', type: 'file', fileName: 'Board_Brief.pdf', sizeBytes: 2700000, mimeType: 'application/pdf', createdAt: Date.now() }) },
      { t: 11000, fn: () => { setState('userSpeaking'); setLiveSpeaker('user'); appendToken('Show me the competitive landscape image'); } },
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

export function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clock = useClock();
  const { userLevel, aiLevel } = useAudioReactivity();

  const sessionState = useSessionStore((s) => s.state);
  const isMuted = useSessionStore((s) => s.isMuted);
  const toggleMute = useSessionStore((s) => s.toggleMute);
  const liveText = useTranscriptStore((s) => s.liveText);
  const liveSpeaker = useTranscriptStore((s) => s.liveSpeaker);

  const cx = width / 2;
  const cy = height * 0.42;
  const baseRadius = Math.min(width, height) * 0.18;

  // Derived animation values
  const fieldIntensity = useSharedValue(0.5);
  const energy = useSharedValue(0.3);
  const amplitude = useSharedValue(0.05);

  // Orb color based on state
  const [primaryColor, setPrimaryColor] = React.useState<string>(Colors.orbIdle);
  const [secondaryColor, setSecondaryColor] = React.useState<string>(Colors.orbIdleSecondary);

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
          withSequence(
            withTiming(0.6, { duration: 900 }),
            withTiming(0.3, { duration: 900 }),
          ),
          -1,
          false,
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

  // Run demo
  useDemoMode();

  const stateLabel = {
    idle: 'Ready',
    connecting: 'Connecting...',
    userSpeaking: 'Listening',
    aiSpeaking: 'Speaking',
    thinking: 'Thinking...',
    error: 'Error',
  }[sessionState];

  const stateDot = {
    idle: Colors.textTertiary,
    connecting: Colors.accentBlue,
    userSpeaking: Colors.accentBlue,
    aiSpeaking: Colors.accentPurple,
    thinking: Colors.orbThinking,
    error: '#FF4466',
  }[sessionState];

  return (
    <View style={styles.container}>
      {/* GPU layer */}
      <Canvas style={StyleSheet.absoluteFill}>
        <ParticleField width={width} height={height} count={60} intensity={fieldIntensity} clock={clock} />
        <GlowOrb
          cx={cx}
          cy={cy}
          baseRadius={baseRadius}
          amplitude={amplitude}
          clock={clock}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />
        <OrbWaveform
          cx={cx}
          cy={cy}
          radius={baseRadius}
          amplitude={amplitude}
          clock={clock}
          color={primaryColor}
        />
        <OrbParticles
          cx={cx}
          cy={cy}
          orbitRadius={baseRadius * 1.3}
          count={16}
          amplitude={amplitude}
          energy={energy}
          clock={clock}
          color={primaryColor}
        />
      </Canvas>

      {/* Floating cards */}
      <FloatingCardSystem
        orbCx={cx}
        orbCy={cy}
        orbRadius={baseRadius}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: stateDot }]} />
          <Text style={styles.statusLabel}>{stateLabel}</Text>
        </View>
      </View>

      {/* Transcript bar */}
      <LiveTranscriptBar
        liveText={liveText}
        speaker={liveSpeaker}
        visible={sessionState !== 'idle'}
        isMuted={isMuted}
        onMuteToggle={toggleMute}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
