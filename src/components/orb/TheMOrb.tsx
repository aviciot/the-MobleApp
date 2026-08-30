import React, { useEffect } from 'react';
import {
  Fill,
  Group,
  Shader,
} from '@shopify/react-native-skia';
import {
  useDerivedValue,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { orbEffect } from './theMOrbShader';
import { spaceBackgroundEffect } from './spaceBackgroundShader';
import { HolographicLogo } from './HolographicLogo';
import { useTheme } from '../../theme/useTheme';
import type { TheMOrbProps, OrbMode } from './types';
import type { RGB } from '../../theme/themes';

const MODE_PARAMS: Record<OrbMode, { plasma: number; rim: number; dust: number; modeF: number; electric: number }> = {
  idle:         { plasma: 0.40, rim: 0.55, dust: 0.45, modeF: 0, electric: 0.0 },
  listening:    { plasma: 0.70, rim: 0.80, dust: 0.70, modeF: 1, electric: 0.8 },
  userSpeaking: { plasma: 1.20, rim: 1.00, dust: 1.00, modeF: 2, electric: 1.0 },
  aiSpeaking:   { plasma: 0.90, rim: 1.10, dust: 0.80, modeF: 3, electric: 0.0 },
};

// One animated SharedValue per color channel — withTiming cross-fades between themes
function useRGB(rgb: RGB) {
  const r = useSharedValue(rgb[0]);
  const g = useSharedValue(rgb[1]);
  const b = useSharedValue(rgb[2]);
  return { r, g, b };
}

export function TheMOrb({ cx, cy, radius, mode, energy, clock, assembleOnMount }: TheMOrbProps) {
  const theme = useTheme();

  const plasmaSpeed   = useSharedValue(MODE_PARAMS.idle.plasma);
  const rimBrightness = useSharedValue(MODE_PARAMS.idle.rim);
  const dustGain      = useSharedValue(MODE_PARAMS.idle.dust);
  const modeFloat     = useSharedValue(0);
  const electric      = useSharedValue(0);

  // Theme color channels
  const innerLow  = useRGB(theme.orb.innerLow);
  const innerHigh = useRGB(theme.orb.innerHigh);
  const rimInner  = useRGB(theme.orb.rimInner);
  const rimOuter  = useRGB(theme.orb.rimOuter);
  const dust      = useRGB(theme.orb.dust);
  const band      = useRGB(theme.orb.band);

  // Animate mode params
  useEffect(() => {
    const p = MODE_PARAMS[mode];
    plasmaSpeed.value   = withTiming(p.plasma, { duration: 600 });
    rimBrightness.value = withTiming(p.rim,    { duration: 400 });
    dustGain.value      = withTiming(p.dust,   { duration: 500 });
    modeFloat.value     = withTiming(p.modeF,  { duration: 300 });
    if (p.electric > 0) {
      electric.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 350 }),
          withTiming(0.35, { duration: 280 }),
          withTiming(0.9, { duration: 220 }),
          withTiming(0.25, { duration: 420 }),
        ),
        -1, false,
      );
    } else {
      electric.value = withTiming(0, { duration: 500 });
    }
  }, [mode]);

  // Cross-fade theme colors on theme change
  useEffect(() => {
    const d = { duration: 500 };
    const c = theme.orb;
    innerLow.r.value  = withTiming(c.innerLow[0], d);
    innerLow.g.value  = withTiming(c.innerLow[1], d);
    innerLow.b.value  = withTiming(c.innerLow[2], d);
    innerHigh.r.value = withTiming(c.innerHigh[0], d);
    innerHigh.g.value = withTiming(c.innerHigh[1], d);
    innerHigh.b.value = withTiming(c.innerHigh[2], d);
    rimInner.r.value  = withTiming(c.rimInner[0], d);
    rimInner.g.value  = withTiming(c.rimInner[1], d);
    rimInner.b.value  = withTiming(c.rimInner[2], d);
    rimOuter.r.value  = withTiming(c.rimOuter[0], d);
    rimOuter.g.value  = withTiming(c.rimOuter[1], d);
    rimOuter.b.value  = withTiming(c.rimOuter[2], d);
    dust.r.value      = withTiming(c.dust[0], d);
    dust.g.value      = withTiming(c.dust[1], d);
    dust.b.value      = withTiming(c.dust[2], d);
    band.r.value      = withTiming(c.band[0], d);
    band.g.value      = withTiming(c.band[1], d);
    band.b.value      = withTiming(c.band[2], d);
  }, [theme]);

  const uniforms = useDerivedValue(() => ({
    uTime:          clock.value / 1000,
    uEnergy:        energy.value,
    uOrbCenter:     [cx, cy] as [number, number],
    uOrbRadius:     radius,
    uMode:          modeFloat.value,
    uPlasmaSpeed:   plasmaSpeed.value,
    uRimBrightness: rimBrightness.value,
    uDustGain:      dustGain.value,
    uElectric:      electric.value,
    uInnerLow:      [innerLow.r.value, innerLow.g.value, innerLow.b.value] as [number, number, number],
    uInnerHigh:     [innerHigh.r.value, innerHigh.g.value, innerHigh.b.value] as [number, number, number],
    uRimInner:      [rimInner.r.value, rimInner.g.value, rimInner.b.value] as [number, number, number],
    uRimOuter:      [rimOuter.r.value, rimOuter.g.value, rimOuter.b.value] as [number, number, number],
    uDustCol:       [dust.r.value, dust.g.value, dust.b.value] as [number, number, number],
    uBandCol:       [band.r.value, band.g.value, band.b.value] as [number, number, number],
  }));

  if (!orbEffect || !spaceBackgroundEffect) return null;

  return (
    <Group>
      {/* Space background — stars + nebula */}
      <Fill>
        <Shader source={spaceBackgroundEffect} uniforms={uniforms} />
      </Fill>
      {/* Orb plasma */}
      <Fill>
        <Shader source={orbEffect} uniforms={uniforms} />
      </Fill>
      <HolographicLogo cx={cx} cy={cy} radius={radius} mode={mode} clock={clock} energy={energy} assembleOnMount={assembleOnMount} />
    </Group>
  );
}
