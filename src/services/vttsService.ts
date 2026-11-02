/**
 * V-TTS: Vietnamese VITS voices that run entirely in the browser (ONNX Runtime Web, WebAssembly).
 * No server needed, so it works on the static GitHub Pages build.
 *
 * Models: https://huggingface.co/letrggghieu/v-tts-onnx (cc-by-nc-2.0: personal / non-commercial use).
 * Pipeline: Vietnamese G2P -> text encoder -> duration predictor -> flow (reverse) -> HiFi-GAN decoder.
 * Speed: ~RTF 1.0 single-threaded, ~0.2 with multi-threaded WASM (needs cross-origin isolation, see
 * public/coi-serviceworker.js and the dev-server headers).
 */
import type { VttsVoiceItem } from '../types';
import { addBlanks, textToPhonemes } from './vtts/vietnameseG2P';

export type { VttsVoiceItem };

const MODEL_BASE = 'https://huggingface.co/letrggghieu/v-tts-onnx/resolve/main/';
const ORT_URL = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/ort.min.js';
const CACHE_NAME = 'audioepub-vtts-v1';

/** Files and approximate sizes (bytes) for the progress bar. */
const MODEL_FILES = [
  { name: 'text_encoder.onnx', size: 28_100_000 },
  { name: 'duration_predictor.onnx', size: 2_200_000 },
  { name: 'flow.onnx', size: 82_800_000 },
  { name: 'decoder.onnx', size: 59_700_000 },
  { name: 'tts_config.json', size: 20_000 },
] as const;
export const VTTS_TOTAL_BYTES = MODEL_FILES.reduce((n, f) => n + f.size, 0);

export const VTTS_VOICES: VttsVoiceItem[] = [
  {
    id: 'vtts:0', voiceKey: '0', name: 'NF · Bắc Nữ (V-TTS)', shortName: 'NF', gender: 'female', region: 'Miền Bắc',
    badge: 'V-TTS • Nữ Bắc', color: 'magenta', description: 'Giọng nữ miền Bắc rõ ràng, trang trọng.', isRecommended: true,
  },
  {
    id: 'vtts:1', voiceKey: '1', name: 'SF · Nam Nữ (V-TTS)', shortName: 'SF', gender: 'female', region: 'Miền Nam',
    badge: 'V-TTS • Nữ Nam', color: 'pink', description: 'Giọng nữ miền Nam ấm áp, thân thiện.', isRecommended: true,
  },
  {
    id: 'vtts:2', voiceKey: '2', name: 'NM1 · Bắc Nam (V-TTS)', shortName: 'NM1', gender: 'male', region: 'Miền Bắc',
    badge: 'V-TTS • Nam Bắc', color: 'blue', description: 'Giọng nam miền Bắc chuyên nghiệp.', isRecommended: true,
  },
  {
    id: 'vtts:3', voiceKey: '3', name: 'SM · Nam Nam (V-TTS)', shortName: 'SM', gender: 'male', region: 'Miền Nam',
    badge: 'V-TTS • Nam Nam', color: 'cyan', description: 'Giọng nam miền Nam gần gũi, như đang trò chuyện.',
  },
  {
    id: 'vtts:4', voiceKey: '4', name: 'NM2 · Bắc Nam 2 (V-TTS)', shortName: 'NM2', gender: 'male', region: 'Miền Bắc',
    badge: 'V-TTS • Nam Bắc 2', color: 'geekblue', description: 'Giọng nam miền Bắc trầm, uy nghiêm.',
  },
];

export const getVttsVoiceById = (id: string): VttsVoiceItem | undefined => VTTS_VOICES.find((v) => v.id === id);

// ---------------------------------------------------------------- onnxruntime-web
type Ort = any; // loaded from the CDN, no bundled typings

let ortPromise: Promise<Ort> | null = null;
const loadOrt = (): Promise<Ort> => {
  if (!ortPromise) {
    ortPromise = new Promise<Ort>((resolve, reject) => {
      const w = window as unknown as { ort?: Ort };
      if (w.ort) return resolve(w.ort);
      const script = document.createElement('script');
      script.src = ORT_URL;
      script.crossOrigin = 'anonymous'; // required when the page is cross-origin isolated
      script.onload = () => resolve((window as unknown as { ort: Ort }).ort);
      script.onerror = () => {
        ortPromise = null;
        reject(new Error('Không tải được onnxruntime-web (cần mạng lần đầu)'));
      };
      document.head.appendChild(script);
    });
  }
  return ortPromise;
};

// ---------------------------------------------------------------- model files (Cache Storage)
const hasCacheStorage = typeof caches !== 'undefined';

