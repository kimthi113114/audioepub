import type { KokoroVoiceItem } from '../types';
export type { KokoroVoiceItem };

export const KOKORO_VOICES: KokoroVoiceItem[] = [
  {
    id: 'kokoro:diem_trinh',
    voiceKey: 'diem_trinh',
    name: 'Diễm Trinh (Kokoro)',
    shortName: 'Diễm Trinh',
    gender: 'female',
    region: 'Miền Nam',
    badge: '100% Client • Nữ Nam Bộ',
    color: 'magenta',
    description: 'Giọng Nữ Nam Bộ truyền cảm, ngữ điệu ấm áp mượt mà, chạy hoàn toàn bằng WebGPU trên máy khách.',
    isRecommended: true,
  },
  {
    id: 'kokoro:mai_linh',
    voiceKey: 'mai_linh',
    name: 'Mai Linh (Kokoro)',
    shortName: 'Mai Linh',
    gender: 'female',
    region: 'Miền Bắc',
    badge: '100% Client • Nữ Bắc Bộ',
    color: 'pink',
    description: 'Giọng Nữ Bắc Bộ dịu dàng, phát âm chuẩn xác từng âm vị tiếng Việt.',
    isRecommended: true,
  },
  {
    id: 'kokoro:hung_thinh',
    voiceKey: 'hung_thinh',
    name: 'Hưng Thịnh (Kokoro)',
    shortName: 'Hưng Thịnh',
    gender: 'male',
    region: 'Miền Bắc',
    badge: '100% Client • Nam Bắc Bộ',
    color: 'blue',
    description: 'Giọng Nam Bắc Bộ đĩnh đạc, trầm ấm, chuẩn phong cách MC dẫn truyện.',
    isRecommended: true,
  },
  {
    id: 'kokoro:ngoc_huyen',
    voiceKey: 'ngoc_huyen',
    name: 'Ngọc Huyền (Kokoro)',
    shortName: 'Ngọc Huyền',
    gender: 'female',
    region: 'Miền Nam',
    badge: '100% Client • Nữ Sài Gòn',
    color: 'purple',
    description: 'Giọng Nữ Sài Gòn trẻ trung, tự nhiên, thích hợp nghe tiểu thuyết hiện đại.',
  },
  {
    id: 'kokoro:af_heart',
    voiceKey: 'af_heart',
    name: 'Heart (Kokoro English)',
    shortName: 'Heart',
    gender: 'female',
    region: 'Quốc tế',
    badge: 'Top 1 Kokoro • English',
    color: 'volcano',
    description: 'Giọng đọc tiếng Anh số 1 của Kokoro-82M, ngữ điệu biểu cảm đạt điểm thẩm định cao nhất.',
  },
];

export function getKokoroVoiceById(id: string): KokoroVoiceItem | undefined {
  return KOKORO_VOICES.find((v) => v.id === id);
}

// Convert raw Float32Array PCM to 16-bit PCM WAV Blob
export function float32ToWavBlob(samples: Float32Array, sampleRate: number = 24000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 1 * 2)
  view.setUint32(28, sampleRate * 2, true);
  // block align (1 * 2)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write samples (float32 to 16-bit PCM with clipping)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

class KokoroClientService {
  private isLoaded: boolean = false;
  private isLoading: boolean = false;
  private ttsInstance: any = null;

  public async isModelReady(): Promise<boolean> {
    if (this.isLoaded && this.ttsInstance) return true;
    if (typeof window === 'undefined') return false;

    // Check CacheStorage for cached model weights
    try {
      if ('caches' in window) {
        const keys = await window.caches.keys();
        const hasKokoroCache = keys.some((k) => k.includes('transformers') || k.includes('kokoro'));
        if (hasKokoroCache) {
          const kokoroDownloaded = localStorage.getItem('kokoro_model_downloaded') === 'true';
          return kokoroDownloaded;
        }
      }
    } catch {}

    return localStorage.getItem('kokoro_model_downloaded') === 'true';
  }

  public async loadModel(onProgress?: (percent: number) => void): Promise<boolean> {
    if (this.isLoaded) {
      if (onProgress) onProgress(100);
      return true;
    }

    if (this.isLoading) {
      // Already loading, wait
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (this.isLoaded) {
            clearInterval(interval);
            resolve(true);
          }
        }, 300);
      });
    }

    this.isLoading = true;

    try {
      // Dynamic import of kokoro-js in browser context
      const { KokoroTTS } = await import('kokoro-js');
      
      const modelId = 'onnx-community/Kokoro-82M-v1.0-ONNX';
      
      // Determine device: WebGPU if available, otherwise WASM
      let device: 'webgpu' | 'wasm' = 'wasm';
      if (typeof navigator !== 'undefined' && (navigator as any).gpu) {
        device = 'webgpu';
      }

      this.ttsInstance = await KokoroTTS.from_pretrained(modelId, {
        dtype: 'q8',
        device,
        progress_callback: (item: any) => {
          if (item && item.progress !== undefined) {
            const pct = Math.round(item.progress);
            if (onProgress) onProgress(pct);
          }
        },
      });

      this.isLoaded = true;
      localStorage.setItem('kokoro_model_downloaded', 'true');
      if (onProgress) onProgress(100);
      return true;
    } catch (err) {
      console.warn('[Kokoro Client] WebGPU/WASM in-browser loading failed or unsupported:', err);
      // Mark fallback ready so app can fallback to proxy/preview
      this.isLoaded = false;
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Synthesize speech using Kokoro-TTS.
   * If model is loaded on client, generates 100% in-browser via WebGPU/WASM!
   * If model is not loaded or fails, falls back gracefully to /api/tts.
   */
  public async synthesize(
    text: string,
    voiceKey: string = 'diem_trinh',
    speed: number = 1.0
  ): Promise<Blob> {
    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Text cannot be empty');
    }

    // 1. Try In-Browser Client WebGPU/WASM if loaded
    if (this.isLoaded && this.ttsInstance) {
      try {
        const audio = await this.ttsInstance.generate(cleanText, {
          voice: voiceKey,
          speed,
        });

        if (audio && audio.audio) {
          // audio.audio is Float32Array, audio.sampling_rate is 24000
          return float32ToWavBlob(audio.audio, audio.sampling_rate || 24000);
        }
      } catch (err) {
        console.warn('[Kokoro Client] In-browser inference warning, falling back to server proxy:', err);
      }
    }

    // 2. High-performance fallback via /api/tts?engine=kokoro
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        voice: voiceKey,
        engine: 'kokoro',
        rate: speed,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Network error');
      throw new Error(`Kokoro TTS failed (${response.status}): ${errText}`);
    }

    return await response.blob();
  }

  public deleteModelCache(): void {
    this.isLoaded = false;
    this.ttsInstance = null;
    localStorage.removeItem('kokoro_model_downloaded');
  }
}

export const kokoroService = new KokoroClientService();
