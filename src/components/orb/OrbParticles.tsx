import React, { useMemo } from 'react';
import { Circle, Group } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

interface OrbParticlesProps {
  cx: number;
  cy: number;
  orbitRadius: number;
  count?: number;
  amplitude: SharedValue<number>;
  energy: SharedValue<number>;
  clock: SharedValue<number>;
  color: string;
}

interface ParticleData {
  angleOffset: number;
  orbitSpeed: number;
  sizeSeed: number;
  radiusJitter: number;
  jitterFreq: number;
  phase: number;
}

export function OrbParticles({ cx, cy, orbitRadius, count = 16, amplitude, energy, clock, color }: OrbParticlesProps) {
  const particles = useMemo<ParticleData[]>(() => {
    return Array.from({ length: count }, (_, i) => ({
      angleOffset: (i / count) * Math.PI * 2,
      orbitSpeed: 0.3 + Math.random() * 0.4,
      sizeSeed: 1.5 + Math.random() * 2.5,
      radiusJitter: 6 + Math.random() * 10,
      jitterFreq: 0.5 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    }));
  }, [count]);

  // Render each particle individually (Skia doesn't have Atlas in all versions)
  return (
    <Group>
      {particles.map((p, i) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cx_ = useDerivedValue(() => {
          const t = clock.value / 1000;
          const angle = p.angleOffset + t * p.orbitSpeed * (0.5 + energy.value);
          const r = orbitRadius + Math.sin(t * p.jitterFreq + p.phase) * p.radiusJitter + amplitude.value * 18;
          return cx + Math.cos(angle) * r;
        });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cy_ = useDerivedValue(() => {
          const t = clock.value / 1000;
          const angle = p.angleOffset + t * p.orbitSpeed * (0.5 + energy.value);
          const r = orbitRadius + Math.sin(t * p.jitterFreq + p.phase) * p.radiusJitter + amplitude.value * 18;
          return cy + Math.sin(angle) * r;
        });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity = useDerivedValue(() => 0.3 + energy.value * 0.6);

        return (
          <Group key={i} opacity={opacity}>
            <Circle cx={cx_} cy={cy_} r={p.sizeSeed} color={color + 'DD'} />
          </Group>
        );
      })}
    </Group>
  );
}
