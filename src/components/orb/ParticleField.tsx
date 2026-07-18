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
  // depth: 0=far(slow,dim) 1=close(fast,bright)
  depth: number;
  size: number;
  // drift direction in radians — each particle drifts lazily its own way
  driftAngle: number;
  driftSpeed: number;
  twinkleFreq: number;
  phase: number;
  baseOpacity: number;
}

const COLORS = ['#A78BFA', '#67E8F9', '#C4B5FD', '#E0E7FF', '#F0ABFC'];

export function ParticleField({ width, height, count = 80, intensity, clock }: ParticleFieldProps) {
  const particles = useMemo<FieldParticle[]>(() => {
    return Array.from({ length: count }, () => {
      const depth = Math.random();
      return {
        x0: Math.random() * width,
        y0: Math.random() * height,
        depth,
        // Far particles tiny (0.4px), close ones up to 1.6px — never big blobs
        size: 0.4 + depth * 1.2,
        driftAngle: Math.random() * Math.PI * 2,
        // Far particles drift very slowly — creates parallax depth
        driftSpeed: 1.5 + depth * 5,
        twinkleFreq: 0.15 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        // Far particles dimmer, close ones brighter but still subtle
        baseOpacity: 0.04 + depth * 0.35,
      };
    });
  }, [count, width, height]);

  return (
    <Group>
      {particles.map((p, i) => {
        const color = COLORS[i % COLORS.length];

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cx = useDerivedValue(() => {
          const t = clock.value / 1000;
          const x = p.x0 + Math.cos(p.driftAngle) * t * p.driftSpeed;
          // Wrap around screen edges
          return ((x % width) + width) % width;
        });

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cy = useDerivedValue(() => {
          const t = clock.value / 1000;
          const y = p.y0 + Math.sin(p.driftAngle) * t * p.driftSpeed;
          return ((y % height) + height) % height;
        });

        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity = useDerivedValue(() => {
          const t = clock.value / 1000;
          const twinkle = 0.5 + 0.5 * Math.sin(t * p.twinkleFreq + p.phase);
          // Multiply by intensity so they fade in during splash
          return p.baseOpacity * twinkle * Math.max(0.2, intensity.value);
        });

        return (
          <Group key={i} opacity={opacity}>
            <Circle cx={cx} cy={cy} r={p.size} color={color} />
          </Group>
        );
      })}
    </Group>
  );
}
