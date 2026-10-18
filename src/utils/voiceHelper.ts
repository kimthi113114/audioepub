import { getPiperVoiceById } from './piperVoices';
import { getEdgeVoiceById } from '../services/edgeTTSService';
import { getKokoroVoiceById } from '../services/kokoroClientService';
import { getVieNeuVoiceById } from '../services/vieneuService';

export function formatVoiceInfo(v: SpeechSynthesisVoice | string): {
  displayName: string;
  badge: string;
  color: string;
  isNatural: boolean;
  isVN: boolean;
} {
  // If passed a string voiceURI
  if (typeof v === 'string') {
    const edgeVoice = getEdgeVoiceById(v);
    if (edgeVoice) {
      return {
        displayName: edgeVoice.name,
        badge: edgeVoice.badge,
        color: edgeVoice.color,
        isNatural: true,
        isVN: edgeVoice.lang.startsWith('vi'),
      };
    }

    const kokoroVoice = getKokoroVoiceById(v);
    if (kokoroVoice) {
      return {
        displayName: kokoroVoice.name,
        badge: kokoroVoice.badge,
        color: kokoroVoice.color,
        isNatural: true,
        isVN: !kokoroVoice.region.includes('Quốc tế'),
      };
    }

    const vieneuVoice = getVieNeuVoiceById(v);
    if (vieneuVoice) {
      return {
        displayName: vieneuVoice.name,
        badge: vieneuVoice.badge,
        color: vieneuVoice.color,
        isNatural: true,
        isVN: true,
      };
    }

    if (v.startsWith('piper:')) {
      const piperVoice = getPiperVoiceById(v);
      if (piperVoice) {
        return {
          displayName: piperVoice.name,
          badge: `AI • ${piperVoice.badge}`,
          color: piperVoice.color,
          isNatural: true,
          isVN: true,
        };
      }
      return {
        displayName: 'Giọng AI Tự Nhiên',
        badge: 'Piper Neural',
        color: 'magenta',
        isNatural: true,
        isVN: true,
      };
    }

    // String matches known system voices
    const raw = v;
    if (raw.includes('Hoài My') || raw.includes('HoaiMy')) {
      return {
        displayName: 'Hoài My (Studio)',
        badge: '🌟 Studio • Nữ Nam Bộ',
        color: 'magenta',
        isNatural: true,
        isVN: true,
      };
    }
    if (raw.includes('Nam Minh') || raw.includes('NamMinh')) {
      return {
        displayName: 'Nam Minh (Studio)',
        badge: '🌟 Studio • Nam Bắc Bộ',
        color: 'blue',
        isNatural: true,
        isVN: true,
      };
    }
    if (raw.includes('Linh')) {
      return {
        displayName: 'Linh (Apple)',
        badge: 'Nữ • iOS Safari',
        color: 'purple',
        isNatural: true,
        isVN: true,
      };
    }
    if (raw.includes('An') && (raw.toLowerCase().includes('vietnam') || raw.toLowerCase().includes('vi-vn'))) {
      return {
        displayName: 'An (Apple)',
        badge: 'Nam • iOS Safari',
        color: 'cyan',
        isNatural: true,
        isVN: true,
      };
    }
    if (raw.includes('Google') && (raw.toLowerCase().includes('vietnam') || raw.toLowerCase().includes('vi-vn'))) {
      return {
        displayName: 'Google Tiếng Việt',
        badge: 'Chuẩn Google',
        color: 'green',
        isNatural: false,
        isVN: true,
      };
    }
    if (raw.includes('Jenny')) {
      return {
        displayName: 'Jenny (US)',
        badge: 'Nữ • English',
        color: 'purple',
        isNatural: true,
        isVN: false,
      };
    }
    if (raw.includes('Guy')) {
      return {
        displayName: 'Guy (US)',
        badge: 'Nam • English',
        color: 'cyan',
        isNatural: true,
        isVN: false,
      };
    }
    return {
      displayName: raw.slice(0, 24),
      badge: 'Hệ thống',
      color: 'default',
      isNatural: false,
      isVN: raw.toLowerCase().includes('vi'),
    };
  }

  // Handle SpeechSynthesisVoice object
  const name = v.name;
  const isVN = v.lang.toLowerCase().startsWith('vi') || name.toLowerCase().includes('vietnam');

  if (name.includes('Hoài My') || name.includes('HoaiMy')) {
    return {
      displayName: 'Hoài My',
      badge: 'Nữ • Miền Nam (Tự nhiên)',
      color: 'magenta',
      isNatural: true,
      isVN: true,
    };
  }
  if (name.includes('Nam Minh') || name.includes('NamMinh')) {
    return {
      displayName: 'Nam Minh',
      badge: 'Nam • Miền Bắc (Tự nhiên)',
      color: 'blue',
      isNatural: true,
      isVN: true,
    };
  }
  if (name.includes('Linh')) {
    return {
      displayName: 'Linh (Apple)',
      badge: 'Nữ • iOS Safari',
      color: 'purple',
      isNatural: true,
      isVN: true,
    };
  }
  if (name.includes('An') && isVN) {
    return {
      displayName: 'An (Apple)',
      badge: 'Nam • iOS Safari',
      color: 'cyan',
      isNatural: true,
      isVN: true,
    };
  }
  if (name.includes('Google') && isVN) {
    return {
      displayName: 'Google Tiếng Việt',
      badge: 'Chuẩn Google',
      color: 'green',
      isNatural: false,
      isVN: true,
    };
  }

  const cleanName = name
    .replace(/^Microsoft\s+/i, '')
    .replace(/^Google\s+/i, '')
    .replace(/\s+Online\s+\(Natural\)/i, '')
    .replace(/\s+-\s+Vietnamese\s+\(Vietnam\)/i, '')
    .replace(/\s+\(Vietnam\)/i, '');

  return {
    displayName: cleanName || name,
    badge: v.lang,
    color: isVN ? 'green' : 'default',
    isNatural: name.includes('Natural'),
    isVN,
  };
}
