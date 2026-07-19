import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface GatewayProfile {
  id: string;
  name: string;
  baseUrl: string;
  appSlug: string;
  token: string;
}

interface GatewayStore {
  profiles: GatewayProfile[];
  activeId: string | null;
  hydrated: boolean;
  activeProfile: () => GatewayProfile | null;
  addProfile: (p: Omit<GatewayProfile, 'id'>) => Promise<void>;
  updateProfile: (id: string, p: Partial<Omit<GatewayProfile, 'id'>>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  setActive: (id: string) => Promise<void>;
  hydrate: () => Promise<void>;
}

const STORAGE_KEY = 'gateway_profiles_v1';
const ACTIVE_KEY = 'gateway_active_id_v1';

function persist(profiles: GatewayProfile[], activeId: string | null) {
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(profiles));
  SecureStore.setItemAsync(ACTIVE_KEY, activeId ?? '');
}

export const useGatewayStore = create<GatewayStore>((set, get) => ({
  profiles: [],
  activeId: null,
  hydrated: false,

  activeProfile: () => {
    const { profiles, activeId } = get();
    return profiles.find((p) => p.id === activeId) ?? null;
  },

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      const activeId = await SecureStore.getItemAsync(ACTIVE_KEY);
      const profiles: GatewayProfile[] = raw ? JSON.parse(raw) : [];
      set({ profiles, activeId: activeId || null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  addProfile: async (p) => {
    const profile: GatewayProfile = { ...p, id: `gw_${Date.now()}` };
    const { profiles, activeId } = get();
    const newProfiles = [...profiles, profile];
    const newActive = activeId ?? profile.id;
    set({ profiles: newProfiles, activeId: newActive });
    persist(newProfiles, newActive);
  },

  updateProfile: async (id, p) => {
    const { profiles, activeId } = get();
    const newProfiles = profiles.map((x) => (x.id === id ? { ...x, ...p } : x));
    set({ profiles: newProfiles });
    persist(newProfiles, activeId);
  },

  deleteProfile: async (id) => {
    const { profiles, activeId } = get();
    const newProfiles = profiles.filter((x) => x.id !== id);
    const newActive = activeId === id ? (newProfiles[0]?.id ?? null) : activeId;
    set({ profiles: newProfiles, activeId: newActive });
    persist(newProfiles, newActive);
  },

  setActive: async (id) => {
    const { profiles } = get();
    set({ activeId: id });
    persist(profiles, id);
  },
}));
