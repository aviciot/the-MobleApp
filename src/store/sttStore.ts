import { create } from 'zustand';

export type STTLanguage = 'auto' | 'he-IL' | 'en-US';

interface STTStore {
  language: STTLanguage;
  setLanguage: (l: STTLanguage) => void;
}

export const useSTTStore = create<STTStore>((set) => ({
  language: 'auto',
  setLanguage: (language) => set({ language }),
}));

export function resolveSTTLang(language: STTLanguage): string {
  if (language !== 'auto') return language;
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US';
    if (locale.startsWith('he')) return 'he-IL';
    if (locale.startsWith('en')) return 'en-US';
    return locale;
  } catch {
    return 'en-US';
  }
}
