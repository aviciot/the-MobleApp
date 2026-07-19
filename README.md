# The-M Mobile

A generic, voice-first A2A (Agent-to-Agent) client for mobile. The-M mobile is one client in the broader **The-M platform** — an agent gateway that hosts and orchestrates agentic applications.

The app itself has no hardcoded purpose. The AI personality, capabilities, and behavior are entirely defined by the agentic application deployed on the gateway. Swap the gateway endpoint and the app becomes a completely different assistant.

---

## What is A2A?

A2A (Agent-to-Agent) is a protocol for structured communication between a client and an AI agent (or a network of agents). Instead of plain text chat, the server returns typed artifacts alongside its spoken reply — charts, files, status updates, rich cards — which the app renders as floating UI elements.

This means the app is not just a voice interface. It is a **visual + voice surface** for whatever the agent decides to show:
- Speak a reply → played back as audio
- Return a chart → rendered as a card on screen
- Return a file reference → shown as a file card
- Return a status → shown as a dismissible notification

The app adapts to the agent, not the other way around.

---

## Architecture

```
User Voice
    ↓
[expo-audio] — record m4a
    ↓
Gateway STT  POST /apps/{slug}/voice/transcribe
    ↓ { text }
A2A Orchestrator  POST /a2a  (JSON-RPC 2.0, tasks/send)
    ↓ { message, artifacts, contextId }
Gateway TTS  POST /apps/{slug}/voice/tts
    ↓ MP3
[expo-audio] — playback
    +
Artifacts → Glass Cards rendered on screen
```

Conversation context is maintained via `contextId` — the server threads history so the agent remembers what was said across turns.

---

## The-M Platform

The-M is the platform layer that sits between client apps and agentic applications:

- **Gateway** — hosts STT (Whisper), TTS (ElevenLabs), and routes A2A traffic
- **Agent skills** — agentic applications registered on the gateway, each with a `skillId`
- **Apps** — identified by `slug`, each app maps to a specific skill and access policy
- **The-M Mobile** — this app, one of the client surfaces

Other clients (web, desktop, other mobile apps) can connect to the same gateway and same agents.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.86 · Expo SDK 57 |
| Language | TypeScript |
| UI / Animation | Reanimated 3 · Skia · Gesture Handler |
| State | Zustand |
| Audio | expo-audio (record + playback) |
| Secure storage | expo-secure-store |
| Voice transport | HTTP (STT/TTS) + A2A JSON-RPC 2.0 |
| Future transport | WebRTC (LiveKit) |

---

## Features

- **Voice-first** — hold to speak, release to send. No keyboard.
- **Animated orb** — central Skia orb reacts to audio state (idle, listening, thinking, speaking)
- **Glass cards** — agent artifacts render as floating cards above the orb
- **Multi-gateway** — add multiple gateway profiles, switch between them instantly
- **Themes** — Cosmic, Matrix, Ghost, Inferno
- **Generic by design** — no hardcoded agent logic in the app

---

## Connecting to a Gateway

Open Settings (☰) → Gateway → Add Gateway:

| Field | Description |
|---|---|
| Name | Friendly label (e.g. "Work", "Demo") |
| Base URL | Gateway host (e.g. `http://10.0.0.1:8088`) |
| App Slug | The app identifier on the gateway |
| Token | Bearer token (stored in device secure enclave) |

Tap a profile to make it active. The app reconnects immediately.

---

## Development Setup

```bash
npm install
# Run Metro (IPv4 explicit — required for USB ADB tunnel on Android)
$env:NODE_OPTIONS="--dns-result-order=ipv4first"
npm start
```

See `docs/PHONE_SETUP.md` for USB device setup on Android.  
See `docs/GATEWAY_INTEGRATION.md` for full API specs.  
See `docs/ARCHITECTURE.md` for component and state design.

---

## Milestones

| # | Name | Status |
|---|---|---|
| 1 | UI shell — orb, cards, themes, navigation | Done |
| 2 | Voice pipeline — STT → A2A → TTS end-to-end | Done |
| 3 | Multi-gateway profiles with SecureStore | In progress |
| 4 | Real authentication (JWT from gateway login) | Pending |
| 5 | WebRTC real-time audio (LiveKit) | Pending |
