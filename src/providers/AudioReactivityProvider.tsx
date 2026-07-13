import React, { createContext, useContext, useRef } from 'react';
import { useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

interface AudioContextValue {
  userLevel: SharedValue<number>;
  aiLevel: SharedValue<number>;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioReactivityProvider({ children }: { children: React.ReactNode }) {
  const userLevel = useSharedValue(0);
  const aiLevel = useSharedValue(0);

  return (
    <AudioContext.Provider value={{ userLevel, aiLevel }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudioReactivity() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudioReactivity must be used within AudioReactivityProvider');
  return ctx;
}
