import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Share,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/useTheme';
import { useTranscriptStore, type Turn } from '../../store/transcriptStore';
import { useGatewayStore } from '../../store/gatewayStore';

const RTL_REGEX = /[֐-׿؀-ۿ]/;

function isRTL(text: string): boolean {
  return RTL_REGEX.test(text);
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ConversationSheetProps {
  visible: boolean;
  onClose: () => void;
  onReplay?: (text: string) => void;
  mode: 'voice' | 'chat';
}

export function ConversationSheet({ visible, onClose, onReplay, mode }: ConversationSheetProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { finalizedTurns, liveText, liveSpeaker } = useTranscriptStore();
  const { activeProfile } = useGatewayStore();
  const agentName = activeProfile()?.name ?? 'Agent';
  const scrollRef = useRef<ScrollView>(null);

  const translateY = useSharedValue(900);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 24, stiffness: 200 });
      backdropOpacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = withSpring(900, { damping: 24, stiffness: 200 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    }
  }, [finalizedTurns.length, liveText, visible]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const turns = [...finalizedTurns].reverse();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 12, backgroundColor: theme.navBackground, borderColor: theme.navBorder },
          sheetStyle,
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: theme.textTertiary }]} />

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>Conversation</Text>
          <View style={styles.headerRight}>
            {finalizedTurns.length > 0 && (
              <View style={[styles.badge, { backgroundColor: theme.accent + '22' }]}>
                <Text style={[styles.badgeText, { color: theme.accent }]}>{finalizedTurns.length}</Text>
              </View>
            )}
            <Pressable onPress={onClose} hitSlop={16} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: theme.textTertiary }]}>✕</Text>
            </Pressable>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {turns.length === 0 && !liveText && (
            <Text style={[styles.empty, { color: theme.textTertiary }]}>
              Start speaking to begin the conversation
            </Text>
          )}

          {turns.map((turn) => (
            <Bubble
              key={turn.id}
              turn={turn}
              theme={theme}
              mode={mode}
              agentName={agentName}
              onReplay={onReplay}
            />
          ))}

          {liveText ? (
            <Bubble
              key="live"
              turn={{ id: 'live', speaker: liveSpeaker, text: liveText, ts: Date.now() }}
              theme={theme}
              mode={mode}
              agentName={agentName}
              live
            />
          ) : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

interface BubbleProps {
  turn: Turn;
  theme: any;
  mode: 'voice' | 'chat';
  agentName: string;
  live?: boolean;
  onReplay?: (text: string) => void;
}

function Bubble({ turn, theme, mode, agentName, live, onReplay }: BubbleProps) {
  const isUser = turn.speaker === 'user';
  const rtl = isRTL(turn.text);

  function handleCopy() {
    Share.share({ message: turn.text });
  }

  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {/* AI avatar */}
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <Text style={styles.avatarText}>{agentName.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      <View style={[styles.bubbleCol, isUser ? styles.bubbleColUser : styles.bubbleColAI]}>
        {/* Agent name label */}
        {!isUser && (
          <Text style={[styles.senderLabel, { color: theme.textTertiary }]}>{agentName}</Text>
        )}

        {/* Bubble */}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAI,
            {
              backgroundColor: isUser ? theme.accent : theme.cardBackground,
              borderColor: isUser ? 'transparent' : theme.cardBorder,
              opacity: live ? 0.65 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isUser ? '#ffffff' : theme.textPrimary },
              rtl && styles.rtlText,
            ]}
          >
            {turn.text}{live ? ' ▌' : ''}
          </Text>
        </View>

        {/* Meta row */}
        {!live && (
          <View style={[styles.metaRow, isUser ? styles.metaRowUser : styles.metaRowAI]}>
            <Text style={[styles.metaTime, { color: theme.textTertiary }]}>
              {formatTime(turn.ts)}
            </Text>
            <Pressable onPress={handleCopy} hitSlop={8}>
              <Text style={[styles.copyBtn, { color: theme.textTertiary }]}>⎘ Copy</Text>
            </Pressable>
            {!isUser && mode === 'chat' && onReplay && (
              <Pressable onPress={() => onReplay(turn.text)} hitSlop={8}>
                <Text style={[styles.replayBtn, { color: theme.accent }]}>🔊</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    height: '85%',
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
    opacity: 0.4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: 0.2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 18 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 16,
    flexGrow: 1,
  },
  empty: {
    textAlign: 'center',
    fontSize: 14,
    marginTop: 60,
    opacity: 0.5,
    lineHeight: 22,
  },

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI: { justifyContent: 'flex-start' },

  avatar: {
    width: 30, height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  bubbleCol: { gap: 4 },
  bubbleColUser: { maxWidth: '75%', alignItems: 'flex-end' },
  bubbleColAI: { maxWidth: '80%', alignItems: 'flex-start' },

  senderLabel: { fontSize: 11, fontWeight: '600', marginLeft: 4, marginBottom: 2 },

  bubble: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderBottomLeftRadius: 4 },

  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  metaRowUser: { justifyContent: 'flex-end' },
  metaRowAI: { justifyContent: 'flex-start' },
  metaTime: { fontSize: 10, opacity: 0.55 },
  copyBtn: { fontSize: 11, fontWeight: '500' },
  replayBtn: { fontSize: 13 },
});
