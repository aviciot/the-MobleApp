import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Alert } from 'react-native';
import { Canvas, useClock } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme/colors';
import { Durations, Springs } from '../theme/motion';
import { TheMOrb } from '../components/orb/TheMOrb';
import { GlassButton } from '../components/ui/GlassButton';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clock = useClock();
  const [loading, setLoading] = useState(false);

  const cx = width / 2;
  const cy = height * 0.38;
  const baseRadius = Math.min(width, height) * 0.17;

  const energy = useSharedValue(0.12);

  useEffect(() => {
    energy.value = withTiming(0.2, { duration: Durations.slow });
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    energy.value = withSpring(0.7, Springs.soft);
    await new Promise((r) => setTimeout(r, 900));
    setLoading(false);
    onLogin();
  };

  const handleGoogleLogin = () => {
    Alert.alert('Google OAuth', 'Not wired yet — will use expo-auth-session');
  };

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
        />
      </Canvas>

      {/* Top brand */}
      <View style={[styles.brand, { marginTop: insets.top + 40 }]}>
        <Text style={styles.brandText}>THE·M</Text>
      </View>

      {/* Bottom controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={styles.tagline}>Speak. It listens.</Text>

        <View style={styles.buttons}>
          <GlassButton
            label="Continue with Face ID"
            onPress={handleLogin}
            loading={loading}
            breathing
            glowColor={Colors.accent}
          />
          <GlassButton
            label="Continue with Google"
            onPress={handleGoogleLogin}
            variant="ghost"
            glowColor={Colors.accentBlue}
          />
        </View>

        <Text style={styles.legal}>
          By continuing you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  brand: {
    alignItems: 'center',
  },
  brandText: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '200',
    letterSpacing: 10,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    gap: 0,
  },
  tagline: {
    color: Colors.textTertiary,
    fontSize: 15,
    letterSpacing: 2,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 32,
  },
  buttons: {
    gap: 14,
  },
  legal: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 16,
  },
});
