import { create } from 'zustand';

export type InteractionMode = 'voice' | 'chat';

interface SessionModeStore {
  mode: InteractionMode;
  setMode: (m: InteractionMode) => void;
  toggle: () => void;
}

export const useSessionModeStore = create<SessionModeStore>((set, get) => ({
  mode: 'voice',
  setMode: (mode) => set({ mode }),
  toggle: () => set({ mode: get().mode === 'voice' ? 'chat' : 'voice' }),
}));
