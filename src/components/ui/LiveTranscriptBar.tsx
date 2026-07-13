import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Durations, Springs } from '../../theme/motion';

interface LiveTranscriptBarProps {
  liveText: string;
  speaker: 'user' | 'ai';
  visible: boolean;
  isMuted: boolean;
  onMuteToggle?: () => void;
  onExpandHistory?: () => void;
}

export function LiveTranscriptBar({
  liveText,
  speaker,
  visible,
  isMuted,
  onMuteToggle,
  onExpandHistory,
}: LiveTranscriptBarProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);
  const dotOpacity = useSharedValue(1);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, Springs.soft);
      opacity.value = withTiming(1, { duration: Durations.base });
    } else {
      translateY.value = withTiming(100, { duration: Durations.base });
      opacity.value = withTiming(0, { duration: Durations.fast });
    }
  }, [visible]);

  // Dot pulse
  useEffect(() => {
    const interval = setInterval(() => {
      dotOpacity.value = withTiming(dotOpacity.value > 0.5 ? 0.2 : 1, { duration: 400 });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [liveText]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  const dotColor = speaker === 'user' ? Colors.accentBlue : Colors.accentPurple;

  return (
    <Animated.View style={[styles.container, { paddingBottom: insets.bottom + 8 }, barStyle]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={[styles.inner, Platform.OS === 'android' && styles.innerAndroid]}>
        {/* Speaking dot */}
        <Animated.View style={[styles.dot, { backgroundColor: dotColor }, dotStyle]} />

        {/* Live text */}
        <Pressable style={styles.textArea} onPress={onExpandHistory}>
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
          >
            <Text style={styles.liveText} numberOfLines={1}>
              {liveText || (speaker === 'user' ? 'Listening...' : 'Speaking...')}
            </Text>
          </ScrollView>
        </Pressable>

        {/* Mute button */}
        <Pressable onPress={onMuteToggle} style={styles.muteBtn}>
          <View style={[styles.muteDot, isMuted && styles.muteDotActive]}>
            <Text style={styles.muteIcon}>{isMuted ? '🔇' : '🎤'}</Text>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    minHeight: 56,
  },
  innerAndroid: {
    backgroundColor: 'rgba(5,5,16,0.92)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  textArea: {
    flex: 1,
    overflow: 'hidden',
  },
  liveText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '400',
  },
  muteBtn: {
    flexShrink: 0,
  },
  muteDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  muteDotActive: {
    backgroundColor: 'rgba(255,68,102,0.2)',
    borderColor: '#FF4466',
  },
  muteIcon: {
    fontSize: 16,
  },
});
