import React, { useMemo } from 'react';
import { Circle, Group, Blur } from '@shopify/react-native-skia';
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

interface Mote {
  angle: number;
  dist: number;
  bx: number;
  by: number;
  r: number;
  driftFx: number;
  driftFy: number;
  driftAx: number;
  driftAy: number;
  driftPx: number;
  driftPy: number;
  twinkleSpeed: number;
  twinklePhase: number;
  baseOpacity: number;
}

export function OrbParticles({
  cx, cy, orbitRadius, count = 300,
  amplitude, energy, clock,
}: OrbParticlesProps) {

  const motes = useMemo<Mote[]>(() => {
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      // Bias toward orb rim — denser close, sparser further
      const u = Math.random();
      const dist = orbitRadius * (0.82 + Math.pow(u, 0.5) * 0.85);
      return {
        angle,
        dist,
        bx: cx + Math.cos(angle) * dist,
        by: cy + Math.sin(angle) * dist,
        // Sub-pixel to near-pixel radii — blend into dust, not dots
        r: 0.25 + Math.random() * 1.1,
        driftFx: 0.015 + Math.random() * 0.055,
        driftFy: 0.015 + Math.random() * 0.055,
        driftAx: 3 + Math.random() * 9,
        driftAy: 3 + Math.random() * 9,
        driftPx: Math.random() * Math.PI * 2,
        driftPy: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.05 + Math.random() * 0.28,
        twinklePhase: Math.random() * Math.PI * 2,
        baseOpacity: 0.2 + Math.random() * 0.8,
      };
    });
  }, [count, orbitRadius, cx, cy]);

  return (
    /*
     * Group with layer=true renders all children into an offscreen bitmap,
     * then the Blur child filters that entire bitmap before compositing.
     * This gives a gaussian-blurred dust cloud effect WITHOUT flooding orb
     * interior (unlike BlurMask "normal" on Android which fills bounding box).
     */
    <Group layer={true}>
      <Blur blur={1.6} />
      {motes.map((m, i) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cx_ = useDerivedValue(() => {
          const t = clock.value / 1000;
          const dx = Math.sin(t * m.driftFx + m.driftPx) * m.driftAx;
          const breathe = energy.value * m.dist * 0.055;
          return m.bx + dx + Math.cos(m.angle) * breathe;
        });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const cy_ = useDerivedValue(() => {
          const t = clock.value / 1000;
          const dy = Math.sin(t * m.driftFy + m.driftPy) * m.driftAy;
          const breathe = energy.value * m.dist * 0.055;
          return m.by + dy + Math.sin(m.angle) * breathe;
        });
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity = useDerivedValue(() => {
          const t = clock.value / 1000;
          const twinkle = 0.25 + 0.75 * Math.abs(Math.sin(t * m.twinkleSpeed + m.twinklePhase));
          const breath = 0.6 + energy.value * 0.4;
          return m.baseOpacity * twinkle * breath;
        });

        return (
          <Group key={i} opacity={opacity}>
            <Circle cx={cx_} cy={cy_} r={m.r} color="#DDE8FF" />
          </Group>
        );
      })}
    </Group>
  );
}
