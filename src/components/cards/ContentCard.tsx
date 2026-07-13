import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '../../theme/colors';
import { Springs, Durations } from '../../theme/motion';

interface ContentCardProps {
  id: string;
  x: number;
  y: number;
  children: React.ReactNode;
  accentColor?: string;
  zIndex?: number;
  onPress?: (id: string) => void;
  onDismiss?: (id: string) => void;
  entranceDelay?: number;
}

export function ContentCard({
  id,
  x,
  y,
  children,
  accentColor = Colors.accent,
  zIndex = 20,
  onPress,
  onDismiss,
  entranceDelay = 0,
}: ContentCardProps) {
  const translateX = useSharedValue(x);
  const translateY = useSharedValue(y);
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  const driftX = useSharedValue(0);
  const driftY = useSharedValue(0);

  useEffect(() => {
    // Entrance animation
    const delay = entranceDelay;
    setTimeout(() => {
      scale.value = withSpring(1, Springs.card);
      opacity.value = withTiming(1, { duration: Durations.base });
    }, delay);
  }, []);

  // Update position when slot changes
  useEffect(() => {
    translateX.value = withSpring(x, Springs.soft);
    translateY.value = withSpring(y, Springs.soft);
  }, [x, y]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value + driftX.value },
      { translateY: translateY.value + driftY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const handleDismiss = () => {
    scale.value = withTiming(0.85, { duration: Durations.fast });
    opacity.value = withTiming(0, { duration: Durations.base }, (done) => {
      if (done && onDismiss) runOnJS(onDismiss)(id);
    });
  };

  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      driftX.value = e.translationX * 0.4;
      driftY.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      const dist = Math.sqrt(e.translationX ** 2 + e.translationY ** 2);
      if (dist > 80) {
        runOnJS(handleDismiss)();
      } else {
        driftX.value = withSpring(0, Springs.soft);
        driftY.value = withSpring(0, Springs.soft);
      }
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View style={[styles.container, { zIndex }, animStyle]}>
        <Pressable onPress={() => onPress?.(id)} style={styles.pressable}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}
          <View style={[styles.inner, Platform.OS === 'android' && styles.innerAndroid]}>
            <View style={[styles.borderAccent, { borderColor: accentColor + '55' }]} />
            {children}
          </View>
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 200,
    borderRadius: 20,
    overflow: 'hidden',
  },
  pressable: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  inner: {
    padding: 14,
    backgroundColor: Colors.cardBackground,
  },
  innerAndroid: {
    backgroundColor: 'rgba(10,8,30,0.82)',
  },
  borderAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: 1,
  },
});
