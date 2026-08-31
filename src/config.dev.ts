/**
 * Dev-only seed profiles — loaded on first launch when no profiles exist.
 * Edit freely; changes apply after Metro hot-reload + clearing app data
 * (or deleting the saved profiles in Settings and restarting).
 *
 * Two base URLs available:
 *   USB (localhost:8088)     — adb reverse tunnel; needs cable connected
 *   WiFi (10.55.125.43:8088) — direct IP; faster streaming, no cable needed,
 *                              but phone and server must be on same network
 */

const TOKEN = 'XMItLlhMUn1wGKJ88UudZ7irAcHEqONhZ4VFDDi0O1k';
const DIRECT = 'http://10.55.125.43:8088'; // direct — fastest streaming
const USB    = 'http://localhost:8088';     // via adb reverse (USB fallback)

export const DEV_PROFILES = [
  {
    name: 'Freddy — Smoke Test',
    baseUrl: DIRECT,
    appSlug: 'a2a-1',
    voiceSlug: 'ep-voice-1',
    token: TOKEN,
  },
  {
    name: 'File Agent (SSE)',
    baseUrl: DIRECT,
    appSlug: 'a2a-2',
    voiceSlug: 'ep-voice-1',
    token: TOKEN,
  },
  {
    name: 'Freddy — USB',
    baseUrl: USB,
    appSlug: 'a2a-1',
    voiceSlug: 'ep-voice-1',
    token: TOKEN,
  },
];
