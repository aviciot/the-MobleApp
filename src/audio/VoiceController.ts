import {
  setAudioModeAsync,
  type AudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { tts, GatewayError } from './GatewayClient';
import { sendToOrchestrator, resetConversation, A2AError, type A2AArtifact, type A2AFile } from '../ai/A2AClient';
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
        lang: 'he-IL',
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
      // Pipeline is triggered by onResult event — see onSpeechResult()
    } catch {
      this.cb.onError('Recording failed');
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
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      this.cb.onStateChange('thinking');
      const { replyText, artifacts, files } = await sendToOrchestrator(userText, signal);
      if (signal.aborted) return;

      const cards = artifactsToCards(artifacts);
      if (cards.length > 0) this.cb.onCards(cards);

      // Show file cards for any file artifacts
      const fileCards = filesToCards(files);
      if (fileCards.length > 0) this.cb.onCards(fileCards);

      if (!replyText) { this.cb.onStateChange('idle'); return; }

      this.cb.onReply(replyText);

      const { mode } = useSessionModeStore.getState();
      if (mode === 'voice') {
        const mp3Uri = await tts(replyText, signal);
        if (signal.aborted) return;
        await this.playAudio(mp3Uri);
      } else {
        this.cb.onStateChange('idle');
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      if (e instanceof GatewayError) {
        this.cb.onError(gatewayErrorMessage(e.status));
      } else if (e instanceof A2AError) {
        this.cb.onError(`Orchestrator error: ${e.message}`);
      } else {
        this.cb.onError('Something went wrong — try again');
      }
      this.cb.onStateChange('idle');
      this.stopAiPulse();
    }
  }

  setPlayer(player: AudioPlayer) {
    this.player = player;
  }

  private async playAudio(uri: string) {
    if (!this.player) { console.log('[AUDIO] ✗ no player'); this.cb.onError('Player not ready'); return; }
    this.cb.onStateChange('speaking');
    this.startAiPulse();
    try {
      console.log(`\n━━━ [AUDIO] PLAY ━━━\n  uri: ${uri}`);
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      this.player.replace({ uri });
      this.player.play();
      console.log('  ↳ play() called');
      this.playbackSubscription?.remove();
      this.playbackSubscription = this.player.addListener('playbackStatusUpdate', (status: any) => {
        console.log('[AUDIO] status:', JSON.stringify(status));
        if (status.didJustFinish) {
          console.log('━━━ [AUDIO] DONE ━━━\n');
          this.stopAiPulse();
          this.cb.onStateChange('idle');
          this.playbackSubscription?.remove();
          this.playbackSubscription = null;
        }
      });
    } catch (e: any) {
      console.log('[AUDIO] ✗ error:', e?.message ?? e);
      this.stopAiPulse();
      this.cb.onError('Playback failed');
      this.cb.onStateChange('idle');
    }
  }

  private startAiPulse() {
    let t = 0;
    this.aiPulseInterval = setInterval(() => {
      t += 0.12;
      const level = 0.3 + 0.25 * Math.abs(Math.sin(t)) + 0.15 * Math.abs(Math.sin(t * 2.3));
      this.cb.onAiLevel(Math.min(1, level));
    }, 80);
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
    case 401: return 'Not authenticated — check gateway token';
    case 503: return 'Voice not enabled on this app';
    case 400: return 'Audio format not accepted';
    default:  return `Gateway error ${status} — try again`;
  }
}
