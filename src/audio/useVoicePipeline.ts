import { useEffect, useRef, useCallback } from 'react';
import { useAudioRecorder, useAudioPlayer, RecordingPresets } from 'expo-audio';
import type { SharedValue } from 'react-native-reanimated';
import { withTiming } from 'react-native-reanimated';
import { VoiceController } from './VoiceController';
import { useSessionStore } from '../store/sessionStore';
import { useTranscriptStore } from '../store/transcriptStore';
import { useCardStore } from '../store/cardStore';

interface UseVoicePipelineOptions {
  energy: SharedValue<number>;
  amplitude: SharedValue<number>;
}

export function useVoicePipeline({ energy, amplitude }: UseVoicePipelineOptions) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(null);

  const controller = useRef<VoiceController | null>(null);
  const { setState } = useSessionStore();
  const { appendToken, setLiveSpeaker, finalizeTurn } = useTranscriptStore();
  const { addCard } = useCardStore();

  useEffect(() => {
    controller.current = new VoiceController({
      onStateChange: (state) => {
        switch (state) {
          case 'recording':
            setState('userSpeaking');
            setLiveSpeaker('user');
            break;
          case 'transcribing':
          case 'thinking':
            finalizeTurn();
            setState('thinking');
            break;
          case 'speaking':
            setState('aiSpeaking');
            setLiveSpeaker('ai');
            break;
          case 'idle':
            finalizeTurn();
            setState('idle');
            break;
          case 'error':
            setState('idle');
            break;
        }
      },
      onTranscript: (text) => appendToken(text),
      onReply: (text) => appendToken(text),
      onCards: (cards) => cards.forEach((card) => addCard(card)),
      onError: (message) => {
        addCard({
          id: `err-${Date.now()}`,
          type: 'status',
          text: message,
          level: 'error',
          autoDismissMs: 4000,
          createdAt: Date.now(),
        });
      },
      onUserLevel: (level) => {
        amplitude.value = level * 0.5;
        energy.value = 0.3 + level * 0.6;
      },
      onAiLevel: (level) => {
        amplitude.value = level * 0.4;
        energy.value = 0.4 + level * 0.5;
      },
    });

    return () => {
      controller.current?.destroy();
      controller.current = null;
    };
  }, []);

  // Keep player ref in sync with controller
  useEffect(() => {
    controller.current?.setPlayer(player);
  }, [player]);

  const startRecording = useCallback(async () => {
    controller.current?.abort();
    await controller.current?.startRecording(recorder);
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    await controller.current?.stopRecording();
  }, []);

  const cancel = useCallback(() => {
    controller.current?.abort();
    finalizeTurn();
    setState('idle');
    amplitude.value = withTiming(0.05, { duration: 400 });
    energy.value = withTiming(0.3, { duration: 400 });
  }, []);

  return { startRecording, stopRecording, cancel };
}
