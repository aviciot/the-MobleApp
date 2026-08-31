import {
  setAudioModeAsync,
  type AudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { tts, GatewayError } from './GatewayClient';
import { streamToOrchestrator, resetConversation, A2AError, type A2AArtifact, type A2AFile } from '../ai/A2AClient';
import type { CardModel } from '../store/cardStore';
import { useSessionModeStore } from '../store/sessionModeStore';

export type VoiceState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking' | 'error';

export interface VoiceControllerCallbacks {
  onStateChange: (state: VoiceState) => void;
  onTranscript: (text: string) => void;
  onReply: (text: string) => void;
  onCards: (cards: CardModel[]) => void;
  onError: (message: string) => void;
  onUserLevel: (level: number) => void;
  onAiLevel: (level: number) => void;
}

export class VoiceController {
  private player: AudioPlayer | null = null;
  private abortController: AbortController | null = null;
  private aiPulseInterval: ReturnType<typeof setInterval> | null = null;
  private playbackSubscription: { remove: () => void } | null = null;
  private _playResolve: (() => void) | null = null;
  private cb: VoiceControllerCallbacks;
  private recognizedText: string = '';

  constructor(callbacks: VoiceControllerCallbacks) {
    this.cb = callbacks;
  }

  async startRecording(_recorder: AudioRecorder) {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        this.cb.onError('Microphone permission denied');
        return;
      }
      this.recognizedText = '';
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
      });
      this.cb.onStateChange('recording');
    } catch {
      this.cb.onError('Failed to start recording');
    }
  }

  async stopRecording() {
    this.cb.onUserLevel(0);
    try {
      ExpoSpeechRecognitionModule.stop();
      // Pipeline is triggered by the STT 'result' event — do NOT abort here
    } catch {
      // ignore — recognizer may already be stopped
    }
  }

  // Called from the screen via useSpeechRecognitionEvent hook
  onSpeechResult(text: string, isFinal: boolean) {
    this.recognizedText = text;
    if (text) this.cb.onTranscript(text);
    if (isFinal) {
      console.log(`\n━━━ [STT] FINAL: "${text}" ━━━`);
      if (text) this.runPipeline(text);
      else console.log('  ↳ empty — skipping pipeline');
    }
  }

  onSpeechError(message: string) {
    console.log('[STT] error:', message);
    // Benign errors — user stopped speaking, recognizer finished, or no input
    const benign = ['no-speech', 'no-match', 'speech timeout', 'recognizer busy', '7', '8', '5'];
    const isBenign = benign.some((code) => message.toLowerCase().includes(code));
    if (!isBenign) {
      this.cb.onError(`Speech recognition error: ${message}`);
    }
    this.cb.onStateChange('idle');
  }

  private async runPipeline(userText: string) {
    // Cancel any in-progress pipeline before starting a new one
    if (this.abortController) {
      this.abortController.abort();
      this.stopAiPulse();
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;
    const { mode } = useSessionModeStore.getState();

    this.cb.onStateChange('thinking');
    console.log(`\n━━━ [PIPELINE] START mode=${mode} ━━━`);

    // Sentence splitter — buffer chunks and flush complete sentences
    let sentenceBuffer = '';
    let fullReply = '';
    let ttsQueue: Promise<void> = Promise.resolve();
    let firstChunk = true;

    const SENTENCE_END = /[.!?。！？׃\n]\s*/;

    const flushSentence = (text: string, force = false) => {
      if (!text.trim() || signal.aborted) return;
      if (mode !== 'voice') return;
      ttsQueue = ttsQueue.then(async () => {
        if (signal.aborted) return;
        try {
          console.log(`[PIPELINE] TTS sentence: "${text.slice(0, 50)}…"`);
          const uri = await tts(text.trim(), signal);
          if (signal.aborted) return;
          await this.playAudio(uri);
        } catch (e: any) {
          if (e?.name !== 'AbortError') console.log('[PIPELINE] TTS error:', e?.message);
        }
      });
    };

    const onChunk = (chunk: string) => {
      if (signal.aborted) return;
      fullReply += chunk;
      this.cb.onReply(fullReply);

      if (firstChunk) {
        firstChunk = false;
        console.log(`[PIPELINE] first chunk — switching to ${mode === 'voice' ? 'speaking' : 'thinking→reply'}`);
        this.cb.onStateChange(mode === 'voice' ? 'speaking' : 'thinking');
        if (mode === 'voice') this.startAiPulse();
      }

      if (mode !== 'voice') return;

      sentenceBuffer += chunk;
      // Flush whenever we have a complete sentence
      let match: RegExpExecArray | null;
      while ((match = SENTENCE_END.exec(sentenceBuffer)) !== null) {
        const end = match.index + match[0].length;
        const sentence = sentenceBuffer.slice(0, end);
        sentenceBuffer = sentenceBuffer.slice(end);
        if (sentence.trim()) flushSentence(sentence);
      }
    };

    const onDone = () => {
      if (signal.aborted) return;
      // Flush any remaining buffered text (e.g. Hebrew sentence with no punctuation)
      if (sentenceBuffer.trim()) flushSentence(sentenceBuffer, true);
      sentenceBuffer = '';

      // Wait for TTS queue to drain, then go idle
      ttsQueue.then(() => {
        if (!signal.aborted) {
          this.stopAiPulse();
          this.cb.onStateChange('idle');
        }
      });
    };

    await new Promise<void>((resolve) => {
      streamToOrchestrator(userText, {
        onChunk,
        onArtifact: (artifact) => {
          const cards = artifactsToCards([artifact]);
          if (cards.length > 0) this.cb.onCards(cards);
        },
        onFile: (file) => {
          const cards = filesToCards([file]);
          if (cards.length > 0) this.cb.onCards(cards);
        },
        onDone: (result) => {
          onDone();
          if (mode === 'chat') {
            this.cb.onStateChange('idle');
          }
          resolve();
        },
        onError: (e) => {
          if (e.name !== 'AbortError') {
            if (e instanceof GatewayError) {
              this.cb.onError(gatewayErrorMessage(e.status));
            } else if (e instanceof A2AError) {
              this.cb.onError(e.message);
            } else {
              this.cb.onError(`Error: ${(e as Error)?.message ?? 'unknown'}`);
            }
            this.cb.onStateChange('idle');
            this.stopAiPulse();
          }
          resolve();
        },
      }, signal);
    });
  }

  setPlayer(player: AudioPlayer) {
    this.player = player;
  }

  private async playAudio(uri: string): Promise<void> {
    if (!this.player) { console.log('[AUDIO] ✗ no player'); this.cb.onError('Player not ready'); return; }
    return new Promise<void>((resolve) => {
      this._playResolve = resolve;
      try {
        console.log(`\n━━━ [AUDIO] PLAY ━━━\n  uri: ${uri}`);
        setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).then(() => {
          this.player!.replace({ uri });
          this.player!.play();
          console.log('  ↳ play() called');
          this.playbackSubscription?.remove();
          this.playbackSubscription = this.player!.addListener('playbackStatusUpdate', (status: any) => {
            if (status.didJustFinish) {
              console.log('━━━ [AUDIO] DONE ━━━\n');
              this.playbackSubscription?.remove();
              this.playbackSubscription = null;
              this._playResolve?.();
              this._playResolve = null;
            }
          });
        });
      } catch (e: any) {
        console.log('[AUDIO] ✗ error:', e?.message ?? e);
        this.cb.onError('Playback failed');
        resolve();
      }
    });
  }

  private startAiPulse() {
    let t = 0;
    this.aiPulseInterval = setInterval(() => {
      t += 0.08;
      // Overlapping sine waves at speech-like frequencies to simulate natural voice rhythm
      const base     = 0.38 + 0.18 * Math.abs(Math.sin(t * 2.1));       // slow breath ~2Hz
      const mid      = 0.14 * Math.abs(Math.sin(t * 5.3 + 1.2));        // syllable rate ~5Hz
      const fast     = 0.10 * Math.abs(Math.sin(t * 11.7 + 0.7));       // consonant pops ~12Hz
      const wobble   = 0.06 * Math.abs(Math.sin(t * 0.4));              // phrase-level swell
      const spike    = t % 2.8 < 0.12 ? 0.18 : 0;                      // occasional emphasis
      const level = Math.min(1, base + mid + fast + wobble + spike);
      this.cb.onAiLevel(level);
    }, 50);
  }

  private stopAiPulse() {
    if (this.aiPulseInterval) { clearInterval(this.aiPulseInterval); this.aiPulseInterval = null; }
    this.cb.onAiLevel(0);
  }

  abort() {
    this.abortController?.abort();
    this.stopAiPulse();
    this.playbackSubscription?.remove();
    this.playbackSubscription = null;
    try { this.player?.pause(); } catch {}
    this.cb.onUserLevel(0);
    this.cb.onAiLevel(0);
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
  }

  resetConversation() {
    resetConversation();
  }

  destroy() {
    this.abort();
  }
}

