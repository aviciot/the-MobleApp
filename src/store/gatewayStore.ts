import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { type STTLanguage } from './sttStore';

// Subset of A2A agent card fields we store — enough for display + future UI adaptation
export interface AgentCard {
  name: string;
  description?: string;
  version?: string;
  url?: string;
  capabilities?: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  skills?: { id: string; name: string; description?: string }[];
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
}

export interface GatewayProfile {
  id: string;
  name: string;
  baseUrl: string;
  appSlug: string;
  epSlug: string;
  voiceAppSlug: string;
  voiceSlug: string;
  token: string;
  sttLanguage: STTLanguage;
  agentCard?: AgentCard;        // fetched from .well-known/agent.json on save
  agentCardFetchedAt?: number;  // epoch ms — for future cache invalidation
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
let idCounter = 0;

// Serialize all SecureStore writes through a single promise chain
// so rapid mutations always persist in the order they were called.
let persistChain: Promise<void> = Promise.resolve();

function persist(profiles: GatewayProfile[], activeId: string | null): void {
  persistChain = persistChain.then(async () => {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(profiles));
    await SecureStore.setItemAsync(ACTIVE_KEY, activeId ?? '');
  }).catch(() => {});
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
      const all: GatewayProfile[] = raw ? JSON.parse(raw) : [];
      const seen = new Set<string>();
      let changed = false;
      const profiles = all
        .filter((p) => { if (seen.has(p.id)) { changed = true; return false; } seen.add(p.id); return true; })
        .map((p) => {
          let changed_p = false;
          const updated = { ...p } as GatewayProfile;
          if (!updated.voiceSlug) { updated.voiceSlug = updated.appSlug; changed_p = true; }
          if (!updated.epSlug) { updated.epSlug = updated.appSlug; changed_p = true; }
          if (!updated.voiceAppSlug) { updated.voiceAppSlug = updated.appSlug; changed_p = true; }
          if (!updated.sttLanguage) { updated.sttLanguage = 'auto'; changed_p = true; }
          if (changed_p) changed = true;
          return updated;
        });
      if (changed) persist(profiles, activeId || null);
      set({ profiles, activeId: activeId || null, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  addProfile: async (p) => {
    const { profiles, activeId } = get();
    if (profiles.some((x) => x.name === p.name)) return;
    const profile: GatewayProfile = { ...p, id: `gw_${Date.now()}_${++idCounter}` };
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
