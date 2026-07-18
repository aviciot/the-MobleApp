import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
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
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    const t = setTimeout(() => {
      scale.value = withSpring(1, Springs.card);
      opacity.value = withTiming(1, { duration: Durations.base });
    }, index * 60);
    return () => clearTimeout(t);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  // Wide cards: image, text. Narrow: file, status, chart
  const isWide = card.type === 'image' || card.type === 'text';

  return (
    <Animated.View style={[styles.card, isWide ? styles.cardWide : styles.cardNarrow, animStyle]}>
      <Pressable style={styles.cardInner} onLongPress={() => onDismiss(card.id)}>
        <CardContent card={card} />
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
              <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.accentBlue + '22' }]} />
            )}
          </View>
          <Text style={styles.imageLabel}>{card.fileName ?? 'image.jpg'}</Text>
          <Text style={styles.imageSub}>JPG • {card.sizeBytes ? `${(card.sizeBytes/1024/1024).toFixed(1)} MB` : '2.4 MB'}</Text>
        </View>
      );

    case 'file':
      return (
        <View style={styles.fileCard}>
          <View style={styles.fileIconBox}>
            <Text style={styles.fileIconText}>📄</Text>
          </View>
          <Text style={styles.fileName} numberOfLines={1}>{card.fileName ?? 'document'}</Text>
          <Text style={styles.fileSub}>{card.sizeBytes ? `${(card.sizeBytes/1024/1024).toFixed(1)} MB` : ''} • {(card.mimeType ?? 'file').split('/').pop()?.toUpperCase()}</Text>
        </View>
      );

    case 'text':
      return (
        <View style={styles.textCard}>
          <View style={styles.textHeader}>
            <Text style={styles.textIcon}>✦</Text>
            <Text style={styles.textTitle}>{card.title ?? 'Summary'}</Text>
          </View>
          <Text style={styles.textBody} numberOfLines={4}>{card.markdown ?? ''}</Text>
          <Text style={styles.textTime}>just now</Text>
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
          {card.series && (
            <View style={styles.chartBars}>
              {card.series.map((v, i) => {
                const peak = Math.max(...(card.series ?? [1]));
                return (
                  <View key={i} style={[styles.chartBar, { height: (v / peak) * 32, backgroundColor: Colors.accentBlue + 'BB' }]} />
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
            <View style={[styles.statusDot, { backgroundColor: card.level === 'success' ? '#00FF88' : Colors.accentBlue }]} />
            <View>
              <Text style={styles.statusTitle}>{card.text ?? 'Status'}</Text>
              <Text style={styles.statusSub}>All systems up to date</Text>
            </View>
          </View>
          <View style={styles.statusCheck}>
            <Text style={{ color: '#00FF88', fontSize: 14 }}>✓</Text>
          </View>
        </View>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(150,100,255,0.2)',
    backgroundColor: 'rgba(12,10,35,0.88)',
  },
  cardWide: { width: '47%' },
  cardNarrow: { width: '47%' },
  cardInner: { padding: 14 },

  // Image card
  imageCard: {},
  imagePlaceholder: {
    width: '100%', aspectRatio: 4/3,
    borderRadius: 10, overflow: 'hidden',
    backgroundColor: '#111128', marginBottom: 8,
  },
  imageLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  imageSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },

  // File card
  fileCard: { alignItems: 'flex-start' },
  fileIconBox: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: 'rgba(123,47,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  fileIconText: { fontSize: 22 },
  fileName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  fileSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 3 },

  // Text card
  textCard: {},
  textHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  textIcon: { color: Colors.accent, fontSize: 12 },
  textTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  textBody: { color: Colors.textPrimary, fontSize: 12, lineHeight: 18 },
  textTime: { color: Colors.textTertiary, fontSize: 10, marginTop: 8 },

  // Chart card
  chartCard: {},
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  chartIcon: { color: Colors.accentBlue, fontSize: 14 },
  chartTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  chartValue: { color: Colors.textPrimary, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  chartSub: { color: Colors.textTertiary, fontSize: 11, marginBottom: 8 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 36, gap: 3 },
  chartBar: { flex: 1, borderRadius: 2, minHeight: 3 },

  // Status card
  statusCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' },
  statusSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },
  statusCheck: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: '#00FF8844',
    alignItems: 'center', justifyContent: 'center',
  },
});
