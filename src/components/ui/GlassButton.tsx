import React from 'react';
import { Pressable, Text, View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Colors } from '../../theme/colors';
import { Springs, Durations } from '../../theme/motion';

interface GlassButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'pill' | 'ghost';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  glowColor?: string;
  breathing?: boolean;
}

export function GlassButton({
  label,
  onPress,
  variant = 'pill',
  icon,
  loading,
  disabled,
  glowColor = Colors.accent,
  breathing = false,
}: GlassButtonProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(breathing ? 0.35 : 0.4);

  React.useEffect(() => {
    if (breathing) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: Durations.orbBreath / 2 }),
          withTiming(0.3, { duration: Durations.orbBreath / 2 }),
        ),
        -1,
        false,
      );
    }
  }, [breathing]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, Springs.snappy);
    glowOpacity.value = withTiming(0.75, { duration: Durations.fast });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, Springs.soft);
    glowOpacity.value = withTiming(breathing ? 0.4 : 0.35, { duration: Durations.base });
  };

  const isGhost = variant === 'ghost';

  return (
    <Animated.View style={[styles.wrapper, animStyle]}>
      {/* Outer glow */}
      <Animated.View
        style={[
          styles.glow,
          { shadowColor: glowColor, borderColor: glowColor },
          glowStyle,
        ]}
        pointerEvents="none"
      />

      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={styles.pressable}
      >
        <BlurView
          intensity={isGhost ? 10 : 24}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.inner, isGhost && styles.innerGhost]}>
          {icon && <View style={styles.icon}>{icon}</View>}
          {loading ? (
            <ActivityIndicator size="small" color={Colors.textPrimary} />
          ) : (
            <Text style={[styles.label, isGhost && styles.labelGhost]}>{label}</Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 28,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 1,
    elevation: 8,
  },
  pressable: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(123,47,255,0.15)',
    paddingHorizontal: 24,
    gap: 10,
  },
  innerGhost: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  icon: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  labelGhost: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
