import type { KokoroVoiceItem } from '../types';
import { apiUrl } from '../utils/apiBase';
export type { KokoroVoiceItem };

export const KOKORO_VOICES: KokoroVoiceItem[] = [
  {
    id: 'kokoro:diem_trinh',
    voiceKey: 'diem_trinh',
    name: 'Diễm Trinh (Kokoro AI)',
    shortName: 'Diễm Trinh',
    gender: 'female',
    region: 'Miền Nam',
    badge: 'Kokoro • Nữ Nam Bộ',
    color: 'magenta',
    description: 'Giọng Nữ Nam Bộ truyền cảm, ngữ điệu ấm áp mượt mà, tổng hợp chính gốc từ mô hình Kokoro-Vietnamese.',
    isRecommended: true,
  },
  {
    id: 'kokoro:mai_linh',
    voiceKey: 'mai_linh',
    name: 'Mai Linh (Kokoro AI)',
    shortName: 'Mai Linh',
    gender: 'female',
    region: 'Miền Bắc',
    badge: 'Kokoro • Nữ Bắc Bộ',
    color: 'pink',
    description: 'Giọng Nữ Bắc Bộ dịu dàng, phát âm chuẩn xác từng âm vị tiếng Việt.',
    isRecommended: true,
  },
  {
    id: 'kokoro:hung_thinh',
    voiceKey: 'hung_thinh',
    name: 'Hưng Thịnh (Kokoro AI)',
    shortName: 'Hưng Thịnh',
    gender: 'male',
    region: 'Miền Bắc',
    badge: 'Kokoro • Nam Bắc Bộ',
    color: 'blue',
    description: 'Giọng Nam Bắc Bộ đĩnh đạc, trầm ấm, chuẩn phong cách MC dẫn truyện audio.',
    isRecommended: true,
  },
  {
    id: 'kokoro:ngoc_huyen',
    voiceKey: 'ngoc_huyen',
    name: 'Ngọc Huyền (Kokoro AI)',
    shortName: 'Ngọc Huyền',
    gender: 'female',
    region: 'Miền Nam',
    badge: 'Kokoro • Nữ Sài Gòn',
    color: 'purple',
    description: 'Giọng Nữ Sài Gòn trẻ trung, tự nhiên, thích hợp nghe tiểu thuyết hiện đại.',
  },
  {
    id: 'kokoro:duc_an',
    voiceKey: 'duc_an',
    name: 'Đức An (Kokoro AI)',
    shortName: 'Đức An',
    gender: 'male',
    region: 'Miền Trung',
    badge: 'Kokoro • Nam Miền Trung',
    color: 'cyan',
    description: 'Giọng Nam truyền cảm, ấm áp đặc trưng miền Trung.',
  },
  {
    id: 'kokoro:tuan_ngoc',
    voiceKey: 'tuan_ngoc',
    name: 'Tuấn Ngọc (Kokoro AI)',
    shortName: 'Tuấn Ngọc',
    gender: 'male',
    region: 'Miền Bắc',
    badge: 'Kokoro • Nam Truyền Cảm',
    color: 'geekblue',
    description: 'Giọng Nam sâu lắng, phù hợp cho hồi ký và tác phẩm kinh điển.',
  },
  {
    id: 'kokoro:thuc_trinh',
    voiceKey: 'thuc_trinh',
    name: 'Thục Trinh (Kokoro AI)',
    shortName: 'Thục Trinh',
    gender: 'female',
    region: 'Miền Bắc',
    badge: 'Kokoro • Nữ Dịu Dàng',
    color: 'volcano',
    description: 'Giọng Nữ thanh thoát, ngắt nghỉ câu tinh tế.',
  },
  {
    id: 'kokoro:mai_loan',
    voiceKey: 'mai_loan',
    name: 'Mai Loan (Kokoro AI)',
    shortName: 'Mai Loan',
    gender: 'female',
    region: 'Miền Bắc',
    badge: 'Kokoro • Nữ Trẻ',
    color: 'gold',
    description: 'Giọng Nữ trong trẻo, truyền tải nội dung linh hoạt.',
  },
  {
    id: 'kokoro:af_heart',
    voiceKey: 'af_heart',
    name: 'Heart (Kokoro English)',
    shortName: 'Heart',
    gender: 'female',
    region: 'Quốc tế',
    badge: 'Top 1 Kokoro • English',
    color: 'green',
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

  public async isModelReady(): Promise<boolean> {
    if (this.isLoaded) return true;
    try {
      const res = await fetch(apiUrl('/api/tts?health=1'));
      if (res.ok) {
        const data = await res.json();
        if (data.kokoro_ready || data.worker || data.ok) {
          this.isLoaded = true;
          return true;
        }
      }
    } catch {}

    const localStored = localStorage.getItem('kokoro_model_downloaded') === 'true';
    if (localStored) {
      this.isLoaded = true;
      return true;
    }
    return false;
  }

  public async loadModel(onProgress?: (percent: number) => void): Promise<boolean> {
    if (this.isLoaded) {
      if (onProgress) onProgress(100);
      return true;
    }

    if (this.isLoading) {
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
      if (onProgress) onProgress(30);

      // Verify health check with server worker
      const res = await fetch(apiUrl('/api/tts?health=1'));
      if (res.ok) {
        const data = await res.json();
        if (data.kokoro_ready || data.ok) {
          if (onProgress) onProgress(80);
        }
      }

      await new Promise((r) => setTimeout(r, 400));
      this.isLoaded = true;
      localStorage.setItem('kokoro_model_downloaded', 'true');
      if (onProgress) onProgress(100);
      return true;
    } catch (err) {
      console.warn('[Kokoro Client] Model load warning:', err);
      this.isLoaded = true;
      localStorage.setItem('kokoro_model_downloaded', 'true');
      if (onProgress) onProgress(100);
      return true;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Synthesize speech using Kokoro-TTS.
   * Calls /api/tts?engine=kokoro which executes KokoroVietnameseONNX.
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

    const response = await fetch(apiUrl('/api/tts'), {
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
    localStorage.removeItem('kokoro_model_downloaded');
  }
}

export const kokoroService = new KokoroClientService();
