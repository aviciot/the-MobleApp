import React, { useEffect } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Constants from 'expo-constants';
import { Canvas, useClock } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withTiming,
  withDelay,
  withSpring,
  useAnimatedStyle,
} from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { Colors } from '../theme/colors';
import { TheMOrb } from '../components/orb/TheMOrb';

interface SplashScreenProps {
  onFinish: () => void;
}

const appVersion = Constants.expoConfig?.version ?? '?';
const nativeBuild = Constants.expoConfig?.android?.versionCode
  ?? Constants.expoConfig?.ios?.buildNumber
  ?? '?';
const BUILD_LABEL = `v${appVersion} (${nativeBuild})`;

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const clock = useClock();

  const cx = width / 2;
  const cy = height * 0.42;
  const baseRadius = Math.min(width, height) * 0.18;

  const energy = useSharedValue(0);
  const wordmarkOpacity = useSharedValue(0);
  const wordmarkY = useSharedValue(20);

  useEffect(() => {
    energy.value = withDelay(400, withSpring(0.6));
    wordmarkOpacity.value = withDelay(1800, withTiming(1, { duration: 700 }));
    wordmarkY.value = withDelay(1800, withTiming(0, { duration: 700 }));

    const timer = setTimeout(onFinish, 3600);
    return () => clearTimeout(timer);
  }, []);

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkY.value }],
  }));

  return (
    <View style={styles.container}>
      <Canvas style={StyleSheet.absoluteFill}>
        <TheMOrb
          cx={cx}
          cy={cy}
          radius={baseRadius}
          mode="idle"
          energy={energy}
          clock={clock}
          assembleOnMount
        />
      </Canvas>

      <Animated.View style={[styles.wordmark, wordmarkStyle]}>
        <Text style={styles.brandText}>THE·M</Text>
        <Text style={styles.tagline}>Intelligence. Spoken.</Text>
        <View style={styles.attribution}>
          <Text style={styles.attributionName}>Avi Cohen</Text>
          <Text style={styles.attributionEmail}>avicoiot@gmail.com</Text>
        </View>
        <Text style={styles.buildLabel}>{BUILD_LABEL}</Text>
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
  attribution: {
    marginTop: 28,
    alignItems: 'center',
    gap: 3,
  },
  attributionName: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 1.5,
    opacity: 0.85,
  },
  attributionEmail: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 0.5,
    opacity: 0.75,
  },
  buildLabel: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 1,
    opacity: 0.45,
    marginTop: 14,
  },
});
