export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
}

export interface AIProvider {
  send(messages: AIMessage[], signal?: AbortSignal): Promise<AIResponse>;
  reset(): void;
}
