import React from 'react';
import { Circle, Group } from '@shopify/react-native-skia';
import type { SharedValue } from 'react-native-reanimated';
import { useDerivedValue } from 'react-native-reanimated';

interface GlowOrbProps {
  cx: number;
  cy: number;
  baseRadius: number;
  amplitude: SharedValue<number>;
  clock: SharedValue<number>;
  primaryColor: string;
  secondaryColor: string;
}

// Rim assembled from white dust dots — dense, varied, slightly scattered
const RIM_DOTS = Array.from({ length: 220 }, (_, i) => ({
  angle: (i / 220) * Math.PI * 2 + (Math.random() - 0.5) * 0.08,
  visible: Math.random() > 0.15,
  size: Math.random() < 0.1 ? 1.8 + Math.random() * 1.2 : 0.5 + Math.random() * 0.8,
  radiusOffset: (Math.random() - 0.5) * 6,
  twinkleSpeed: 0.3 + Math.random() * 1.2,
  twinklePhase: Math.random() * Math.PI * 2,
})).filter(d => d.visible);

export function GlowOrb({ cx, cy, baseRadius, amplitude, clock }: GlowOrbProps) {
  const radius = useDerivedValue(() => {
    const breath = 1 + 0.03 * Math.sin((clock.value / 3200) * Math.PI * 2);
    const pulse = 1 + amplitude.value * 0.1;
    return baseRadius * breath * pulse;
  });

  const clockSecs = useDerivedValue(() => clock.value / 1000);

  return (
    <Group>
      {RIM_DOTS.map((dot, i) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity = useDerivedValue(() => {
          const t = clockSecs.value;
          // No breathing — just twinkle
          return 0.4 + 0.6 * Math.abs(Math.sin(t * dot.twinkleSpeed + dot.twinklePhase));
        });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const dcx = useDerivedValue(() => cx + Math.cos(dot.angle) * (radius.value + dot.radiusOffset));
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const dcy = useDerivedValue(() => cy + Math.sin(dot.angle) * (radius.value + dot.radiusOffset));
        return (
          <Group key={i} opacity={opacity}>
            <Circle cx={dcx} cy={dcy} r={dot.size} color="#FFFFFF" />
          </Group>
        );
      })}
    </Group>
  );
}
