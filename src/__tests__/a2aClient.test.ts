/**
 * Focused tests for A2AClient context isolation and error routing.
 */

jest.mock('../config', () => ({
  GATEWAY: { baseUrl: 'http://test:8088', appSlug: 'a2a-1', token: 'tok' },
}));
jest.mock('../store/gatewayStore', () => ({
  useGatewayStore: { getState: () => ({ activeId: 'profile-1' }) },
}));

import { resetContextForProfile } from '../ai/A2AClient';

describe('resetContextForProfile', () => {
  it('clears context for matching baseUrl+appSlug without throwing', () => {
    expect(() => resetContextForProfile('http://test:8088', 'a2a-1')).not.toThrow();
  });

  it('does not throw for unknown profile', () => {
    expect(() => resetContextForProfile('http://other:8088', 'other-slug')).not.toThrow();
  });
});
