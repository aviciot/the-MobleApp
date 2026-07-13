import React, { useMemo } from 'react';
import { Circle, Group } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

interface ParticleFieldProps {
  width: number;
  height: number;
  count?: number;
  intensity: SharedValue<number>;
  clock: SharedValue<number>;
}

interface FieldParticle {
  x0: number;
  y0: number;
  depth: number;
  size: number;
  driftSpeed: number;
  twinkleFreq: number;
  phase: number;
}

export function ParticleField({ width, height, count = 60, intensity, clock }: ParticleFieldProps) {
  const particles = useMemo<FieldParticle[]>(() => {
    return Array.from({ length: count }, () => ({
      x0: Math.random() * width,
      y0: Math.random() * height,
      depth: 0.3 + Math.random() * 0.7,
      size: 0.5 + Math.random() * 1.8,
      driftSpeed: 0.008 + Math.random() * 0.015,
      twinkleFreq: 0.3 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count, width, height]);

  return (
    <Group>
      {particles.map((p, i) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cx = useDerivedValue(() => {
          const t = clock.value / 1000;
          return (p.x0 + t * p.driftSpeed * intensity.value * 20) % width;
        });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cy = useDerivedValue(() => {
          const t = clock.value / 1000;
          return (p.y0 - t * p.driftSpeed * intensity.value * 10 + height) % height;
        });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity = useDerivedValue(() => {
          const t = clock.value / 1000;
          const twinkle = 0.5 + 0.5 * Math.sin(t * p.twinkleFreq + p.phase);
          return intensity.value * p.depth * 0.6 * twinkle;
        });

        return (
          <Group key={i} opacity={opacity}>
            <Circle cx={cx} cy={cy} r={p.size * p.depth} color="#8866FF" />
          </Group>
        );
      })}
    </Group>
  );
}
