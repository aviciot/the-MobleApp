import React from 'react';
import { Path, Group, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

interface OrbWaveformProps {
  cx: number;
  cy: number;
  radius: number;
  amplitude: SharedValue<number>;
  clock: SharedValue<number>;
  color: string;
}

const SAMPLES = 32;

export function OrbWaveform({ cx, cy, radius, amplitude, clock, color }: OrbWaveformProps) {
  const wavePathA = useDerivedValue(() => {
    const amp = amplitude.value;
    const t = clock.value / 1000;
    const path = Skia.Path.Make();
    const startX = cx - radius * 0.8;
    const endX = cx + radius * 0.8;
    const step = (endX - startX) / SAMPLES;

    for (let i = 0; i <= SAMPLES; i++) {
      const x = startX + i * step;
      const progress = i / SAMPLES;
      const y =
        cy +
        Math.sin(progress * Math.PI * 4 + t * 2.1) * amp * radius * 0.45 +
        Math.sin(progress * Math.PI * 7 + t * 1.3) * amp * radius * 0.18 +
        Math.sin(t * 0.4) * radius * 0.04; // idle heartbeat

      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    return path;
  });

  // Second harmonic, phase offset
  const wavePathB = useDerivedValue(() => {
    const amp = amplitude.value * 0.6;
    const t = clock.value / 1000;
    const path = Skia.Path.Make();
    const startX = cx - radius * 0.8;
    const endX = cx + radius * 0.8;
    const step = (endX - startX) / SAMPLES;

    for (let i = 0; i <= SAMPLES; i++) {
      const x = startX + i * step;
      const progress = i / SAMPLES;
      const y =
        cy +
        Math.sin(progress * Math.PI * 3 + t * 1.7 + 1.2) * amp * radius * 0.35 +
        Math.sin(progress * Math.PI * 6 + t * 2.5) * amp * radius * 0.12;

      if (i === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    }
    return path;
  });

  return (
    <Group>
      <Path path={wavePathA} color={color + 'BB'} style="stroke" strokeWidth={1.5} />
      <Path path={wavePathB} color={color + '66'} style="stroke" strokeWidth={1} />
    </Group>
  );
}
