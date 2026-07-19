import { GATEWAY } from '../config';

// Persistent across the conversation — server threads history by contextId
let contextId: string | null = null;
let requestCounter = 0;

export interface A2APart {
  type: 'text' | 'data' | 'file';
  text?: string;
  data?: Record<string, unknown>;
  file?: { name: string; mimeType: string; uri?: string };
}

export interface A2AArtifact {
  parts: A2APart[];
}

export interface A2AResult {
  replyText: string;
  artifacts: A2AArtifact[];
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
    method: 'tasks/send',
    params: {
      message: {
        role: 'user',
        parts: [{ type: 'text', text: userText }],
        ...(contextId ? { contextId } : {}),
      },
      skillId: 'debator-a2a',
    },
  };

  const res = await fetch(`${GATEWAY.baseUrl}/a2a`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY.token ? { Authorization: `Bearer ${GATEWAY.token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new A2AError(res.status, err.detail ?? `A2A request failed (${res.status})`);
  }

  const json = await res.json();

  if (json.error) {
    throw new A2AError(json.error.code ?? -1, json.error.message ?? 'A2A error');
  }

  const result = json.result;

  // Persist contextId for conversation continuity
  if (result.contextId) contextId = result.contextId;
  // Some implementations embed contextId inside message
  if (!contextId && result.message?.contextId) contextId = result.message.contextId;

  const artifacts: A2AArtifact[] = result.artifacts ?? [];

  // Extract first text part — check message.parts first, then artifacts
  let replyText = '';
  const messageParts: A2APart[] = result.message?.parts ?? [];
  for (const part of messageParts) {
    if (part.type === 'text' && part.text) { replyText = part.text; break; }
  }
  if (!replyText) {
    for (const artifact of artifacts) {
      for (const part of artifact.parts) {
        if (part.type === 'text' && part.text) { replyText = part.text; break; }
      }
      if (replyText) break;
    }
  }

  return { replyText, artifacts, contextId: contextId ?? '' };
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
