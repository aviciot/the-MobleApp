# A2A Protocol — v1.0 Reference for theM

This document covers the A2A JSON-RPC 2.0 protocol as implemented in this app.
The app is a **generic A2A client** — it works with any compliant agent without agent-specific code.

---

## Core Concepts

### Agent Card

Every A2A agent publishes a machine-readable capability descriptor at a well-known URL:

```
GET {baseUrl}/a2a/{appSlug}/{epSlug}/.well-known/agent.json
```

The card declares the agent's name, description, supported input/output MIME types,
streaming capability, and skills. The app can fetch this to display agent info or adapt
the request (e.g., set `acceptedOutputModes`).

### Dual-Slug Addressing

Each agent endpoint is identified by two slugs — not one:

| Field | Meaning | Example |
|---|---|---|
| `appSlug` | The application/agent record in the DB | `freddy`, `stream` |
| `epSlug` | The specific entry point within that app | `a2a-1`, `a2a-2` |

URL pattern: `{baseUrl}/a2a/{appSlug}/{epSlug}`

Both slugs are stored in `GatewayProfile`. The old single-slug pattern is gone.

### Context (Multi-Turn Conversations)

`contextId` is the server-side conversation thread identifier.

- First request: omit `contextId` — the server creates a new one and returns it.
- Subsequent requests: include the `contextId` to continue the same thread.
- The app stores contextIds in memory keyed by `{profileId}::{baseUrl}::{appSlug}::{epSlug}`.
- Switching profiles or agents clears the context for the old session — new session starts fresh.

---

## Part Schema (v1.0)

A2A v1.0 uses a **single `Part` type** where content is identified by which field is present.
There is NO `type` discriminator field. Do not use `{ type: 'text', text: '...' }` — that is v0.3.

```ts
interface Part {
  // Content fields — exactly one will be present per part
  text?:      string;           // plain text or markdown
  raw?:       string;           // base64-encoded binary
  url?:       string;           // remote resource reference (URI)
  data?:      unknown;          // any JSON value (agent-defined shape)

  // Metadata fields — present when relevant
  mediaType?: string;           // MIME type — e.g. "application/pdf", "image/png"
  filename?:  string;           // suggested filename for raw/url parts
  metadata?:  Record<string, unknown>;  // agent-defined key/value bag
}
```

### How the app renders each Part

| Field present | Card type | Notes |
|---|---|---|
| `url` | File card | `remoteUri = url`, `mimeType = mediaType`, `fileName = filename` |
| `raw` | File card | Base64 inline bytes; `filename` + `mediaType` used for display |
| `data` | Text card | JSON.stringify preview — agent-defined structure |
| `text` | Text card | Spoken via TTS if in reply message; displayed as card if in artifact |

### Outbound Parts (app → agent)

The app sends user utterances as:
```json
{ "text": "user message here" }
```

No `type` field. No wrapper object.

---

## JSON-RPC Methods

### Non-Streaming: `message/send`

Request:
```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "text": "Hello" }],
      "contextId": "<omit on first turn>"
    }
  }
}
```

Response:
```json
{
  "result": {
    "contextId": "ctx-abc123",
    "message": {
      "role": "agent",
      "parts": [{ "text": "Hello! How can I help?" }]
    },
    "artifacts": [
      {
        "parts": [
          { "url": "https://...", "mediaType": "application/pdf", "filename": "report.pdf" }
        ]
      }
    ]
  }
}
```

Reply text comes from `result.message.parts[].text`.  
Artifacts (files, structured data) come from `result.artifacts[].parts[]`.

### Streaming: `message/stream`

Request: same shape as `message/send` but `method: "message/stream"`.  
Headers: `Accept: text/event-stream`, `Accept-Encoding: identity`.

The server responds with an SSE stream. Each event is a JSON-RPC notification:

```
data: {"jsonrpc":"2.0","method":"agent/event","params":{"event":{...}}}
```

#### SSE Event Types

