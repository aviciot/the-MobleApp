import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable, Linking } from 'react-native';

function getMimeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗜';
  if (mimeType.includes('json') || mimeType.includes('xml')) return '📋';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  return '📎';
}
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useCardStore } from '../../store/cardStore';
import { Colors } from '../../theme/colors';
import { Springs, Durations } from '../../theme/motion';
import type { CardModel } from '../../store/cardStore';

export function GridCardSystem() {
  const cards = useCardStore((s) => s.cards);
  const removeCard = useCardStore((s) => s.removeCard);

  if (cards.length === 0) return null;

  // Layout: pair cards into rows — image+file, text+chart, status alone
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.grid}
      showsVerticalScrollIndicator={false}
    >
      {cards.map((card, i) => (
        <GridCard key={card.id} card={card} index={i} onDismiss={removeCard} />
      ))}
    </ScrollView>
  );
}

function GridCard({ card, index, onDismiss }: { card: CardModel; index: number; onDismiss: (id: string) => void }) {
  const scale = useSharedValue(0.88);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    const t = setTimeout(() => {
      scale.value = withSpring(1, Springs.card);
      opacity.value = withTiming(1, { duration: Durations.base });
    }, index * 55);
    return () => clearTimeout(t);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const isWide = card.type === 'image' || card.type === 'text';

  return (
    <Animated.View style={[styles.card, isWide ? styles.cardWide : styles.cardNarrow, animStyle]}>
      <Pressable style={styles.cardInner} onPress={() => onDismiss(card.id)}>
        <CardContent card={card} />
        <Text style={styles.dismissX}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

function CardContent({ card }: { card: CardModel }) {
  switch (card.type) {
    case 'image':
      return (
        <View style={styles.imageCard}>
          <View style={styles.imagePlaceholder}>
            {card.uri ? (
              <Image source={{ uri: card.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              // Purple-blue mountain lake placeholder matching reference
              <View style={[StyleSheet.absoluteFill, styles.imagePlaceholderBg]}>
                <View style={styles.imagePlaceholderOverlay} />
                <View style={styles.imageMountainHint} />
              </View>
            )}
            {/* Image icon top-left */}
            <View style={styles.imageIconBadge}>
              <Text style={styles.imageIconText}>⬜</Text>
            </View>
          </View>
          <Text style={styles.imageLabel}>{card.fileName ?? 'Mountain Lake'}</Text>
          <Text style={styles.imageSub}>JPG • {card.sizeBytes ? `${(card.sizeBytes / 1024 / 1024).toFixed(1)} MB` : '2.4 MB'}</Text>
        </View>
      );

    case 'file':
      return (
        <View style={styles.fileCard}>
          <View style={styles.fileIconBox}>
            <Text style={styles.fileIconEmoji}>{getMimeIcon(card.mimeType ?? '')}</Text>
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>{card.fileName ?? 'document'}</Text>
            <Text style={styles.fileSub}>
              {card.sizeBytes ? `${(card.sizeBytes / 1024 / 1024).toFixed(1)} MB • ` : ''}{(card.mimeType ?? 'application/octet-stream').split('/').pop()?.toUpperCase()}
            </Text>
          </View>
        </View>
      );

    case 'text':
      return (
        <View style={styles.textCard}>
          <View style={styles.textHeader}>
            <Text style={styles.textIcon}>✦</Text>
            <Text style={styles.textTitle}>{card.title ?? 'Summary'}</Text>
          </View>
          <Text style={styles.textBody} numberOfLines={5}>{card.markdown ?? ''}</Text>
          <Text style={styles.textTime}>2 min ago</Text>
        </View>
      );

    case 'chart':
      return (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartIcon}>↗</Text>
            <Text style={styles.chartTitle}>Insight</Text>
          </View>
          <Text style={styles.chartValue}>{card.chartLabel ?? '+0%'}</Text>
          <Text style={styles.chartSub}>vs Q1 2024</Text>
          {/* Line chart approximation using bars with a curve-like height */}
          {card.series && (
            <View style={styles.chartLineArea}>
              {card.series.map((v, i) => {
                const peak = Math.max(...(card.series ?? [1]));
                const h = (v / peak) * 40;
                return (
                  <View key={i} style={styles.chartLineCol}>
                    <View style={[styles.chartLineDot, { marginTop: 40 - h }]} />
                    {i < card.series!.length - 1 && (
                      <View style={[styles.chartLineBar, { height: 1, marginTop: -1 }]} />
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      );

    case 'status':
      return (
        <View style={styles.statusCard}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, { backgroundColor: card.level === 'success' ? '#22DD88' : Colors.accentBlue }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>{card.text ?? 'Status'}</Text>
              <Text style={styles.statusSub}>All systems up to date</Text>
            </View>
          </View>
          <View style={styles.statusCheck}>
            <Text style={{ color: '#22DD88', fontSize: 13 }}>✓</Text>
          </View>
        </View>
      );

    default:
      return null;
  }
}

const CARD_GAP = 10;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    gap: CARD_GAP,
    paddingBottom: 8,
  },

  // Card shell — dark glass with glowing purple border
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(120,80,255,0.35)',
    backgroundColor: 'rgba(10,8,32,0.90)',
    // Soft glow shadow
    shadowColor: '#7B4FFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  cardWide: { width: '47%' },
  cardNarrow: { width: '47%' },
  cardInner: { padding: 13 },
  dismissX: {
    position: 'absolute',
    top: 6,
    right: 8,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
  },

  // ── Image card ──────────────────────────────────────────
  imageCard: {},
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0a0820',
    marginBottom: 9,
    justifyContent: 'flex-end',
  },
  imagePlaceholderBg: {
    backgroundColor: '#1a1040',
  },
  imagePlaceholderOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(80,40,180,0.45)',
  },
  imageMountainHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: 'rgba(30,15,80,0.8)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 20,
  },
  imageIconBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 6,
    padding: 4,
  },
  imageIconText: { fontSize: 11, color: '#fff' },
  imageLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', letterSpacing: 0.1 },
  imageSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },

  // ── File card ────────────────────────────────────────────
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  fileIconBox: { width: 42, alignItems: 'center', justifyContent: 'center' },
  fileIconEmoji: { fontSize: 30 },
  fileInfo: { flex: 1 },
  fileName: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  fileSub: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 3 },

  // ── Text card ────────────────────────────────────────────
  textCard: {},
  textHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 9 },
  textIcon: { color: '#7B6FFF', fontSize: 13 },
  textTitle: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  textBody: { color: '#FFFFFF', fontSize: 12, lineHeight: 18, opacity: 0.88 },
  textTime: { color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 9 },

  // ── Chart card ───────────────────────────────────────────
  chartCard: { minHeight: 110 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  chartIcon: { color: '#5B9EFF', fontSize: 14 },
  chartTitle: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  chartValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -1, lineHeight: 34 },
  chartSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8 },
  chartLineArea: { flexDirection: 'row', alignItems: 'flex-end', height: 42, gap: 2 },
  chartLineCol: { flex: 1, alignItems: 'center', height: 42, justifyContent: 'flex-end' },
  chartLineDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#5B9EFF' },
  chartLineBar: { width: '100%', backgroundColor: 'rgba(91,158,255,0.4)' },

  // ── Status card ──────────────────────────────────────────
  statusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '500' },
  statusSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
  statusCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(34,221,136,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
