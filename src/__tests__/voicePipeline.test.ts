/**
 * Focused unit tests for voice pipeline correctness.
 * Run with: npx jest src/__tests__/voicePipeline.test.ts
 */

jest.mock('expo-audio', () => ({ setAudioModeAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
  },
}));
jest.mock('../audio/GatewayClient', () => ({
  tts: jest.fn(),
  GatewayError: class GatewayError extends Error { constructor(public status: number, msg: string) { super(msg); } },
}));
jest.mock('../store/sessionModeStore', () => ({
  useSessionModeStore: { getState: () => ({ mode: 'voice' }) },
}));
jest.mock('../store/sttStore', () => ({
  useSTTStore: { getState: () => ({ language: 'auto' }) },
  resolveSTTLang: (l: string) => l === 'auto' ? 'en-US' : l,
}));
jest.mock('../ai/A2AClient', () => ({
  streamToOrchestrator: jest.fn(),
  resetConversation: jest.fn(),
  A2AError: class A2AError extends Error { constructor(public code: number, msg: string) { super(msg); this.name = 'A2AError'; } },
}));

import { VoiceController } from '../audio/VoiceController';

function makeCb(overrides: Record<string, jest.Mock> = {}) {
  return {
    onStateChange: jest.fn(),
    onTranscript: jest.fn(),
    onReply: jest.fn(),
    onCards: jest.fn(),
    onError: jest.fn(),
    onUserLevel: jest.fn(),
    onAiLevel: jest.fn(),
    ...overrides,
  };
}

describe('VoiceController — cancellation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not start STT if cancelled before permission returns', async () => {
    const { ExpoSpeechRecognitionModule } = require('expo-speech-recognition');
    ExpoSpeechRecognitionModule.requestPermissionsAsync = jest.fn(
      () => new Promise(res => setTimeout(() => res({ granted: true }), 50))
    );

    const cb = makeCb();
    const vc = new VoiceController(cb);
    const p = vc.startRecording(null as any);
    vc.abort();
    await p;

    expect(ExpoSpeechRecognitionModule.start).not.toHaveBeenCalled();
  });

  it('does not fire onError when aborted before pipeline starts', () => {
    const cb = makeCb();
    const vc = new VoiceController(cb);
    vc.abort();
    expect(cb.onError).not.toHaveBeenCalled();
  });
});

describe('VoiceController — duplicate final events', () => {
  it('ignores second final STT result when pipeline is already running', () => {
    const cb = makeCb();
    const vc = new VoiceController(cb);
    (vc as any)._pipelineRunning = true;
    (vc as any)._cancelled = false;
    const runPipelineSpy = jest.spyOn(vc as any, 'runPipeline');
    vc.onSpeechResult('hello world', true);
    expect(runPipelineSpy).not.toHaveBeenCalled();
  });
});
