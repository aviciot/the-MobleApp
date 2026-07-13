import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Colors } from '../../theme/colors';
import { ContentCard } from './ContentCard';
import type { CardModel } from '../../store/cardStore';

interface CardProps {
  card: CardModel;
  x: number;
  y: number;
  onPress?: (id: string) => void;
  onDismiss?: (id: string) => void;
  entranceDelay?: number;
}

export function ImageCard({ card, x, y, onPress, onDismiss, entranceDelay }: CardProps) {
  return (
    <ContentCard id={card.id} x={x} y={y} accentColor={Colors.accentBlue} onPress={onPress} onDismiss={onDismiss} entranceDelay={entranceDelay}>
      <Text style={styles.typeLabel}>IMAGE</Text>
      <View style={styles.imageThumb}>
        {card.uri ? (
          <Image source={{ uri: card.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: Colors.accentBlue + '22' }]} />
        )}
      </View>
      <Text style={styles.fileName} numberOfLines={1}>{card.fileName ?? 'image.jpg'}</Text>
    </ContentCard>
  );
}

export function FileCard({ card, x, y, onPress, onDismiss, entranceDelay }: CardProps) {
  const sizeLabel = card.sizeBytes ? `${(card.sizeBytes / 1024 / 1024).toFixed(1)} MB` : '';
  return (
    <ContentCard id={card.id} x={x} y={y} accentColor={Colors.accent} onPress={onPress} onDismiss={onDismiss} entranceDelay={entranceDelay}>
      <Text style={styles.typeLabel}>FILE</Text>
      <View style={styles.fileRow}>
        <View style={[styles.fileIcon, { backgroundColor: Colors.accent + '33' }]}>
          <Text style={styles.fileExt}>{(card.mimeType ?? 'file').split('/').pop()?.slice(0, 3).toUpperCase()}</Text>
        </View>
        <View style={styles.fileMeta}>
          <Text style={styles.fileNameBold} numberOfLines={1}>{card.fileName ?? 'document'}</Text>
          <Text style={styles.fileSize}>{sizeLabel}</Text>
        </View>
      </View>
    </ContentCard>
  );
}

export function TextCard({ card, x, y, onPress, onDismiss, entranceDelay }: CardProps) {
  return (
    <ContentCard id={card.id} x={x} y={y} accentColor={Colors.accentPurple} onPress={onPress} onDismiss={onDismiss} entranceDelay={entranceDelay}>
      <Text style={styles.typeLabel}>SUMMARY</Text>
      {card.title ? <Text style={styles.cardTitle} numberOfLines={1}>{card.title}</Text> : null}
      <Text style={styles.cardText} numberOfLines={5}>{card.markdown ?? ''}</Text>
    </ContentCard>
  );
}

export function ChartCard({ card, x, y, onPress, onDismiss, entranceDelay }: CardProps) {
  const peak = card.series ? Math.max(...card.series) : 1;
  return (
    <ContentCard id={card.id} x={x} y={y} accentColor={Colors.accentMagenta} onPress={onPress} onDismiss={onDismiss} entranceDelay={entranceDelay}>
      <Text style={styles.typeLabel}>CHART</Text>
      <Text style={styles.chartLabel}>{card.chartLabel ?? ''}</Text>
      {card.series && (
        <View style={styles.chartArea}>
          {card.series.map((v, i) => (
            <View key={i} style={[styles.chartBar, { height: (v / peak) * 40, backgroundColor: Colors.accentMagenta + 'BB' }]} />
          ))}
        </View>
      )}
    </ContentCard>
  );
}

export function StatusCard({ card, x, y, onPress, onDismiss, entranceDelay }: CardProps) {
  const borderColor =
    card.level === 'success' ? '#00FF88' :
    card.level === 'error' ? '#FF4466' :
    Colors.accentBlue;

  return (
    <ContentCard id={card.id} x={x} y={y} accentColor={borderColor} onPress={onPress} onDismiss={onDismiss} entranceDelay={entranceDelay}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: borderColor }]} />
        <Text style={styles.statusText}>{card.text ?? 'Status'}</Text>
      </View>
    </ContentCard>
  );
}

const styles = StyleSheet.create({
  typeLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: Colors.textTertiary,
    marginBottom: 8,
  },
  imageThumb: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111128',
    marginBottom: 8,
  },
  imagePlaceholder: {
    flex: 1,
    borderRadius: 12,
  },
  fileName: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileExt: {
    color: Colors.accent,
    fontSize: 9,
    fontWeight: '700',
  },
  fileMeta: {
    flex: 1,
  },
  fileNameBold: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  fileSize: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardText: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  chartLabel: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 44,
    gap: 3,
  },
  chartBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '500',
  },
});
