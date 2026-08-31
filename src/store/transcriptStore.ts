import { create } from 'zustand';

export interface Turn {
  id: string;
  speaker: 'user' | 'ai';
  text: string;
  ts: number;
}

const MAX_TURNS = 50;

interface TranscriptStore {
  liveText: string;
  liveSpeaker: 'user' | 'ai';
  finalizedTurns: Turn[];
  appendToken: (token: string) => void;
  setLiveText: (text: string) => void;
  finalizeTurn: () => void;
  clearLive: () => void;
  setLiveSpeaker: (s: 'user' | 'ai') => void;
}

export const useTranscriptStore = create<TranscriptStore>((set, get) => ({
  liveText: '',
  liveSpeaker: 'ai',
  finalizedTurns: [],
  appendToken: (token) => set((prev) => ({ liveText: prev.liveText + token })),
  setLiveText: (text) => set({ liveText: text }),
  setLiveSpeaker: (s) => set({ liveSpeaker: s }),
  finalizeTurn: () => {
    const { liveText, liveSpeaker, finalizedTurns } = get();
    if (!liveText.trim()) return;
    const turn: Turn = { id: Date.now().toString(), speaker: liveSpeaker, text: liveText, ts: Date.now() };
    const next = [turn, ...finalizedTurns].slice(0, MAX_TURNS);
    set({ finalizedTurns: next, liveText: '' });
  },
  clearLive: () => set({ liveText: '' }),
}));
