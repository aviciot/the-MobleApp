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
  // Guards against permission-race and duplicate final events
  private _cancelled = false;
  private _pipelineRunning = false;

  constructor(callbacks: VoiceControllerCallbacks) {
    this.cb = callbacks;
  }

  async startRecording(_recorder: AudioRecorder) {
    this._cancelled = false;
    this._pipelineRunning = false;
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      // Permission dialog returned — check if user cancelled while it was open
      if (!granted) {
        this.cb.onError('Microphone permission denied');
        return;
      }
      if (this._cancelled) {
        // User released the orb while the permission dialog was open
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
    if (this._cancelled) return;
    this.recognizedText = text;
    if (text) this.cb.onTranscript(text);
    if (isFinal) {
      console.log(`\n━━━ [STT] FINAL: "${text}" ━━━`);
      // Guard against duplicate final events for the same utterance
      if (text && !this._pipelineRunning) {
        this._pipelineRunning = true;
        this.runPipeline(text);
      } else if (!text) {
        console.log('  ↳ empty — skipping pipeline');
        this.cb.onStateChange('idle');
      }
    }
  }

  onSpeechError(message: string) {
    console.log('[STT] error:', message);
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

    let sentenceBuffer = '';
    let fullReply = '';
    let ttsQueue: Promise<void> = Promise.resolve();
    let firstChunk = true;

    const SENTENCE_END = /[.!?。！？׃\n]\s*/;

    const flushSentence = (text: string, _force = false) => {
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
      if (sentenceBuffer.trim()) flushSentence(sentenceBuffer, true);
      sentenceBuffer = '';

      ttsQueue.then(() => {
        if (!signal.aborted) {
          this.stopAiPulse();
          this._pipelineRunning = false;
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
            this.stopAiPulse();
            this._pipelineRunning = false;
            this.cb.onStateChange('idle');
          } else {
            this._pipelineRunning = false;
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
    if (!this.player) {
      console.log('[AUDIO] ✗ no player — returning to idle');
      this.cb.onStateChange('idle');
      return;
    }
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
        resolve();
      }
    });
  }

  private startAiPulse() {
    let t = 0;
    this.aiPulseInterval = setInterval(() => {
      t += 0.08;
      const base     = 0.38 + 0.18 * Math.abs(Math.sin(t * 2.1));
      const mid      = 0.14 * Math.abs(Math.sin(t * 5.3 + 1.2));
      const fast     = 0.10 * Math.abs(Math.sin(t * 11.7 + 0.7));
      const wobble   = 0.06 * Math.abs(Math.sin(t * 0.4));
      const spike    = t % 2.8 < 0.12 ? 0.18 : 0;
      const level = Math.min(1, base + mid + fast + wobble + spike);
      this.cb.onAiLevel(level);
    }, 50);
  }

  private stopAiPulse() {
    if (this.aiPulseInterval) { clearInterval(this.aiPulseInterval); this.aiPulseInterval = null; }
    this.cb.onAiLevel(0);
  }

  abort() {
    this._cancelled = true;
    this._pipelineRunning = false;
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
