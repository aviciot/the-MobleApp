# Gateway Integration

> For the full A2A protocol reference (Part schema, SSE events, contextId, generic client design),
> see `docs/A2A_PROTOCOL.md`.

## Config

Gateway config is dynamic — managed by `gatewayStore` (Zustand + SecureStore).
The active profile is accessed through the `GATEWAY` proxy in `src/config.ts`,
which reads the current active profile at call time.

Each `GatewayProfile` stores:

| Field | Purpose |
|---|---|
| `baseUrl` | e.g. `http://localhost:8088` |
| `appSlug` | A2A app record slug → used in `/a2a/{appSlug}/{epSlug}` |
| `epSlug` | A2A entry point slug → used in `/a2a/{appSlug}/{epSlug}` |
| `voiceAppSlug` | Voice app slug → used in `/apps/{voiceAppSlug}/{voiceSlug}/voice/tts` |
| `voiceSlug` | Voice entry point slug |
| `token` | Static bearer token (auth wired in Milestone 2) |
| `sttLanguage` | Per-profile STT language: `'auto' \| 'en-US' \| 'he-IL'` |

---

## Full Voice Round-Trip

```
User holds orb
  → on-device STT via expo-speech-recognition (Google/Apple engine)
  → interim + final results via useSpeechRecognitionEvent('result')

User releases → final STT result arrives
  → POST /a2a/{appSlug}/{epSlug}   (JSON-RPC 2.0, method: message/stream)
  ← SSE stream: run-started → message-delta chunks → artifact-update → task-status-update(completed)

Chunks arrive → sentence splitter → markdown stripped → stripMarkdown()
  → POST /apps/{voiceAppSlug}/{voiceSlug}/voice/tts
  ← binary MP3 → played via expo-audio
```

---

## Endpoint 1: STT — On-Device Speech Recognition

Speech recognition uses **expo-speech-recognition** (on-device, no gateway round-trip).
Language is resolved per active profile (`sttLanguage` field); `'auto'` uses device locale.

```ts
ExpoSpeechRecognitionModule.start({ lang: resolveSTTLang(profile.sttLanguage), interimResults: true, continuous: false });
```

Events consumed in `useVoicePipeline.ts` via `useSpeechRecognitionEvent('result')`.
Each event delivers the **complete current hypothesis** (not a delta) — handler replaces, doesn't append.

Gateway STT (`/apps/{slug}/voice/transcribe`) is **not used**.

---

## Endpoint 2: A2A Orchestrator

```
POST /a2a/{appSlug}/{epSlug}
Content-Type: application/json
Authorization: Bearer <token>
Accept: text/event-stream          (streaming only)
Accept-Encoding: identity          (streaming only — prevents buffering)
```

### Non-Streaming (`sendToOrchestrator`)

Method: `message/send`. Used as fallback when streaming is unavailable.

```json
{
  "jsonrpc": "2.0", "id": "1", "method": "message/send",
  "params": {
    "message": { "role": "user", "parts": [{ "text": "Hello" }] }
  }
}
```

Reply text: `result.message.parts[].text` → fall back to `result.artifacts[].parts[].text`.

### Streaming (`streamToOrchestrator`)

Method: `message/stream`. Primary path for voice pipeline.

SSE events handled:

| Event kind | App action |
|---|---|
| `run-started` | Capture `contextId` |
| `message-delta` | Append text → fire `onChunk` → TTS sentence queue |
| `artifact-update` | Fire `onArtifact` → `partToCard()` → card in UI |
| `task-status-update(completed)` | Settle stream → `onDone` |
| `task-status-update(failed/rejected)` | Settle stream → `onError` |
| `error` | Settle stream → `onError` |

See `docs/A2A_PROTOCOL.md` for the full Part schema and SSE event shapes.

---

## Endpoint 3: TTS

```
POST /apps/{voiceAppSlug}/{voiceSlug}/voice/tts
Content-Type: application/json
Authorization: Bearer <token>
```

Body: `{ "text": "The text to speak" }`  
Response: binary MP3. Written to `FileSystem.cacheDirectory`, played via `expo-audio`.

TTS input is pre-processed:
- Markdown stripped (`**bold**`, `*italic*`, `` `code` ``, `###`, links, `---`)
- Emoji stripped (Unicode `\p{Emoji}`)
- Result trimmed before synthesis

---

## Error Handling

| HTTP | Meaning | App action |
|---|---|---|
| 401 | Invalid/missing token | Error card (re-auth in Milestone 2) |
| 400 | Bad request | Error card |
| 500/503 | Server error | Error card |

A2A errors (JSON-RPC `error` field or `task-status-update(failed)`): shown as error card.  
Stream inactivity >15s: `onError("Stream timed out")`.  
Connect timeout >20s: `onError("connect timeout")`.

---

## Key Files

| File | Purpose |
|---|---|
| `src/config.ts` | `GATEWAY` proxy backed by `gatewayStore` |
| `src/store/gatewayStore.ts` | Profile management, SecureStore persistence |
| `src/audio/GatewayClient.ts` | `tts()` |
| `src/ai/A2AClient.ts` | `sendToOrchestrator()`, `streamToOrchestrator()`, per-profile contextId |
| `src/audio/VoiceController.ts` | Full pipeline: STT → A2A → TTS → play; `partToCard()` generic rendering |
| `src/audio/useVoicePipeline.ts` | React hook: wires STT events into VoiceController |

---

## What Is NOT Used

- Gateway STT (`/voice/transcribe`) — replaced by on-device expo-speech-recognition
- WebSocket / WebRTC — reserved for future real-time path
- `expo-av` — removed (incompatible with SDK 57 new arch), replaced by `expo-audio`
- `type` discriminator in Part — removed (was A2A v0.3); v1.0 uses field presence
