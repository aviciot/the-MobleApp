import { Skia } from '@shopify/react-native-skia';

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

// Theme color uniforms (0..1 per channel)
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

float hash1(float n) {
  return fract(sin(n * 127.1 + 311.7) * 43758.5453);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i),              hash(i + float2(1,0)), u.x),
    mix(hash(i + float2(0,1)), hash(i + float2(1,1)), u.x),
    u.y
  );
}

float fbm3(float2 p) {
  float v = 0.0; float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = p * 2.1 + float2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

float2 rot2(float2 p, float a) {
  float s = sin(a); float c = cos(a);
  return float2(p.x*c - p.y*s, p.x*s + p.y*c);
}

float dustParticle(float2 uv, float cellSize, float brightness) {
  float2 cell = floor(uv / cellSize);
  float2 localUV = fract(uv / cellSize);
  float h1 = hash(cell);
  float h2 = hash(cell + float2(7.3, 2.1));
  float h3 = hash(cell + float2(3.7, 8.9));
  float speed = 0.08 + h3 * 0.12;
  float angle = h1 * 6.2832 + uTime * speed * (h2 > 0.5 ? 1.0 : -1.0);
  float2 particlePos = float2(0.5) + float2(cos(angle), sin(angle)) * (0.2 + h2 * 0.25);
  float d = length(localUV - particlePos);
  return brightness * smoothstep(0.06, 0.0, d) * h1;
}

// Thin fuzzy crack from center outward — like plasma fracture
float lightningBolt(float2 p, float boltAngle, float t, float seed) {
  float s = sin(-boltAngle); float c = cos(-boltAngle);
  float2 rp = float2(p.x*c - p.y*s, p.x*s + p.y*c);
  float dist = rp.x;
  float perp = rp.y;
  if (dist < 0.04 || dist > 1.02) return 0.0;

  // Jag offset per segment — hard angle changes
  float seg = floor(dist * 14.0);
  float h1 = fract(sin(seg * 127.1 + seed * 3.7) * 43758.5);
  float h2 = fract(sin(seg * 311.7 + seed * 1.9) * 31415.9);
  float jag = (h1 - 0.5) * 0.09 + (h2 - 0.5) * 0.05;

  // Core crack — very thin, feathered edge for fuzziness
  float d = abs(perp - jag);
  float core  = smoothstep(0.018, 0.002, d);   // bright thin center
  float fuzz  = smoothstep(0.055, 0.010, d) * 0.3; // soft halo around it

  // Random per-bolt strobe — each bolt on/off independently
  float strobeFreq = 7.0 + hash1(seed * 2.3) * 8.0;
  float strobe = 0.4 + 0.6 * (0.5 + 0.5 * sin(t * strobeFreq + seed * 6.28));

  float fade = smoothstep(0.04, 0.18, dist) * smoothstep(1.02, 0.55, dist);

  return (core + fuzz) * strobe * fade;
}

float electricArc(float angle, float arcAngle, float width, float t) {
  float diff = abs(mod(angle - arcAngle + 3.14159, 6.28318) - 3.14159);
  float wobble = sin(t * 18.0 + arcAngle * 7.0) * 0.04
               + sin(t * 31.0 - arcAngle * 13.0) * 0.02;
  return smoothstep(width + wobble, 0.0, diff);
}

half4 main(float2 fragCoord) {
  float2 p = (fragCoord - uOrbCenter) / uOrbRadius;
  float r = length(p);

  if (r > 1.6) return half4(0.0);

  float insideSphere = step(r, 1.0);
  float z = sqrt(max(0.0, 1.0 - dot(p, p)));
  float3 normal = r < 1.0 ? normalize(float3(p, z)) : float3(0, 0, 1);
  float fresnel = pow(1.0 - max(normal.z, 0.0), 3.0);

  float rotAngle = uTime * 0.04 * uPlasmaSpeed;
  float2 rotP = rot2(p, rotAngle);

  // Plasma filaments
  float2 pA = rotP * 2.8 + float2(uTime * 0.10 * uPlasmaSpeed, -uTime * 0.08 * uPlasmaSpeed);
  float2 pB = rotP * 5.2 + float2(-uTime * 0.14 * uPlasmaSpeed,  uTime * 0.09 * uPlasmaSpeed);
  float rawA = fbm3(pA);
  float rawB = fbm3(pB);
  float filA = smoothstep(0.42, 0.52, rawA) * smoothstep(0.62, 0.52, rawA);
  float filB = smoothstep(0.38, 0.50, rawB) * smoothstep(0.60, 0.50, rawB);
  float plasma = (filA * 0.7 + filB * 0.5) * insideSphere;

  // Inner volumetric glow
  float depthGlow = smoothstep(0.0, 0.6, r) * smoothstep(1.0, 0.5, r);
  float bottomPool = smoothstep(0.0, 1.0, (normal.y + 1.0) * 0.5) * 0.4;
  float innerGlow = (depthGlow + bottomPool * insideSphere) * (0.4 + uEnergy * 0.4);

  // Rim
  float angle = atan(p.y, p.x);
  float edgeNoise =
    sin(angle * 9.0  + uTime * 0.7)  * 0.035 +
    sin(angle * 17.0 - uTime * 1.1)  * 0.018 +
    sin(angle * 31.0 + uTime * 0.4)  * 0.010;
  float rimDist = abs(r - (1.0 + edgeNoise));
  float glassShell = smoothstep(0.14, 0.0, rimDist) * 0.40;
  float mainRim    = smoothstep(0.06, 0.0, rimDist) * fresnel * uRimBrightness;
  float crackle    = smoothstep(0.025, 0.0, rimDist)
    * smoothstep(0.55, 0.75, sin(angle * 23.0 + uTime * 2.1) * 0.5 + 0.5)
    * uRimBrightness;

  float arcs = 0.0;

  float bolts = 0.0;

  float rim = glassShell + mainRim + crackle * 0.8 + arcs * 1.4;

  // Outer bands
  float band1 = smoothstep(0.0, 1.0, 1.0 - abs(r - 1.08) / 0.04) * 0.15 * uRimBrightness;
  float band2 = smoothstep(0.0, 1.0, 1.0 - abs(r - 1.18) / 0.05) * 0.08 * uRimBrightness;
  float band3 = smoothstep(0.0, 1.0, 1.0 - abs(r - 1.28) / 0.06)
    * 0.12 * uElectric
    * (0.5 + 0.5 * sin(uTime * 4.0 + angle * 6.0));

  // Cosmic dust
  float2 dustUV = p * uOrbRadius * 0.012;
  float ringMask = smoothstep(0.85, 1.0, r) * smoothstep(1.5, 1.0, r);
  float ringMaskGain = uDustGain * (1.0 + uEnergy * 0.8);
  float dust1 = dustParticle(dustUV * 3.5, 1.0, 0.55) * ringMask * ringMaskGain;
  float dust2 = dustParticle(dustUV * 1.8, 1.0, 0.90) * ringMask * ringMaskGain * 0.6;
  float dust3 = dustParticle(dustUV * 0.9, 1.0, 1.40) * ringMask * ringMaskGain * 0.3;
  float dust  = dust1 + dust2 + dust3;

  // Colour mixing — theme-driven
  half3 innerCol = mix(
    half3(uInnerLow.r, uInnerLow.g, uInnerLow.b),
    half3(uInnerHigh.r, uInnerHigh.g, uInnerHigh.b),
    half(plasma * 1.8 + innerGlow * 0.5)
  );
  half3 rimColBase  = mix(
    half3(uRimInner.r, uRimInner.g, uRimInner.b),
    half3(uRimOuter.r, uRimOuter.g, uRimOuter.b),
    half(fresnel)
  );
  // Electric arc color stays fixed (cyan-white → yellow-white) — theme-independent for legibility
  half3 rimColElec  = mix(half3(0.50, 0.90, 1.00), half3(1.00, 0.90, 0.30), half(arcs));
  half3 rimCol      = mix(rimColBase, rimColElec, half(uElectric));
  half3 dustCol     = half3(uDustCol.r, uDustCol.g, uDustCol.b);
  half3 electricCol = half3(0.60, 0.95, 1.00);

  half3 boltCol = mix(half3(0.5, 0.95, 1.0), half3(1.0, 1.0, 1.0), half(bolts));

  half3 col = innerCol * half(insideSphere * (0.55 + uEnergy * 0.25))
            + rimCol    * half(rim)
            + half3(uBandCol.r, uBandCol.g, uBandCol.b) * half(band1 + band2)
            + electricCol * half(band3)
            + dustCol   * half(dust)
            + boltCol   * half(bolts * 2.5);

  float alpha = insideSphere * (0.72 + uEnergy * 0.18)
              + rim   * 0.95
              + (band1 + band2) * 0.7
              + band3 * 0.8
              + dust  * 0.9
              + bolts * 0.95;
  alpha = clamp(alpha, 0.0, 1.0);

  return half4(col * half(alpha), half(alpha));
}
`;

export const orbEffect = Skia.RuntimeEffect.Make(SKSL);
if (!orbEffect) {
  throw new Error('TheMOrb: SkSL shader compilation failed — check SKSL source');
}
