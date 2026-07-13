import React from 'react';
import {
  Circle,
  RadialGradient,
  Group,
  BlurMask,
  vec,
  Paint,
} from '@shopify/react-native-skia';
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

export function GlowOrb({ cx, cy, baseRadius, amplitude, clock, primaryColor, secondaryColor }: GlowOrbProps) {
  // Breathing radius — oscillates slowly
  const radius = useDerivedValue(() => {
    const breath = 1 + 0.04 * Math.sin((clock.value / 3200) * Math.PI * 2);
    const pulse = 1 + amplitude.value * 0.22;
    return baseRadius * breath * pulse;
  });

  // Outer aura opacity breathes gently
  const auraOpacity = useDerivedValue(() => {
    const base = 0.30 + amplitude.value * 0.15;
    const breath = Math.sin((clock.value / 3200) * Math.PI * 2) * 0.05;
    return Math.min(0.6, base + breath);
  });

  const midOpacity = useDerivedValue(() => 0.5 + amplitude.value * 0.2);

  return (
    <Group>
      {/* Outer aura */}
      <Group opacity={auraOpacity}>
        <Circle cx={cx} cy={cy} r={baseRadius * 3.2}>
          <RadialGradient
            c={vec(cx, cy)}
            r={baseRadius * 3.2}
            colors={[primaryColor + '88', 'transparent']}
          />
          <BlurMask blur={60} style="normal" />
        </Circle>
      </Group>

      {/* Mid glow */}
      <Group opacity={midOpacity}>
        <Circle cx={cx} cy={cy} r={baseRadius * 1.8}>
          <RadialGradient
            c={vec(cx, cy)}
            r={baseRadius * 1.8}
            colors={[primaryColor + 'CC', secondaryColor + '44']}
          />
          <BlurMask blur={30} style="normal" />
        </Circle>
      </Group>

      {/* Core sphere */}
      <Circle cx={cx} cy={cy} r={radius}>
        <RadialGradient
          c={vec(cx, cy)}
          r={baseRadius}
          colors={['#FFFFFF99', primaryColor + 'DD', secondaryColor + '88']}
        />
        <BlurMask blur={8} style="normal" />
      </Circle>

      {/* Rim highlight */}
      <Circle cx={cx} cy={cy} r={radius} style="stroke" strokeWidth={1.5}>
        <Paint color={secondaryColor + '99'} />
      </Circle>
    </Group>
  );
}
