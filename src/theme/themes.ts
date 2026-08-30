export type ThemeId = 'cosmic' | 'matrix' | 'ghost' | 'inferno';
export type RGB = readonly [number, number, number]; // 0..1 for SkSL float3

export interface OrbColors {
  innerLow:  RGB;
  innerHigh: RGB;
  rimInner:  RGB;
  rimOuter:  RGB;
  dust:      RGB;
  band:      RGB;
}

export interface Theme {
  id: ThemeId;
  name: string;
  isDark: boolean;

  background: string;
  backgroundDeep: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;

  cardBackground: string;
  cardBorder: string;
  cardShadow: string;
  cardTextPrimary: string;
  cardTextSecondary: string;

  buttonBg: string;
  buttonBorder: string;
  buttonGlow: string;

  waveformColor: string;

  navBackground: string;
  navBorder: string;
  navIconActive: string;
  navIconInactive: string;

  orbStateColors: {
    idle: string;
    user: string;
    ai: string;
    thinking: string;
  };

  orb: OrbColors;
}

export const THEMES: Record<ThemeId, Theme> = {
  cosmic: {
    id: 'cosmic', name: 'Cosmic', isDark: true,
    background: '#050510', backgroundDeep: '#020208',
    textPrimary: '#FFFFFF', textSecondary: 'rgba(255,255,255,0.6)', textTertiary: 'rgba(255,255,255,0.3)',
    accent: '#7B2FFF',
    cardBackground: 'rgba(10,8,32,0.90)', cardBorder: 'rgba(120,80,255,0.35)', cardShadow: '#7B4FFF',
    cardTextPrimary: '#FFFFFF', cardTextSecondary: 'rgba(255,255,255,0.45)',
    buttonBg: 'rgba(123,47,255,0.15)', buttonBorder: 'rgba(150,100,255,0.3)', buttonGlow: '#7B2FFF',
    waveformColor: '#00D4FF',
    navBackground: 'rgba(8,6,24,0.92)', navBorder: 'rgba(150,100,255,0.15)',
    navIconActive: '#7B2FFF', navIconInactive: 'rgba(255,255,255,0.3)',
    orbStateColors: { idle: '#5B4FE8', user: '#00D4FF', ai: '#7B6FFF', thinking: '#6366F1' },
    orb: {
      innerLow:  [0.05, 0.02, 0.18], innerHigh: [0.10, 0.45, 0.90],
      rimInner:  [0.20, 0.85, 1.00], rimOuter:  [0.65, 0.10, 1.00],
      dust:      [0.85, 0.92, 1.00], band:      [0.15, 0.60, 1.00],
    },
  },

  matrix: {
    id: 'matrix', name: 'Matrix', isDark: true,
    background: '#000000', backgroundDeep: '#000000',
    textPrimary: '#00FF66', textSecondary: 'rgba(0,255,102,0.6)', textTertiary: 'rgba(0,255,102,0.3)',
    accent: '#00FF66',
    cardBackground: 'rgba(0,20,6,0.92)', cardBorder: 'rgba(0,255,102,0.4)', cardShadow: '#00FF66',
    cardTextPrimary: '#00FF66', cardTextSecondary: 'rgba(0,255,102,0.5)',
    buttonBg: 'rgba(0,255,102,0.10)', buttonBorder: 'rgba(0,255,102,0.4)', buttonGlow: '#00FF66',
    waveformColor: '#00FF66',
    navBackground: 'rgba(0,10,3,0.94)', navBorder: 'rgba(0,255,102,0.2)',
    navIconActive: '#00FF66', navIconInactive: 'rgba(0,255,102,0.3)',
    orbStateColors: { idle: '#00AA44', user: '#00FF66', ai: '#33FF88', thinking: '#00CC55' },
    orb: {
      innerLow:  [0.00, 0.06, 0.02], innerHigh: [0.10, 0.90, 0.35],
      rimInner:  [0.30, 1.00, 0.50], rimOuter:  [0.00, 0.55, 0.20],
      dust:      [0.50, 1.00, 0.65], band:      [0.05, 0.70, 0.25],
    },
  },

  ghost: {
    id: 'ghost', name: 'Ghost', isDark: false,
    background: '#EEF0F4', backgroundDeep: '#E2E5EC',
    textPrimary: '#101018', textSecondary: 'rgba(16,16,24,0.6)', textTertiary: 'rgba(16,16,24,0.35)',
    accent: '#5A6473',
    cardBackground: 'rgba(255,255,255,0.85)', cardBorder: 'rgba(90,100,115,0.25)', cardShadow: '#8A94A6',
    cardTextPrimary: '#101018', cardTextSecondary: 'rgba(16,16,24,0.5)',
    buttonBg: 'rgba(90,100,115,0.10)', buttonBorder: 'rgba(90,100,115,0.3)', buttonGlow: '#8A94A6',
    waveformColor: '#5A6473',
    navBackground: 'rgba(240,242,246,0.94)', navBorder: 'rgba(90,100,115,0.18)',
    navIconActive: '#3A4250', navIconInactive: 'rgba(16,16,24,0.3)',
    orbStateColors: { idle: '#9AA3B2', user: '#6E7A8C', ai: '#B8C0CC', thinking: '#8A94A6' },
    orb: {
      innerLow:  [0.55, 0.58, 0.63], innerHigh: [0.90, 0.92, 0.96],
      rimInner:  [0.98, 0.99, 1.00], rimOuter:  [0.60, 0.64, 0.70],
      dust:      [0.75, 0.78, 0.85], band:      [0.70, 0.74, 0.80],
    },
  },

  inferno: {
    id: 'inferno', name: 'Inferno', isDark: true,
    background: '#0A0503', backgroundDeep: '#050201',
    textPrimary: '#FFE6D5', textSecondary: 'rgba(255,230,213,0.6)', textTertiary: 'rgba(255,230,213,0.3)',
    accent: '#FF5A1F',
    cardBackground: 'rgba(28,10,4,0.92)', cardBorder: 'rgba(255,90,31,0.4)', cardShadow: '#FF5A1F',
    cardTextPrimary: '#FFE6D5', cardTextSecondary: 'rgba(255,230,213,0.5)',
    buttonBg: 'rgba(255,90,31,0.14)', buttonBorder: 'rgba(255,90,31,0.4)', buttonGlow: '#FF5A1F',
    waveformColor: '#FF7A33',
    navBackground: 'rgba(16,6,2,0.94)', navBorder: 'rgba(255,90,31,0.2)',
    navIconActive: '#FF7A33', navIconInactive: 'rgba(255,230,213,0.3)',
    orbStateColors: { idle: '#B33A10', user: '#FF7A33', ai: '#FF9A4D', thinking: '#FF5A1F' },
    orb: {
      innerLow:  [0.12, 0.02, 0.00], innerHigh: [1.00, 0.45, 0.08],
      rimInner:  [1.00, 0.75, 0.25], rimOuter:  [0.90, 0.15, 0.02],
      dust:      [1.00, 0.70, 0.35], band:      [0.90, 0.35, 0.08],
    },
  },
};
