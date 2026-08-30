import { Skia } from '@shopify/react-native-skia';

// Uses the same uniforms as the orb shader so no extra uniform passing needed
const SKSL = `
uniform float uTime;
uniform float uEnergy;
uniform float2 uOrbCenter;
uniform float uOrbRadius;
uniform float uMode;
uniform float uPlasmaSpeed;
uniform float uRimBrightness;
uniform float uDustGain;
uniform float uElectric;
uniform float3 uInnerLow;
uniform float3 uInnerHigh;
uniform float3 uRimInner;
uniform float3 uRimOuter;
uniform float3 uDustCol;
uniform float3 uBandCol;

float hash(float2 p) {
  p = fract(p * float2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),               hash(i + float2(1,0)), u.x),
    mix(hash(i + float2(0,1)), hash(i + float2(1,1)), u.x),
    u.y
  );
}

float fbm(float2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.1 + float2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float star(float2 uv, float2 offset) {
  float2 cell = floor(uv + offset);
  float2 local = fract(uv + offset);
  float h1 = hash(cell);
  float h2 = hash(cell + float2(3.1, 7.4));
  float h3 = hash(cell + float2(1.7, 5.2));
  if (h1 > 0.28) return 0.0;
  float2 pos = float2(0.5 + (h2 - 0.5) * 0.5, 0.5 + (h3 - 0.5) * 0.5);
  float d = length(local - pos);
  float size = 0.006 + h2 * 0.016;
  float twinkle = 0.55 + 0.45 * sin(uTime * (0.3 + h1 * 1.1) + h2 * 6.28);
  float brightness = h3 * h3;
  return smoothstep(size, 0.0, d) * twinkle * brightness;
}

half4 main(float2 fragCoord) {
  // Normalize by orb radius so layout is screen-size independent
  float2 uv = fragCoord / (uOrbRadius * 6.0);

  // Deep space base
  float3 bg = float3(0.010, 0.008, 0.022);

  // Nebula cloud 1 — purple, slow drift
  float2 c1 = uv * 1.6 + float2(uTime * 0.006, uTime * 0.003);
  float n1 = fbm(c1) * fbm(c1 * 1.3 + float2(3.2, 1.7));
  float cloud1 = smoothstep(0.16, 0.48, n1) * 0.20;

  // Nebula cloud 2 — blue, drifts opposite
  float2 c2 = uv * 2.0 + float2(-uTime * 0.005, -uTime * 0.004) + float2(4.1, 2.3);
  float n2 = fbm(c2) * fbm(c2 * 1.2 + float2(1.1, 4.3));
  float cloud2 = smoothstep(0.14, 0.46, n2) * 0.15;

  // Nebula cloud 3 — teal accent
  float2 c3 = uv * 3.2 + float2(uTime * 0.010, uTime * 0.007) + float2(7.3, 5.8);
  float cloud3 = smoothstep(0.36, 0.55, fbm(c3)) * 0.10;

  float3 nebula = float3(0.16, 0.03, 0.28) * cloud1
                + float3(0.02, 0.06, 0.26) * cloud2
                + float3(0.00, 0.12, 0.20) * cloud3;

  // Stars — 3 density layers
  float2 suv = fragCoord / uOrbRadius;
  float s1 = star(suv * 0.20, float2(0.0, 0.0));
  float s2 = star(suv * 0.38, float2(17.3, 4.1)) * 0.65;
  float s3 = star(suv * 0.72, float2(3.7, 11.9))  * 0.40;
  float stars = clamp(s1 + s2 + s3, 0.0, 1.0);

  float3 col = bg + nebula + float3(0.82, 0.88, 1.0) * stars;

  return half4(half3(col), 1.0);
}
`;

export const spaceBackgroundEffect = Skia.RuntimeEffect.Make(SKSL);
if (!spaceBackgroundEffect) {
  throw new Error('SpaceBackground: SkSL shader compilation failed');
}
