import { GATEWAY } from '../config';

let contextId: string | null = null;
let requestCounter = 0;

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

  const url = `${GATEWAY.baseUrl}/a2a/${GATEWAY.appSlug}`;
  const t0 = Date.now();
  console.log(`\n━━━ [A2A] REQUEST #${id} ━━━`);
  console.log(`  url:  ${url}`);
  console.log(`  text: ${body.params.message.parts[0]?.text ?? '?'}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY.token ? { Authorization: `Bearer ${GATEWAY.token}` } : {}),
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

  // Persist contextId for conversation continuity
  if (result?.contextId) contextId = result.contextId;
  if (!contextId && result?.message?.contextId) contextId = result.message.contextId;

  const artifacts: A2AArtifact[] = result?.artifacts ?? [];

  // Extract reply text — type field is optional, presence of .text is sufficient
  let replyText = '';
  for (const artifact of artifacts) {
    for (const part of artifact.parts ?? []) {
      if (part.text) { replyText = part.text; break; }
    }
    if (replyText) break;
  }
  if (!replyText) {
    for (const part of result?.message?.parts ?? []) {
      if (part.text) { replyText = part.text; break; }
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

  console.log(`  ↳ replyText (${replyText.length} chars): "${replyText.slice(0, 80)}${replyText.length > 80 ? '…' : ''}"`);
  if (files.length > 0) console.log(`  ↳ files: ${files.map(f => f.name).join(', ')}`);
  console.log(`━━━ [A2A] DONE #${id} (${Date.now() - t0}ms) ━━━\n`);
  return { replyText, artifacts, files, contextId: contextId ?? '' };
}

export function resetConversation() {
  contextId = null;
}

export class A2AError extends Error {
  constructor(public code: number | string, message: string) {
    super(message);
    this.name = 'A2AError';
  }
}