function artifactsToCards(artifacts: A2AArtifact[]): CardModel[] {
  const cards: CardModel[] = [];
  for (const artifact of artifacts) {
    for (const part of artifact.parts) {
      if (part.type === 'data' && part.data) {
        const card = dataToCard(part.data);
        if (card) cards.push(card);
      }
    }
  }
  return cards;
}

function filesToCards(files: A2AFile[]): CardModel[] {
  return files.map((file) => ({
    id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'file' as const,
    createdAt: Date.now(),
    fileName: file.name,
    sizeBytes: 0,
    mimeType: file.mimeType,
    remoteUri: file.uri,
  }));
}

function dataToCard(data: Record<string, unknown>): CardModel | null {
  const id = `a2a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = Date.now();

  if (data.chart && Array.isArray((data.chart as any).series)) {
    const chart = data.chart as any;
    return { id, type: 'chart', createdAt, chartLabel: chart.label ?? '', series: chart.series, chartKind: chart.kind ?? 'bar' };
  }
  if (data.file && typeof (data.file as any).name === 'string') {
    const file = data.file as any;
    return { id, type: 'file', createdAt, fileName: file.name, sizeBytes: file.size ?? 0, mimeType: file.mimeType ?? 'application/octet-stream' };
  }
  if (data.status && typeof data.status === 'string') {
    return { id, type: 'status', createdAt, text: data.status as string, level: (data.level as any) ?? 'info', autoDismissMs: 5000 };
  }
  if (data.title && data.body) {
    return { id, type: 'text', createdAt, title: data.title as string, markdown: data.body as string };
  }
  return null;
}

function gatewayErrorMessage(status: number): string {
  switch (status) {
    case 401:
    case 403: return '🔑 Auth failed — token invalid or expired';
    case 404: return '🔌 Agent not found — check app slug in Settings';
    case 503: return '⚠️ Gateway unavailable — try again';
    case 400: return '⚠️ Bad request — check gateway config';
    default:  return `Gateway error ${status}`;
  }
}
