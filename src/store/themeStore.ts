import { create } from 'zustand';
import { THEMES, type Theme, type ThemeId } from '../theme/themes';

// Zustand store without AsyncStorage persistence — avoids native module requirement.
// Theme resets to cosmic on app restart; persistence will be added when AsyncStorage
// is included in an EAS dev-client build.
interface ThemeStore {
  themeId: ThemeId;
  theme: Theme;
  setTheme: (id: ThemeId) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  themeId: 'cosmic',
  theme: THEMES.cosmic,
  setTheme: (id) => set({ themeId: id, theme: THEMES[id] }),
}));
