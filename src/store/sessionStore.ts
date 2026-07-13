import { create } from 'zustand';

export type SessionState = 'idle' | 'connecting' | 'userSpeaking' | 'aiSpeaking' | 'thinking' | 'error';

interface SessionStore {
  state: SessionState;
  isConnected: boolean;
  isMuted: boolean;
  sessionId: string | null;
  error: { code: string; message: string } | null;
  setState: (s: SessionState) => void;
  setConnected: (v: boolean) => void;
  toggleMute: () => void;
  setError: (e: { code: string; message: string } | null) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  state: 'idle',
  isConnected: false,
  isMuted: false,
  sessionId: null,
  error: null,
  setState: (s) => set({ state: s }),
  setConnected: (v) => set({ isConnected: v }),
  toggleMute: () => set((prev) => ({ isMuted: !prev.isMuted })),
  setError: (e) => set({ error: e, state: e ? 'error' : 'idle' }),
  reset: () => set({ state: 'idle', isConnected: false, isMuted: false, sessionId: null, error: null }),
}));
