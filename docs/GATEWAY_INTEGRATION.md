# Gateway Integration

## Config

```ts
// src/config.ts
export const GATEWAY = {
  baseUrl: 'http://10.55.125.43:8088',
  appSlug: 'debator-voice',
  token: 'W0ZFq1EJbIp0w5hRWy-eBpWpzc-I2mN9nA-AhC04D3w',
};
```

Token is a static bearer token (not from login). When auth is wired (Milestone 2), this will come from the JWT stored in SecureStore.

---

## Full Voice Round-Trip

```
User holds mic
  → expo-audio records (audio/m4a, AAC, 44100Hz)

User releases
  → POST /apps/{slug}/voice/transcribe  (multipart, field: "audio", mime: audio/m4a)
  ← { "text": "transcribed speech" }

  → POST /a2a  (JSON-RPC 2.0, method: tasks/send)
  ← result.message.parts[0].text  (or result.artifacts[0].parts[0].text)

  → POST /apps/{slug}/voice/tts  (JSON, { text: "..." })
  ← binary MP3 → written to cache file → played via expo-audio
```

---

## Endpoint 1: STT — Transcribe Audio

```
POST /apps/{slug}/voice/transcribe
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

| Field | Value |
|---|---|
| form field name | `audio` |
| mime type | `audio/m4a` |
| format | AAC, 44100Hz, stereo, 128kbps (RecordingPresets.HIGH_QUALITY) |

Response:
```json
{ "text": "transcribed speech here" }
```

Errors return `{ "detail": "..." }`.

---

## Endpoint 2: A2A Orchestrator

```
POST /a2a
Content-Type: application/json
Authorization: Bearer <token>
```

Request (JSON-RPC 2.0):
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "tasks/send",
  "params": {
    "skillId": "debator-a2a",
    "message": {
      "role": "user",
      "parts": [{ "type": "text", "text": "user utterance" }],
      "contextId": "<optional — omit on first turn>"
    }
  }
}
```

Response:
```json
{
  "result": {
    "contextId": "abc123",
    "message": {
      "parts": [{ "type": "text", "text": "AI reply" }]
    },
    "artifacts": []
  }
}
```

- `contextId` must be persisted across turns for conversation continuity (handled in `A2AClient.ts`)
- Reply text is extracted from `result.message.parts` first, then `result.artifacts` as fallback
- Artifacts can contain `data` parts that map to cards (chart, file, status, text)
- `skillId` is `debator-a2a`

---

## Endpoint 3: TTS — Text to Speech

```
POST /apps/{slug}/voice/tts
Content-Type: application/json
Authorization: Bearer <token>
```

Body:
```json
{ "text": "The text to speak" }
```

Response: binary MP3. The app fetches it with `fetch()`, converts to base64, writes to `FileSystem.cacheDirectory`, and plays via `useAudioPlayer`.

---

## Error Codes

| HTTP | Meaning | App action |
|---|---|---|
| 400 | Bad audio / wrong format | Show error card |
| 401 | Invalid/missing token | Re-auth flow (Milestone 2) |
| 503 | Voice not enabled on this app | Show error card |
| 500 | Upstream STT/TTS failure | Show error card |

---

## Key Implementation Files

| File | Purpose |
|---|---|
| `src/config.ts` | Gateway base URL, slug, token |
| `src/audio/GatewayClient.ts` | `transcribeAudio()` and `tts()` |
| `src/ai/A2AClient.ts` | `sendToOrchestrator()`, contextId persistence, `resetConversation()` |
| `src/audio/VoiceController.ts` | Orchestrates the full pipeline: record → transcribe → A2A → TTS → play |
| `src/audio/useVoicePipeline.ts` | React hook: wires recorder/player hooks into VoiceController |

---

## What Is NOT Used

- WebSocket — not needed for STT/TTS
- Streaming audio upload — full blob sent after recording stops
- `expo-av` — removed (incompatible with Expo SDK 57 new arch), replaced by `expo-audio`
- LiveKit / WebRTC — reserved for future real-time path
