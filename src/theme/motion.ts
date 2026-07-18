export const Durations = {
  fast: 180,
  base: 320,
  slow: 600,
  ambient: 4000,
  orbBreath: 3200,
} as const;

export const Springs = {
  card: { damping: 18, stiffness: 140, mass: 1 },
  soft: { damping: 26, stiffness: 90 },
  snappy: { damping: 20, stiffness: 200, mass: 0.8 },
} as const;
