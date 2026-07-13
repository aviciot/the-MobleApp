import { create } from 'zustand';

export type CardType = 'image' | 'file' | 'text' | 'chart' | 'status';

export interface CardModel {
  id: string;
  type: CardType;
  createdAt: number;
  // image
  uri?: string;
  blurhash?: string;
  // file
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
  // text
  markdown?: string;
  title?: string;
  // chart
  series?: number[];
  chartKind?: 'line' | 'bar';
  chartLabel?: string;
  // status
  level?: 'info' | 'success' | 'error';
  text?: string;
  autoDismissMs?: number;
  spinner?: boolean;
}

const MAX_CARDS = 6;

interface CardStore {
  cards: CardModel[];
  addCard: (card: CardModel) => void;
  removeCard: (id: string) => void;
  clearCards: () => void;
}

export const useCardStore = create<CardStore>((set) => ({
  cards: [],
  addCard: (card) =>
    set((prev) => {
      const next = [card, ...prev.cards];
      return { cards: next.slice(0, MAX_CARDS) };
    }),
  removeCard: (id) => set((prev) => ({ cards: prev.cards.filter((c) => c.id !== id) })),
  clearCards: () => set({ cards: [] }),
}));
