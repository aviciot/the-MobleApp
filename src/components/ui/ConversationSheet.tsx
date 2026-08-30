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

// Detects if the first strong character is RTL (Hebrew / Arabic)
const RTL_REGEX = /[֐-׿؀-ۿ]/;
function isRTL(text: string): boolean {
  return RTL_REGEX.test(text.trimStart().charAt(0));
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
      translateY.value = withSpring(0, { damping: 26, stiffness: 220 });
      backdropOpacity.value = withTiming(1, { duration: 180 });
    } else {
      translateY.value = withSpring(900, { damping: 26, stiffness: 220 });
      backdropOpacity.value = withTiming(0, { duration: 160 });
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
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
          { paddingBottom: insets.bottom + 8, backgroundColor: theme.background, borderColor: theme.cardBorder },
          sheetStyle,
        ]}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
          <View style={[styles.handle, { backgroundColor: theme.textTertiary }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={[styles.agentDot, { backgroundColor: theme.accent }]} />
              <Text style={[styles.agentName, { color: theme.textPrimary }]}>{agentName}</Text>
              {finalizedTurns.length > 0 && (
                <View style={[styles.countPill, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.countText, { color: theme.textTertiary }]}>{finalizedTurns.length}</Text>
                </View>
              )}
            </View>
            <Pressable onPress={onClose} hitSlop={16}>
              <Text style={[styles.closeX, { color: theme.textTertiary }]}>✕</Text>
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
            <View style={styles.emptyState}>
              <Text style={[styles.emptyIcon, { color: theme.textTertiary }]}>💬</Text>
              <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>No messages yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textTertiary }]}>
                Press the orb and start speaking
              </Text>
            </View>
          )}

          {turns.map((turn, i) => {
            const prevTurn = i > 0 ? turns[i - 1] : null;
            const showSender = !prevTurn || prevTurn.speaker !== turn.speaker;
            return (
              <Bubble
                key={turn.id}
                turn={turn}
                theme={theme}
                mode={mode}
                agentName={agentName}
                showSender={showSender}
                onReplay={onReplay}
              />
            );
          })}

          {liveText ? (
            <Bubble
              key="live"
              turn={{ id: 'live', speaker: liveSpeaker, text: liveText, ts: Date.now() }}
              theme={theme}
              mode={mode}
              agentName={agentName}
              showSender
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
  showSender: boolean;
  live?: boolean;
  onReplay?: (text: string) => void;
}

function Bubble({ turn, theme, mode, agentName, showSender, live, onReplay }: BubbleProps) {
  const isUser = turn.speaker === 'user';
  const rtl = isRTL(turn.text);

  function handleCopy() {
    Share.share({ message: turn.text });
  }

  return (
    <View style={[styles.messageGroup, isUser ? styles.messageGroupUser : styles.messageGroupAI]}>

      {/* Sender label — only shown when speaker changes */}
      {showSender && (
        <Text style={[
          styles.senderLabel,
          { color: theme.textTertiary },
          isUser ? styles.senderLabelUser : styles.senderLabelAI,
        ]}>
          {isUser ? 'You' : agentName}
        </Text>
      )}

      {/* Bubble + actions row */}
      <View style={[styles.bubbleWrapper, isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAI]}>

        {/* AI avatar — only on first message in a group */}
        {!isUser && showSender && (
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <Text style={styles.avatarText}>{agentName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {!isUser && !showSender && <View style={styles.avatarSpacer} />}

        <View style={[styles.bubbleCol, isUser ? styles.bubbleColUser : styles.bubbleColAI]}>
          {/* Bubble */}
          <View style={[
            styles.bubble,
            isUser ? [styles.bubbleUser, { backgroundColor: theme.accent }]
                   : [styles.bubbleAI, { backgroundColor: theme.cardBackground, borderColor: theme.cardBorder }],
            live && { opacity: 0.6 },
          ]}>
            <Text style={[
              styles.bubbleText,
              { color: isUser ? '#fff' : theme.textPrimary },
              rtl && styles.rtlText,
            ]}>
              {turn.text}{live ? ' ▌' : ''}
            </Text>
          </View>

          {/* Meta row */}
          {!live && (
            <View style={[styles.meta, isUser ? styles.metaUser : styles.metaAI]}>
              <Text style={[styles.metaTime, { color: theme.textTertiary }]}>
                {formatTime(turn.ts)}
              </Text>
              <Pressable onPress={handleCopy} hitSlop={10}>
                <Text style={[styles.copyIcon, { color: theme.textTertiary }]}>📋</Text>
              </Pressable>
              {!isUser && mode === 'chat' && onReplay && (
                <Pressable onPress={() => onReplay(turn.text)} hitSlop={10}>
                  <Text style={[styles.replayIcon, { color: theme.accent }]}>🔊</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const AVATAR_SIZE = 30;

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },

  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '88%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  handle: {
    width: 36, height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
    opacity: 0.35,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  agentDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  agentName: {
    fontSize: 16, fontWeight: '600', letterSpacing: 0.2,
  },
  countPill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10,
  },
  countText: { fontSize: 11, fontWeight: '600' },
  closeX: { fontSize: 18, fontWeight: '400' },

  scroll: { flex: 1 },
  scrollContent: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    gap: 2,
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: 8,
  },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptySubtitle: { fontSize: 13, opacity: 0.7 },

  // Message group — controls overall left/right alignment
  messageGroup: {
    marginVertical: 3,
  },
  messageGroupUser: { alignItems: 'flex-end' },
  messageGroupAI: { alignItems: 'flex-start' },

  senderLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 4,
    opacity: 0.6,
    textTransform: 'uppercase',
  },
  senderLabelUser: { marginRight: 4 },
  senderLabelAI: { marginLeft: AVATAR_SIZE + 8 },

  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    maxWidth: '85%',
  },
  bubbleWrapperUser: { flexDirection: 'row-reverse' },
  bubbleWrapperAI: { flexDirection: 'row' },

  avatar: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  avatarSpacer: { width: AVATAR_SIZE, flexShrink: 0 },

  bubbleCol: { flex: 1, gap: 3 },
  bubbleColUser: { alignItems: 'flex-end' },
  bubbleColAI: { alignItems: 'flex-start' },

  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  metaUser: { justifyContent: 'flex-end' },
  metaAI: { justifyContent: 'flex-start' },
  metaTime: { fontSize: 10, opacity: 0.55 },
  copyIcon: { fontSize: 12 },
  replayIcon: { fontSize: 12 },
});
