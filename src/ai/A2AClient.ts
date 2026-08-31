// Use global fetch — expo/fetch requires a native EAS build (ExpoFetchModule)
// Switch back to: import { fetch } from 'expo/fetch'; after running eas build
import { GATEWAY } from '../config';
import { useGatewayStore } from '../store/gatewayStore';

// Per-profile-per-gateway-per-slug context map — prevents cross-agent context leakage
const contextMap = new Map<string, string>();
let requestCounter = 0;

function ctxKey(baseUrl: string, appSlug: string, profileId: string): string {
  return `${profileId}::${baseUrl}::${appSlug}`;
}

export interface A2APart {
  type?: 'text' | 'data' | 'file';
  text?: string;
  data?: Record<string, unknown>;
  file?: { name: string; mimeType: string; uri?: string };
}

export interface A2AArtifact {
  parts: A2APart[];
}

export interface A2AFile {
  name: string;
  mimeType: string;
  uri?: string;
  bytes?: string;
}

export interface A2AResult {
  replyText: string;
  artifacts: A2AArtifact[];
  files: A2AFile[];
  contextId: string;
}

export async function sendToOrchestrator(
  userText: string,
  signal?: AbortSignal,
): Promise<A2AResult> {
  // Capture gateway config once — immune to mid-request profile switches
  const baseUrl = GATEWAY.baseUrl;
  const appSlug = GATEWAY.appSlug;
  const token = GATEWAY.token;
  const profileId = useGatewayStore.getState().activeId ?? 'default';

  const key = ctxKey(baseUrl, appSlug, profileId);
  const contextId = contextMap.get(key) ?? null;
  const id = String(++requestCounter);

  const body = {
    jsonrpc: '2.0',
    id,
    method: 'message/send',
    params: {
      message: {
        role: 'user',
        parts: [{ type: 'text', text: userText }],
        ...(contextId ? { contextId } : {}),
      },
    },
  };

  const url = `${baseUrl}/a2a/${appSlug}`;
  const t0 = Date.now();
  console.log(`\n━━━ [A2A] REQUEST #${id} ━━━`);
  console.log(`  url:  ${url}`);
  console.log(`  text: ${body.params.message.parts[0]?.text ?? '?'}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  console.log(`  ↳ status: ${res.status}  (${Date.now() - t0}ms)`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.log(`  ✗ error: ${JSON.stringify(err)}`);
    throw new A2AError(res.status, err.detail ?? `A2A request failed (${res.status})`);
  }

  const json = await res.json();
  console.log(`  ↳ raw response: ${JSON.stringify(json)}`);

  if (json.error) {
    throw new A2AError(json.error.code ?? -1, json.error.message ?? 'A2A error');
  }

  const result = json.result;

  // Persist contextId scoped to this gateway+slug
  const newCtx = result?.contextId ?? result?.message?.contextId ?? null;
  if (newCtx) contextMap.set(key, newCtx);

  const artifacts: A2AArtifact[] = result?.artifacts ?? [];

  // Prefer result.message.parts text; fall back to artifact text
  let replyText = '';
  for (const part of result?.message?.parts ?? []) {
    if (part.text) { replyText = part.text; break; }
  }
  if (!replyText) {
    for (const artifact of artifacts) {
      for (const part of artifact.parts ?? []) {
        if (part.text) { replyText = part.text; break; }
      }
      if (replyText) break;
    }
  }

  // Extract file artifacts
  const files: A2AFile[] = [];
  for (const artifact of artifacts) {
    for (const part of artifact.parts ?? []) {
      if (part.file) {
        files.push({
          name: part.file.name ?? 'file',
          mimeType: part.file.mimeType ?? 'application/octet-stream',
          uri: part.file.uri,
        });
      }
    }
  }

  const finalCtx = contextMap.get(key) ?? '';
  console.log(`  ↳ replyText (${replyText.length} chars): "${replyText.slice(0, 80)}${replyText.length > 80 ? '…' : ''}"`);
  if (files.length > 0) console.log(`  ↳ files: ${files.map(f => f.name).join(', ')}`);
  console.log(`━━━ [A2A] DONE #${id} (${Date.now() - t0}ms) ━━━\n`);
  return { replyText, artifacts, files, contextId: finalCtx };
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onArtifact?: (artifact: A2AArtifact) => void;
  onFile?: (file: A2AFile) => void;
  onDone: (result: A2AResult) => void;
  onError: (err: Error) => void;
}

// SSE streaming: fires onChunk for each message-delta, resolves with full result on done
export async function streamToOrchestrator(
  userText: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  // Capture gateway config once — immune to mid-request profile switches
  const baseUrl = GATEWAY.baseUrl;
  const appSlug = GATEWAY.appSlug;
  const token = GATEWAY.token;
  const profileId = useGatewayStore.getState().activeId ?? 'default';

  const key = ctxKey(baseUrl, appSlug, profileId);
  const contextId = contextMap.get(key) ?? null;
  const id = String(++requestCounter);
  const url = `${baseUrl}/a2a/${appSlug}`;
  const t0 = Date.now();

  console.log(`\n━━━ [A2A STREAM] REQUEST #${id} ━━━`);
  console.log(`  url:  ${url}`);
  console.log(`  text: "${userText.slice(0, 60)}${userText.length > 60 ? '…' : ''}"`);

  // Settled guard — onDone / onError called exactly once
  let settled = false;
  const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

  // Inactivity timeout — resets on every chunk, not just the first byte.
  const INACTIVITY_MS = 15_000;
  let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  const resetInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      settle(() => callbacks.onError(new A2AError(-1, 'Stream timed out — no data received')));
      reader?.cancel().catch(() => {});
    }, INACTIVITY_MS);
  };

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const body = {
    jsonrpc: '2.0',
    id,
    method: 'message/stream',
    params: {
      message: {
        role: 'user',
        parts: [{ type: 'text', text: userText }],
        ...(contextId ? { contextId } : {}),
      },
    },
  };

  let res: Response;
  try {
    console.log(`  ↳ fetching...`);
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Accept-Encoding': 'identity',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e: any) {
    const isAbort = e?.name === 'AbortError';
    console.log(`  ✗ fetch threw: ${e?.name} — ${e?.message}`);
    if (isAbort) {
      settle(() => {});
    } else {
      settle(() => callbacks.onError(new A2AError(-1, `Network error — ${e?.name}: ${e?.message ?? 'check gateway'}`)));
    }
    return;
  }

  console.log(`  ↳ status: ${res.status}  (${Date.now() - t0}ms)`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    settle(() => callbacks.onError(new A2AError(res.status, err.detail ?? `A2A failed (${res.status})`)));
    return;
  }

  reader = res.body?.getReader() ?? null;
  if (!reader) {
    settle(() => callbacks.onError(new A2AError(-1, 'No response body')));
    return;
  }

  const decoder = new TextDecoder();
  let rawBuffer = '';
  let eventLines: string[] = [];

  let fullText = '';
  let streamContextId: string | null = contextId;
  const collectedArtifacts: A2AArtifact[] = [];
  const collectedFiles: A2AFile[] = [];
  let chunkCount = 0;

  const dispatchSSEEvent = (dataLines: string[]): boolean => {
    const dataPayload = dataLines
      .filter(l => l.startsWith('data:'))
      .map(l => l.slice(5).trimStart())
      .join('\n');

    if (!dataPayload) return false;

    let event: any;
    try { event = JSON.parse(dataPayload); } catch { return false; }

    const ev = event?.params?.event;
    if (!ev) return false;
    if (ev.contextId) streamContextId = ev.contextId;

    switch (ev.kind) {
      case 'run-started':
        if (ev.contextId) streamContextId = ev.contextId;
        return false;

      case 'message-delta':
        for (const part of ev.parts ?? []) {
          if (part.text) { fullText += part.text; callbacks.onChunk(part.text); }
          if (part.file) {
            const f: A2AFile = { name: part.file.name ?? 'file', mimeType: part.file.mimeType ?? 'application/octet-stream', uri: part.file.uri };
            collectedFiles.push(f); callbacks.onFile?.(f);
          }
        }
        return false;

      case 'artifact-update': {
        const artifact: A2AArtifact = { parts: ev.parts ?? [] };
        collectedArtifacts.push(artifact); callbacks.onArtifact?.(artifact);
        for (const part of ev.parts ?? []) {
          if (part.file) {
            const f: A2AFile = { name: part.file.name ?? 'file', mimeType: part.file.mimeType ?? 'application/octet-stream', uri: part.file.uri };
            collectedFiles.push(f); callbacks.onFile?.(f);
          }
        }
        return false;
      }

      case 'task-status-update': {
        const state = ev.status?.state;
        if (state === 'completed') {
          for (const part of ev.status?.message?.parts ?? []) {
            if (part.text && !fullText) { fullText = part.text; callbacks.onChunk(part.text); }
          }
          console.log(`  ↳ done (completed): ${fullText.length} chars, ${collectedArtifacts.length} artifacts, ${collectedFiles.length} files, ${chunkCount} chunks — ${Date.now() - t0}ms`);
          if (streamContextId) contextMap.set(key, streamContextId);
          settle(() => callbacks.onDone({ replyText: fullText, artifacts: collectedArtifacts, files: collectedFiles, contextId: streamContextId ?? '' }));
          return true;
        }
        if (state === 'failed' || state === 'rejected') {
          const errMsg = ev.status?.message?.parts?.find((p: any) => p.text)?.text ?? `Task ${state}`;
          console.log(`  ↳ task ${state}: ${errMsg}`);
          settle(() => callbacks.onError(new A2AError(-1, errMsg)));
          return true;
        }
        if (state === 'cancelled') {
          console.log(`  ↳ task cancelled`);
          settle(() => {});
          return true;
        }
        return false;
      }

      case 'error':
        settle(() => callbacks.onError(new A2AError(-1, ev.message ?? 'Stream error')));
        return true;

      default:
        return false;
    }
  };

  const feedChunk = (text: string): boolean => {
    rawBuffer += text;
    while (true) {
      const nl = rawBuffer.indexOf('\n');
      if (nl === -1) break;
      const line = rawBuffer.slice(0, nl).replace(/\r$/, '');
      rawBuffer = rawBuffer.slice(nl + 1);

      if (line === '') {
        if (eventLines.length > 0) {
          const terminal = dispatchSSEEvent(eventLines);
          eventLines = [];
          if (terminal) return true;
        }
      } else {
        eventLines.push(line);
      }
    }
    return false;
  };

  try {
    resetInactivity();

    while (true) {
      if (signal?.aborted) { settle(() => {}); break; }

      const { done, value } = await reader.read();
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

      if (done) {
        console.log(`  ↳ [STREAM] EOF at ${elapsed}s — ${chunkCount} chunks total`);
        const tail = decoder.decode();
        if (tail) feedChunk(tail);
        if (eventLines.length > 0) dispatchSSEEvent(eventLines);
        break;
      }

      chunkCount++;
      resetInactivity();
      const chunk = decoder.decode(value, { stream: true });
      console.log(`  ↳ [STREAM] chunk #${chunkCount} at ${elapsed}s — ${value.byteLength} bytes`);

      const terminal = feedChunk(chunk);
      if (terminal) break;
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      settle(() => callbacks.onError(new A2AError(-1, `Stream read error: ${e?.message}`)));
    }
  } finally {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    reader.cancel().catch(() => {});
  }

  if (!settled) {
    if (fullText) {
      if (streamContextId) contextMap.set(key, streamContextId);
      settle(() => callbacks.onDone({ replyText: fullText, artifacts: collectedArtifacts, files: collectedFiles, contextId: streamContextId ?? '' }));
    } else {
      settle(() => callbacks.onError(new A2AError(-1, 'Stream closed without a terminal event')));
    }
  }
}

export function resetConversation() {
  const baseUrl = GATEWAY.baseUrl;
  const appSlug = GATEWAY.appSlug;
  for (const k of contextMap.keys()) {
    if (k.includes(`::${baseUrl}::${appSlug}`)) contextMap.delete(k);
  }
}

export function resetContextForProfile(baseUrl: string, appSlug: string) {
  for (const k of contextMap.keys()) {
    if (k.includes(`::${baseUrl}::${appSlug}`)) contextMap.delete(k);
  }
}

export class A2AError extends Error {
  constructor(public code: number | string, message: string) {
    super(message);
    this.name = 'A2AError';
  }
}
