import { apiUrl } from '../utils/apiBase';

export interface EdgeVoice {
  id: string; // e.g. 'vi-VN-HoaiMyNeural'
  name: string; // 'Hoài My'
  shortName: string; // 'Hoài My'
  gender: 'female' | 'male';
  region: 'Miền Nam' | 'Miền Bắc' | 'Quốc tế';
  lang: string;
  badge: string;
  color: string;
  description: string;
  isRecommended?: boolean;
}

export const EDGE_VOICES: EdgeVoice[] = [
  {
    id: 'vi-VN-HoaiMyNeural',
    name: 'Hoài My (Studio)',
    shortName: 'Hoài My',
    gender: 'female',
    region: 'Miền Nam',
    lang: 'vi-VN',
    badge: 'Khuyên Dùng • Nữ Nam Bộ',
    color: 'magenta',
    description: 'Giọng Nữ Nam Bộ ấm áp, truyền cảm, ngữ điệu tự nhiên chuyên đọc truyện audio và sách nói.',
    isRecommended: true,
  },
  {
    id: 'vi-VN-NamMinhNeural',
    name: 'Nam Minh (Studio)',
    shortName: 'Nam Minh',
    gender: 'male',
    region: 'Miền Bắc',
    lang: 'vi-VN',
    badge: 'Khuyên Dùng • Nam Bắc Bộ',
    color: 'blue',
    description: 'Giọng Nam Bắc Bộ rõ ràng, dứt khoát, chuẩn phong cách phát thanh viên đài truyền hình.',
    isRecommended: true,
  },
  {
    id: 'en-US-JennyNeural',
    name: 'Jenny (English)',
    shortName: 'Jenny',
    gender: 'female',
    region: 'Quốc tế',
    lang: 'en-US',
    badge: 'English • US',
    color: 'purple',
    description: 'Giọng Nữ tiếng Anh Mỹ tự nhiên, biểu cảm sinh động cho sách ngoại văn.',
  },
  {
    id: 'en-US-GuyNeural',
    name: 'Guy (English)',
    shortName: 'Guy',
    gender: 'male',
    region: 'Quốc tế',
    lang: 'en-US',
    badge: 'English • US',
    color: 'cyan',
    description: 'Giọng Nam tiếng Anh Mỹ trầm ấm, chuyên nghiệp.',
  },
  {
    id: 'zh-CN-XiaoxiaoNeural',
    name: 'Xiaoxiao (Chinese)',
    shortName: 'Xiaoxiao',
    gender: 'female',
    region: 'Quốc tế',
    lang: 'zh-CN',
    badge: 'Chinese • Phổ Thông',
    color: 'volcano',
    description: 'Giọng Nữ tiếng Trung chuẩn âm Bắc Kinh.',
  },
  {
    id: 'ja-JP-NanamiNeural',
    name: 'Nanami (Japanese)',
    shortName: 'Nanami',
    gender: 'female',
    region: 'Quốc tế',
    lang: 'ja-JP',
    badge: 'Japanese • Tokyo',
    color: 'pink',
    description: 'Giọng Nữ tiếng Nhật trong trẻo, nhẹ nhàng.',
  },
];

export function getEdgeVoiceById(id: string): EdgeVoice | undefined {
  return EDGE_VOICES.find((v) => v.id === id);
}

export function getDefaultEdgeVoice(): EdgeVoice {
  return EDGE_VOICES[0];
}

/**
 * Synthesize speech using Edge-TTS API proxy
 */
export async function fetchEdgeTTSBlob(
  text: string,
  voice: string = 'vi-VN-HoaiMyNeural',
  rate: number = 1.0,
  pitch: number = 1.0
): Promise<Blob> {
  const cleanText = text.trim();
  if (!cleanText) {
    throw new Error('Text to synthesize cannot be empty');
  }

  const response = await fetch(apiUrl('/api/tts'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: cleanText,
      voice,
      rate,
      pitch,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Network error');
    throw new Error(`Edge TTS API failed (${response.status}): ${errorText}`);
  }

  return await response.blob();
}

/**
 * Synthesize speech and return an object URL
 */
export async function fetchEdgeTTSAudioUrl(
  text: string,
  voice: string = 'vi-VN-HoaiMyNeural',
  rate: number = 1.0,
  pitch: number = 1.0
): Promise<string> {
  const blob = await fetchEdgeTTSBlob(text, voice, rate, pitch);
  return URL.createObjectURL(blob);
}
