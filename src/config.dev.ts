/**
 * Dev-only seed profiles — loaded on first launch when no profiles exist.
 * Edit freely; changes apply after Metro hot-reload + clearing app data
 * (or deleting the saved profiles in Settings and restarting).
 */

const TOKEN = 'XMItLlhMUn1wGKJ88UudZ7irAcHEqONhZ4VFDDi0O1k';
const BASE = 'http://localhost:8088'; // adb-forwarded from 10.55.125.43:8088

export const DEV_PROFILES = [
  {
    name: 'A2A — Freddy',
    baseUrl: BASE,
    appSlug: 'ep-a2a-1',       // POST /a2a/ep-a2a-1  (message/send JSON-RPC)
    voiceSlug: 'ep-voice-1',   // POST /apps/ep-voice-1/voice/tts
    token: TOKEN,
  },
  {
    name: 'Voice App',
    baseUrl: BASE,
    appSlug: 'ep-voice-1',
    voiceSlug: 'ep-voice-1',
    token: TOKEN,
  },
  {
    name: 'SSE Stream',
    baseUrl: BASE,
    appSlug: 'ep-sse-1',
    voiceSlug: 'ep-voice-1',
    token: TOKEN,
  },
  {
    name: 'WebSocket',
    baseUrl: BASE,
    appSlug: 'ep-websocket-1',
    voiceSlug: 'ep-voice-1',
    token: TOKEN,
  },
];