export async function isModelDownloaded(): Promise<boolean> {
  if (!hasCacheStorage) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const f of MODEL_FILES) if (!(await cache.match(MODEL_BASE + f.name))) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchModelFile(
  name: string,
  onBytes: (delta: number) => void
): Promise<ArrayBuffer> {
  const url = MODEL_BASE + name;
  const cache = hasCacheStorage ? await caches.open(CACHE_NAME).catch(() => null) : null;
  const hit = await cache?.match(url);
  if (hit) {
    const buf = await hit.arrayBuffer();
    onBytes(buf.byteLength);
    return buf;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Tải ${name} thất bại (${res.status})`);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onBytes(buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    received += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  try {
    await cache?.put(url, new Response(out, { headers: { 'content-type': 'application/octet-stream' } }));
  } catch {
    /* quota exceeded: keep working without the cache */
  }
  return out.buffer;
}

// ---------------------------------------------------------------- sessions
interface Sessions {
  ort: Ort;
  encoder: any;
  duration: any;
  flow: any;
  decoder: any;
  config: any;
}
let sessions: Sessions | null = null;
let loading: Promise<Sessions> | null = null;

/** Download (first time) and create the four ONNX sessions. */
export function loadModel(onProgress?: (percent: number) => void): Promise<Sessions> {
  if (sessions) {
    onProgress?.(100);
    return Promise.resolve(sessions);
  }
  if (loading) return loading;
  loading = (async () => {
    const ort = await loadOrt();
    // Multi-threaded WASM only works when the page is cross-origin isolated
    ort.env.wasm.numThreads = self.crossOriginIsolated
      ? Math.min(8, Math.max(2, navigator.hardwareConcurrency || 4))
      : 1;

    let loaded = 0;
    const bump = (d: number) => {
      loaded += d;
      onProgress?.(Math.min(99, Math.round((loaded / VTTS_TOTAL_BYTES) * 100)));
    };
    const create = async (name: string) =>
      ort.InferenceSession.create(new Uint8Array(await fetchModelFile(name, bump)), {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

    const encoder = await create('text_encoder.onnx');
    const duration = await create('duration_predictor.onnx');
    const flow = await create('flow.onnx');
    const decoder = await create('decoder.onnx');
    const config = JSON.parse(new TextDecoder().decode(await fetchModelFile('tts_config.json', bump)));
    sessions = { ort, encoder, duration, flow, decoder, config };
    onProgress?.(100);
    return sessions;
  })().finally(() => {
    loading = null;
  });
  return loading;
}

export async function deleteModel(): Promise<void> {
  sessions = null;
  loading = null;
  if (hasCacheStorage) await caches.delete(CACHE_NAME);
}

// ---------------------------------------------------------------- synthesis
const toWav = (samples: Float32Array, sampleRate: number): Blob => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const str = (o: number, t: string) => {
    for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
};

/** Synthesize `text` with speaker 0-4 and return a 24 kHz WAV blob. Runs one request at a time. */
export async function synthesize(text: string, speakerId: number = 1): Promise<Blob> {
  if (!sessions && !(await isModelDownloaded())) throw new Error('Mô hình V-TTS chưa được tải về');
  const { ort, encoder, duration, flow, decoder, config } = await loadModel();

  const g2p = addBlanks(textToPhonemes(text, config.symbol_to_id, config.language_id_map['VI']), config.language_id_map['VI']);
  const { phonemes, tones, languages } = g2p;
  const n = phonemes.length;
  if (!n) throw new Error('Không có âm tiết để đọc');

  const i64 = (arr: number[], dims: number[]) => new ort.Tensor('int64', BigInt64Array.from(arr, BigInt), dims);
  const enc = await encoder.run({
    phone_ids: i64(phonemes, [1, n]),
    phone_lengths: i64([n], [1]),
    tone_ids: i64(tones, [1, n]),
    language_ids: i64(languages, [1, n]),
    bert: new ort.Tensor('float32', new Float32Array(1024 * n), [1, 1024, n]),
    ja_bert: new ort.Tensor('float32', new Float32Array(768 * n), [1, 768, n]),
    speaker_id: i64([speakerId], [1]),
  });
  const { x_encoded: xEncoded, m_p: mP, logs_p: logsP, x_mask: xMask, g } = enc;

  const dp = await duration.run({ x: xEncoded, x_mask: xMask, g });
  const logw = dp.logw.data as Float32Array;
  const mask = xMask.data as Float32Array;
  const durations: number[] = [];
  let frames = 0;
  for (let i = 0; i < logw.length; i++) {
    const d = Math.ceil(Math.exp(logw[i]) * mask[i]);
    durations.push(d);
    frames += d;
  }

  // Expand the prior to frame level and sample z_p = m + exp(logs) * noise
  const channels = mP.dims[1] as number;
  const mPData = mP.data as Float32Array;
  const logsData = logsP.data as Float32Array;
  const zP = new Float32Array(channels * frames);
  let frame = 0;
  for (let t = 0; t < durations.length; t++) {
    for (let d = 0; d < durations[t]; d++, frame++) {
      for (let c = 0; c < channels; c++) {
        const noise = (Math.random() * 2 - 1) * 0.667;
        zP[c * frames + frame] = mPData[c * n + t] + Math.exp(logsData[c * n + t]) * noise;
      }
    }
  }

  const flowOut = await flow.run({
    z_p: new ort.Tensor('float32', zP, [1, channels, frames]),
    y_mask: new ort.Tensor('float32', new Float32Array(frames).fill(1), [1, 1, frames]),
    g,
  });
  const dec = await decoder.run({ z: flowOut.z, g });
  return toWav(dec.audio.data as Float32Array, config.sample_rate as number);
}
