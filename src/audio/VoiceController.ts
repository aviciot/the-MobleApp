import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { transcribeAudio, tts, GatewayError } from './GatewayClient';
import { sendToOrchestrator, resetConversation, A2AError, type A2AArtifact } from '../ai/A2AClient';
import type { CardModel } from '../store/cardStore';

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
  private recorder: AudioRecorder | null = null;
  private player: AudioPlayer | null = null;
  private abortController: AbortController | null = null;
  private aiPulseInterval: ReturnType<typeof setInterval> | null = null;
  private playbackSubscription: { remove: () => void } | null = null;
  private cb: VoiceControllerCallbacks;

  constructor(callbacks: VoiceControllerCallbacks) {
    this.cb = callbacks;
  }

  async startRecording(recorder: AudioRecorder) {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        this.cb.onError('Microphone permission denied');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      this.recorder = recorder;
      await recorder.prepareToRecordAsync();
      recorder.record();
      this.cb.onStateChange('recording');
    } catch {
      this.cb.onError('Failed to start recording');
    }
  }

  async stopRecording() {
    if (!this.recorder) return;
    this.cb.onUserLevel(0);
    try {
      await this.recorder.stop();
      const uri = this.recorder.uri;
      this.recorder = null;
      if (!uri) { this.cb.onError('No audio recorded'); return; }
      await this.runPipeline(uri);
    } catch {
      this.recorder = null;
      this.cb.onError('Recording failed');
    }
  }

  private async runPipeline(audioUri: string) {
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      this.cb.onStateChange('transcribing');
      const userText = await transcribeAudio(audioUri, signal);
      if (signal.aborted) return;
      this.cb.onTranscript(userText);

      this.cb.onStateChange('thinking');
      const { replyText, artifacts } = await sendToOrchestrator(userText, signal);
      if (signal.aborted) return;

      const cards = artifactsToCards(artifacts);
      if (cards.length > 0) this.cb.onCards(cards);

      if (!replyText) { this.cb.onStateChange('idle'); return; }

      this.cb.onReply(replyText);

      const mp3Uri = await tts(replyText, signal);
      if (signal.aborted) return;

      await this.playAudio(mp3Uri);
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
    if (!this.player) { this.cb.onError('Player not ready'); return; }
    this.cb.onStateChange('speaking');
    this.startAiPulse();
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      this.player.replace({ uri });
      this.player.play();
      this.playbackSubscription?.remove();
      this.playbackSubscription = this.player.addListener('playbackStatusUpdate', (status: any) => {
        if (status.didJustFinish) {
          this.stopAiPulse();
          this.cb.onStateChange('idle');
          this.playbackSubscription?.remove();
          this.playbackSubscription = null;
        }
      });
    } catch {
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
    if (this.player) { this.player.pause(); }
    this.cb.onUserLevel(0);
    this.cb.onAiLevel(0);
  }

  resetConversation() {
    resetConversation();
  }

  destroy() {
    this.abort();
    if (this.recorder) { this.recorder.stop().catch(() => {}); this.recorder = null; }
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
