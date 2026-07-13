import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, useClock } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { useAnimatedStyle } from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { Durations, Easings, Springs } from '../theme/motion';
import { GlowOrb } from '../components/orb/GlowOrb';
import { OrbParticles } from '../components/orb/OrbParticles';
import { ParticleField } from '../components/orb/ParticleField';

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();

  const cx = width / 2;
  const cy = height * 0.42;
  const baseRadius = Math.min(width, height) * 0.18;

  // Animation shared values
  const orbScale = useSharedValue(0);
  const orbOpacity = useSharedValue(0);
  const fieldIntensity = useSharedValue(0);
  const energy = useSharedValue(0);
  const amplitude = useSharedValue(0.05);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkY = useSharedValue(20);

  useEffect(() => {
    // Ignition sequence
    orbOpacity.value = withTiming(1, { duration: 200 });
    orbScale.value = withTiming(1, { duration: 600, easing: Easings.decel });

    fieldIntensity.value = withDelay(900, withTiming(0.4, { duration: 700 }));
    energy.value = withDelay(700, withSpring(0.6, Springs.soft));
    amplitude.value = withDelay(400, withTiming(0.15, { duration: 800 }));

    wordmarkOpacity.value = withDelay(1200, withTiming(1, { duration: 600, easing: Easings.decel }));
    wordmarkY.value = withDelay(1200, withTiming(0, { duration: 600, easing: Easings.decel }));

    // Navigate after sequence
    const timer = setTimeout(() => {
      runOnJS(onFinish)();
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkY.value }],
  }));

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        <ParticleField
          width={width}
          height={height}
          count={50}
          intensity={fieldIntensity}
          clock={clock}
        />
        <GlowOrb
          cx={cx}
          cy={cy}
          baseRadius={baseRadius}
          amplitude={amplitude}
          clock={clock}
          primaryColor={Colors.orbThinking}
          secondaryColor={Colors.orbThinkingSecondary}
        />
        <OrbParticles
          cx={cx}
          cy={cy}
          orbitRadius={baseRadius * 1.3}
          count={14}
          amplitude={amplitude}
          energy={energy}
          clock={clock}
          color={Colors.orbThinking}
        />
      </Canvas>

      <Animated.View style={[styles.wordmark, wordmarkStyle]}>
        <Text style={styles.brandText}>THE·M</Text>
        <Text style={styles.tagline}>Intelligence. Spoken.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  wordmark: {
    position: 'absolute',
    bottom: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  brandText: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '200',
    letterSpacing: 12,
  },
  tagline: {
    color: Colors.textTertiary,
    fontSize: 13,
    letterSpacing: 4,
    marginTop: 8,
    fontWeight: '300',
  },
});
