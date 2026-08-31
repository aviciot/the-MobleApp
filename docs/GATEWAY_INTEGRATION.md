# Gateway Integration

## Config

Gateway config is dynamic — managed by `gatewayStore` (Zustand + SecureStore). The active profile is
accessed through the `GATEWAY` proxy in `src/config.ts`, which reads the current active profile at call time.

Each profile stores:
- `baseUrl` — e.g. `http://localhost:8088`
- `appSlug` — A2A endpoint slug → `/a2a/{appSlug}`
- `voiceSlug` — Voice endpoint slug → `/apps/{voiceSlug}/voice/tts`
- `token` — static bearer token (not from login; auth wired in Milestone 2)

---

## Full Voice Round-Trip

```
User holds orb
  → on-device STT via expo-speech-recognition (Google/Apple engine)
  → interim + final results delivered via useSpeechRecognitionEvent('result')

User releases → final STT result arrives
  → POST /a2a/{appSlug}  (JSON-RPC 2.0, method: message/send, streaming via message/stream)
  ← SSE stream of message-delta events → TTS sentence queue

  → POST /apps/{voiceSlug}/voice/tts  (JSON, { text: "..." })
  ← binary MP3 → played via expo-audio
```

---

## Endpoint 1: STT — On-Device Speech Recognition

Speech recognition uses **expo-speech-recognition** (on-device, no gateway round-trip).

```ts
ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
```

Events are consumed in `useVoicePipeline.ts` via `useSpeechRecognitionEvent('result')`.

Each event delivers the **complete current hypothesis** (not a delta). The handler calls `setLiveText(text)`
to replace the live transcript, not append.

Gateway STT (`/apps/{slug}/voice/transcribe`) is **not used**.

---

## Endpoint 2: A2A Orchestrator

```
POST /a2a/{appSlug}
Content-Type: application/json
Authorization: Bearer <token>
```

### Non-streaming (sendToOrchestrator)

Request (JSON-RPC 2.0):
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
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

Reply text extraction: `result.message.parts` first, then `result.artifacts` as fallback.

### Streaming (streamToOrchestrator)

Uses `method: "message/stream"` with `Accept: text/event-stream`. Delivers SSE events:
- `run-started` — contextId established
- `message-delta` — text chunk
- `artifact-update` — card/file data
- `task-status-update` with `state: "completed"` — terminal event
- `error` — terminal error event

Context (`contextId`) is isolated per gateway URL + appSlug. Switching profiles resets the context for
the old profile. The new profile starts a fresh conversation.

---

## Endpoint 3: TTS — Text to Speech

```
POST /apps/{voiceSlug}/voice/tts
Content-Type: application/json
Authorization: Bearer <token>
```

Body:
```json
{ "text": "The text to speak" }
```

Response: binary MP3. Fetched, written to `FileSystem.cacheDirectory`, played via `expo-audio`.

---

## Error Codes

| HTTP | Meaning | App action |
|---|---|---|
| 400 | Bad audio / wrong format | Show error card |
| 401 | Invalid/missing token | Re-auth flow (Milestone 2) |
| 503 | Voice not enabled on this app | Show error card |
| 500 | Upstream TTS failure | Show error card |

---

## Key Implementation Files

| File | Purpose |
|---|---|
| `src/config.ts` | `GATEWAY` proxy backed by `gatewayStore` |
| `src/store/gatewayStore.ts` | Gateway profiles in SecureStore (serialized writes) |
| `src/audio/GatewayClient.ts` | `tts()` |
| `src/ai/A2AClient.ts` | `sendToOrchestrator()`, `streamToOrchestrator()`, per-profile contextId |
| `src/audio/VoiceController.ts` | Full pipeline: STT result → A2A → TTS → play |
| `src/audio/useVoicePipeline.ts` | React hook: wires speech recognition events into VoiceController |

---

## Stack Versions

| Package | Version |
|---|---|
| expo | ~57.0.4 |
| react-native | 0.86.3 |
| react-native-reanimated | 4.5.1 |
| expo-speech-recognition | ~57.0.1 |
| expo-audio | ~57.0.4 |

---

## What Is NOT Used

- Gateway STT (`/apps/{slug}/voice/transcribe`) — replaced by on-device expo-speech-recognition
- WebSocket / WebRTC — reserved for future real-time path
- `expo-av` — removed (incompatible with SDK 57 new arch), replaced by `expo-audio`