| `event.kind` | Terminal? | What it carries |
|---|---|---|
| `run-started` | No | `contextId` for this run |
| `message-delta` | No | `parts[]` — text chunks as the agent generates |
| `artifact-update` | No | `parts[]` — a complete artifact (file, data, image) |
| `task-status-update` | When `state=completed/failed/rejected/cancelled` | Final status + optional message parts |
| `error` | Yes | `message` — error string |

#### `message-delta` — incremental text

```json
{
  "kind": "message-delta",
  "parts": [{ "text": "Here is " }, { "text": "your answer." }]
}
```

Text is accumulated across deltas into the full reply. Each delta fires `onChunk` for TTS sentence splitting.

#### `artifact-update` — files and structured data

```json
{
  "kind": "artifact-update",
  "parts": [
    { "url": "https://cdn.example.com/doc.pdf", "mediaType": "application/pdf", "filename": "doc.pdf" }
  ]
}
```

Each artifact-update fires `onArtifact` → `partToCard()` → card rendered in UI.

#### `task-status-update` (completed)

```json
{
  "kind": "task-status-update",
  "status": {
    "state": "completed",
    "message": { "parts": [{ "text": "Done." }] }
  },
  "contextId": "ctx-abc123"
}
```

This is the terminal event. The app settles the stream here.

---

## Accepted Output Modes

When sending a request, the app can tell the agent what MIME types it can render
by including `acceptedOutputModes` in the message params:

```json
"params": {
  "message": { ... },
  "acceptedOutputModes": ["text/plain", "application/json", "application/pdf", "image/*"]
}
```

This is a hint — the agent may or may not honor it. Currently the app does not send this field
(defaults to agent-decided output). It is the next obvious capability to add.

---

## Context Isolation

Context keys are scoped to prevent cross-agent leakage:

```
key = "{profileId}::{baseUrl}::{appSlug}::{epSlug}"
```

- Switching to a different profile → new key → fresh conversation
- Same profile, different agent slug → new key → fresh conversation
- Restarting the app → context map is in-memory → fresh conversation (contextId is not persisted)

---

## Transport Constraints (Mobile)

### Why `expo/fetch` (not global `fetch`)

On Android, the global `fetch` buffers the entire response before resolving.
SSE streaming requires reading the response body as a `ReadableStream`.
`expo/fetch` (backed by `ExpoFetchModule` native module) supports streaming on both platforms.

**This requires a native EAS build** — `ExpoFetchModule` is not available in Expo Go.

### Inactivity Timeout

The stream reader applies a 15-second inactivity timer that resets on every chunk.
If no data arrives for 15 seconds, the stream is cancelled and `onError` is called.
This prevents silent hangs on lossy connections.

### Connect Timeout

A 20-second race guards the initial `fetch()` call. If the server doesn't respond
within 20 seconds, `onError` fires with "connect timeout". This protects against
misconfigured profiles (wrong baseUrl, server down).

---

## Key Files

| File | Role |
|---|---|
| `src/ai/A2AClient.ts` | JSON-RPC client, SSE parser, contextId map, Part interfaces |
| `src/audio/VoiceController.ts` | `partToCard()` — generic Part → CardModel dispatch |
| `src/store/gatewayStore.ts` | `GatewayProfile` — baseUrl, appSlug, epSlug, voiceAppSlug, voiceSlug, token, sttLanguage |
| `src/config.ts` | `GATEWAY` proxy — reads active profile at call time |
| `src/config.dev.ts` | Dev seed profiles (Freddy, File Agent — WiFi + USB variants) |

---

## What "Generic Client" Means Here

The app has **no agent-specific code**. It does not pattern-match on agent names, check for
specific field names inside `data` parts, or special-case any slug.

Every agent response is handled the same way:
1. `message.parts[]` → accumulated text → TTS + transcript card
2. `artifacts[].parts[]` → `partToCard()` → file or text card based on which field is present

If an agent returns a `data` part with a custom shape, the app renders a JSON preview card.
If it returns a `url` part, the app renders a file card. The app does not need to know
what the agent is or what it produces.

To support a new agent: add a `GatewayProfile` with the correct slugs. No code changes needed.
