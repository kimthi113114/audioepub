import type { VieNeuVoiceItem } from '../types';
export type { VieNeuVoiceItem };

export const VIENEU_VOICES: VieNeuVoiceItem[] = [
  {
    id: 'vieneu:minh_quan',
    voiceKey: 'minh_quan',
    name: 'Minh Quân (VieNeu 48kHz)',
    shortName: 'Minh Quân',
    gender: 'male',
    region: 'Miền Bắc',
    badge: 'Ultra HD 48kHz • Nam Bắc Bộ',
    color: 'blue',
    description: 'Giọng Nam Bắc Bộ phát thanh viên, độ phân giải 48kHz siêu sắc nét, tự nhiên từng âm tiết.',
    isRecommended: true,
  },
  {
    id: 'vieneu:phuong_trang',
    voiceKey: 'phuong_trang',
    name: 'Phương Trang (VieNeu 48kHz)',
    shortName: 'Phương Trang',
    gender: 'female',
    region: 'Miền Bắc',
    badge: 'Ultra HD 48kHz • Nữ Bắc Bộ',
    color: 'magenta',
    description: 'Giọng Nữ Bắc Bộ truyền hình, hỗ trợ các thẻ cảm xúc phong phú, biểu cảm tự nhiên như người thật.',
    isRecommended: true,
  },
  {
    id: 'vieneu:bao_ngoc',
    voiceKey: 'bao_ngoc',
    name: 'Bảo Ngọc (VieNeu 48kHz)',
    shortName: 'Bảo Ngọc',
    gender: 'female',
    region: 'Miền Nam',
    badge: 'Ultra HD 48kHz • Nữ Nam Bộ',
    color: 'pink',
    description: 'Giọng Nữ Nam Bộ ngọt ngào, ấm áp, ngắt nghỉ câu mượt mà chuyên biệt cho tiểu thuyết audio.',
  },
  {
    id: 'vieneu:tuan_kiet',
    voiceKey: 'tuan_kiet',
    name: 'Tuấn Kiệt (VieNeu 48kHz)',
    shortName: 'Tuấn Kiệt',
    gender: 'male',
    region: 'Miền Nam',
    badge: 'Ultra HD 48kHz • Nam Sài Gòn',
    color: 'cyan',
    description: 'Giọng Nam Sài Gòn trẻ trung, hiện đại, thích hợp cho sách khoa học và kỹ năng.',
  },
];

export function getVieNeuVoiceById(id: string): VieNeuVoiceItem | undefined {
  return VIENEU_VOICES.find((v) => v.id === id);
}

/**
 * Synthesize speech using VieNeu-TTS endpoint
 */
export async function fetchVieNeuTTSBlob(
  text: string,
  voice: string = 'minh_quan',
  rate: number = 1.0,
  pitch: number = 1.0
): Promise<Blob> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Text cannot be empty');
  }

  const response = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: cleanText,
      voice,
      engine: 'vieneu',
      rate,
      pitch,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Network error');
    throw new Error(`VieNeu TTS failed (${response.status}): ${errorText}`);
  }

  return await response.blob();
}
