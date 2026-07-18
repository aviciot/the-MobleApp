import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

interface TopWaveformProps {
  amplitude: SharedValue<number>;
  color: string;
  visible: boolean;
}

const BAR_COUNT = 32;

export function TopWaveform({ amplitude, color, visible }: TopWaveformProps) {
  const { width } = useWindowDimensions();

  if (!visible) return null;

  return (
    <View style={[styles.container, { width }]}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <WaveBar key={i} index={i} total={BAR_COUNT} amplitude={amplitude} color={color} />
      ))}
    </View>
  );
}

function WaveBar({ index, total, amplitude, color }: {
  index: number;
  total: number;
  amplitude: SharedValue<number>;
  color: string;
}) {
  const animStyle = useAnimatedStyle(() => {
    const t = Date.now() / 1000;
    const progress = index / total;
    const wave =
      Math.abs(Math.sin(progress * Math.PI * 3 + t * 4)) * 0.6 +
      Math.abs(Math.sin(progress * Math.PI * 7 + t * 2.5)) * 0.4;
    const h = 4 + wave * amplitude.value * 28;
    return { height: h, opacity: 0.5 + wave * 0.5 };
  });

  return (
    <Animated.View
      style={[styles.bar, { backgroundColor: color }, animStyle]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 40,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 2,
  },
});
