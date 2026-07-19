import type { AIProvider, AIMessage, AIResponse } from './types';

const REPLIES = [
  "I heard you. Let me think about that for a moment.",
  "That's an interesting point. Here's what I know.",
  "Great question. The answer depends on a few factors.",
  "I understand. Here's my take on that.",
  "Absolutely. Let me break that down for you.",
];

// Placeholder — replace with real API provider once API key is available
export class MockAIProvider implements AIProvider {
  private history: AIMessage[] = [];

  async send(messages: AIMessage[], signal?: AbortSignal): Promise<AIResponse> {
    this.history = messages;
    await new Promise((r) => setTimeout(r, 700));
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const reply = REPLIES[Math.floor(Math.random() * REPLIES.length)];
    return { text: reply };
  }

  reset() {
    this.history = [];
  }
}
