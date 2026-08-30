import type { SharedValue } from 'react-native-reanimated';

export type OrbMode = 'idle' | 'listening' | 'userSpeaking' | 'aiSpeaking';

export interface TheMOrbProps {
  cx: number;
  cy: number;
  radius: number;
  mode: OrbMode;
  energy: SharedValue<number>;
  clock: SharedValue<number>;
  assembleOnMount?: boolean;
}
