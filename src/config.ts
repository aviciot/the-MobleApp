import { useGatewayStore } from './store/gatewayStore';

export const DEFAULT_GATEWAY = {
  id: 'default',
  name: 'the-M',
  baseUrl: 'http://localhost:8088',
  appSlug: 'freddy',
  epSlug: 'a2a-1',
  voiceAppSlug: 'freddy',
  voiceSlug: 'ep-voice-1',
  token: 'XMItLlhMUn1wGKJ88UudZ7irAcHEqONhZ4VFDDi0O1k',
};

export function getGatewayConfig() {
  const active = useGatewayStore.getState().activeProfile();
  if (!active) return DEFAULT_GATEWAY;
  // Fill missing fields from DEFAULT_GATEWAY so old saved profiles still work
  return { ...DEFAULT_GATEWAY, ...active };
}

export const GATEWAY = new Proxy({} as typeof DEFAULT_GATEWAY, {
  get(_t, key: string) {
    return getGatewayConfig()[key as keyof typeof DEFAULT_GATEWAY];
  },
});
