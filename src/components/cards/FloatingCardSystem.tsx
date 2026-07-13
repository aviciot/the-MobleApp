import React, { useMemo } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useCardStore } from '../../store/cardStore';
import { ImageCard, FileCard, TextCard, ChartCard, StatusCard } from './CardVariants';

interface FloatingCardSystemProps {
  orbCx: number;
  orbCy: number;
  orbRadius: number;
  onDismiss?: (id: string) => void;
  onPress?: (id: string) => void;
}

// Compute 6 slot positions: 3 left, 3 right of the orb
function computeSlots(cx: number, cy: number, orbitRx: number, orbitRy: number) {
  const angles = [200, 160, 235, 125, 270, 90].map((d) => (d * Math.PI) / 180);
  return angles.map((a) => ({
    x: cx + Math.cos(a) * orbitRx - 100, // -100 to center 200-wide card
    y: cy + Math.sin(a) * orbitRy - 60,  // -60 to center card height estimate
  }));
}

export function FloatingCardSystem({ orbCx, orbCy, orbRadius, onDismiss, onPress }: FloatingCardSystemProps) {
  const { width, height } = useWindowDimensions();
  const cards = useCardStore((s) => s.cards);
  const removeCard = useCardStore((s) => s.removeCard);

  const orbitRx = Math.min(width * 0.42, 160);
  const orbitRy = Math.min(height * 0.28, 140);

  const slots = useMemo(
    () => computeSlots(orbCx, orbCy, orbitRx, orbitRy),
    [orbCx, orbCy, orbitRx, orbitRy],
  );

  const handleDismiss = (id: string) => {
    removeCard(id);
    onDismiss?.(id);
  };

  const renderCard = (card: typeof cards[0], index: number) => {
    const slot = slots[index % slots.length];
    const props = {
      card,
      x: slot.x,
      y: slot.y,
      onPress,
      onDismiss: handleDismiss,
      entranceDelay: index * 80,
    };

    switch (card.type) {
      case 'image': return <ImageCard key={card.id} {...props} />;
      case 'file': return <FileCard key={card.id} {...props} />;
      case 'text': return <TextCard key={card.id} {...props} />;
      case 'chart': return <ChartCard key={card.id} {...props} />;
      case 'status': return <StatusCard key={card.id} {...props} />;
      default: return null;
    }
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {cards.map((card, i) => renderCard(card, i))}
    </View>
  );
}
