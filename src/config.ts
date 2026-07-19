import { useGatewayStore } from './store/gatewayStore';

// Fallback used only before any profile is saved (first install)
const FALLBACK = {
  baseUrl: 'http://10.55.125.43:8088',
  appSlug: 'debator-voice',
  token: 'W0ZFq1EJbIp0w5hRWy-eBpWpzc-I2mN9nA-AhC04D3w',
};

export function getGatewayConfig() {
  const active = useGatewayStore.getState().activeProfile();
  return active ?? FALLBACK;
}

// Convenience alias — same shape as before so GatewayClient / A2AClient work unchanged
export const GATEWAY = new Proxy({} as typeof FALLBACK, {
  get(_t, key: string) {
    return getGatewayConfig()[key as keyof typeof FALLBACK];
  },
});
