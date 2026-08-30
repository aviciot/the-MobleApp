import * as FileSystem from 'expo-file-system/legacy';
import { GATEWAY } from '../config';

function headers(): Record<string, string> {
  const h: Record<string, string> = {};
  if (GATEWAY.token) h['Authorization'] = `Bearer ${GATEWAY.token}`;
  return h;
}

function url(path: string) {
  const slug = GATEWAY.voiceSlug || 'ep-voice-1';
  return `${GATEWAY.baseUrl}/apps/${slug}${path}`;
}

// POST audio file → returns transcribed text
export async function transcribeAudio(audioUri: string, signal?: AbortSignal): Promise<string> {
  const response = await FileSystem.uploadAsync(
    url('/voice/transcribe'),
    audioUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'audio',
      mimeType: 'audio/m4a',
      headers: headers(),
    },
  );

  if (response.status !== 200) {
    const body = JSON.parse(response.body || '{}');
    throw new GatewayError(response.status, body.detail ?? 'Transcription failed');
  }

  const { text } = JSON.parse(response.body);
  if (!text) throw new GatewayError(200, 'Empty transcription');
  return text as string;
}

// POST text → downloads MP3 to a temp file, returns local URI for playback
export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<string> {
  const destUri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;

  const response = await FileSystem.downloadAsync(
    url('/voice/tts'),
    destUri,
    {
      headers: {
        ...headers(),
        'Content-Type': 'application/json',
      },
    },
  );

  // downloadAsync uses GET — for POST we need fetch + write manually
  // Use fetch for the POST, write body to file
  if (response.status !== 200) {
    throw new GatewayError(response.status, 'TTS failed');
  }

  return destUri;
}

// POST text → fetch binary → write to temp file → return URI
export async function tts(text: string, signal?: AbortSignal): Promise<string> {
  const t0 = Date.now();
  const endpoint = url('/voice/tts');
  console.log(`\n━━━ [TTS] REQUEST ━━━`);
  console.log(`  url:  ${endpoint}`);
  console.log(`  text: "${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });

  console.log(`  ↳ status: ${res.status}  (${Date.now() - t0}ms)`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.log(`  ✗ error: ${JSON.stringify(body)}`);
    throw new GatewayError(res.status, body.detail ?? 'TTS failed');
  }

  const buffer = await res.arrayBuffer();
  console.log(`  ↳ buffer size: ${buffer.byteLength} bytes`);
  const base64 = arrayBufferToBase64(buffer);
  const destUri = FileSystem.cacheDirectory + `tts_${Date.now()}.mp3`;
  try {
    await FileSystem.writeAsStringAsync(destUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log(`  ↳ audio saved: ${destUri}  (${Date.now() - t0}ms total)`);
  } catch (e: any) {
    console.log(`  ✗ write failed: ${e?.message ?? e}`);
    throw new GatewayError(500, `Failed to save audio: ${e?.message}`);
  }
  console.log(`━━━ [TTS] DONE ━━━\n`);
  return destUri;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export class GatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'GatewayError';
  }
}
