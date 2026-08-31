import {
  setAudioModeAsync,
  type AudioRecorder,
  type AudioPlayer,
} from 'expo-audio';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { tts, GatewayError } from './GatewayClient';
import { streamToOrchestrator, resetConversation, A2AError, type A2AArtifact } from '../ai/A2AClient';
import type { CardModel } from '../store/cardStore';
import { useSessionModeStore } from '../store/sessionModeStore';
import { resolveSTTLang } from '../store/sttStore';
import { useGatewayStore } from '../store/gatewayStore';

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
      const profile = useGatewayStore.getState().activeProfile();
      ExpoSpeechRecognitionModule.start({
        lang: resolveSTTLang(profile?.sttLanguage ?? 'auto'),
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

    // Strip markdown + emoji + separators before TTS
    const stripMarkdown = (s: string) =>
      s.replace(/\*\*(.*?)\*\*/g, '$1')         // bold → keep content
       .replace(/\*(.*?)\*/g, '$1')              // italic → keep content
       .replace(/`{1,3}[^`]*`{1,3}/g, '')       // code spans/blocks → drop entirely
       .replace(/#{1,6}\s*/g, '')                // headings
       .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → keep label
       .replace(/[_~]/g, '')                     // underline/strikethrough chars
       .replace(/^[-*]{3,}\s*$/gm, '')           // --- or *** separators
       .replace(/^\|.*\|$/gm, '')                // markdown table rows
       .replace(/\p{Emoji}/gu, '')               // emoji
       // clean up orphaned punctuation left after code-span removal
       .replace(/\s*→\s*/g, ' ')                 // → arrow (common in agent output)
       .replace(/^[-*+]\s*$/gm, '')              // bullet with no content after strip
       .replace(/^[-*+]\s*—\s*/gm, '')           // "- —" bullet+dash with no content
       .replace(/ {2,}/g, ' ')                   // multiple spaces → single
       .replace(/\n{2,}/g, '\n')                 // collapse blank lines
       .trim();

    const flushSentence = (text: string, _force = false) => {
      if (!text.trim() || signal.aborted) return;
      if (mode !== 'voice') return;
      ttsQueue = ttsQueue.then(async () => {
        if (signal.aborted) return;
        try {
          const clean = stripMarkdown(text.trim());
          if (!clean) return;
          console.log(`[PIPELINE] TTS sentence: "${clean.slice(0, 50)}…"`);
          const uri = await tts(clean, signal);
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
        onDone: (result) => {
          onDone();
          if (mode === 'chat') {
            this.cb.onStateChange('idle');
          }
          resolve();
        },
        onError: (e) => {
          if (e.name === 'AbortError' || e.message === 'Cancelled') {
            this._pipelineRunning = false;
            resolve();
            return;
          }
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
    this._playResolve?.();
    this._playResolve = null;
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

// Generic A2A v1.0 Part → CardModel dispatch.
// Content category is determined by which field is present: text / url+raw / data.
// No agent-specific pattern matching — the agent controls the output shape.
function artifactsToCards(artifacts: A2AArtifact[]): CardModel[] {
  const cards: CardModel[] = [];
  for (const artifact of artifacts) {
    for (const part of artifact.parts) {
      const card = partToCard(part);
      if (card) cards.push(card);
    }
  }
  return cards;
}

function partToCard(part: import('../ai/A2AClient').A2APart): CardModel | null {
  const id = `a2a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const createdAt = Date.now();
  const mime = part.mediaType ?? 'application/octet-stream';
  const isImage = mime.startsWith('image/');

  // Remote URL — image renders inline; anything else is a downloadable file card
  if (part.url != null) {
    if (isImage) {
      return { id, type: 'image', createdAt, uri: part.url, fileName: part.filename ?? 'image', mimeType: mime };
    }
    return { id, type: 'file', createdAt, fileName: part.filename ?? 'file', sizeBytes: 0, mimeType: mime, remoteUri: part.url };
  }

  // Inline base64 bytes — decode to a data URI so the card can render/open it
  if (part.raw != null) {
    const dataUri = `data:${mime};base64,${part.raw}`;
    if (isImage) {
      return { id, type: 'image', createdAt, uri: dataUri, fileName: part.filename ?? 'image', mimeType: mime };
    }
    // For non-image raw bytes expose as a file card with a data URI so FileCard's "Open ↗" still works
    return { id, type: 'file', createdAt, fileName: part.filename ?? 'file', sizeBytes: 0, mimeType: mime, remoteUri: dataUri };
  }

  // Structured data — JSON preview as text card
  if (part.data !== undefined) {
    const preview = typeof part.data === 'string' ? part.data : JSON.stringify(part.data, null, 2);
    return { id, type: 'text', createdAt, markdown: preview };
  }

  // Artifact text part — secondary content (code block, table, summary) shown as card
  if (part.text) {
    return { id, type: 'text', createdAt, markdown: part.text };
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
