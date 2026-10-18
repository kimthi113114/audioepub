import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// In-Memory LRU Cache for synthesized audio buffers
const MAX_CACHE_ENTRIES = 800;
const audioCache = new Map();

// Map of pre-initialized Edge-TTS instances per voice to keep WSS connections alive
const ttsInstances = new Map();

async function getTTSInstance(voiceName) {
  if (ttsInstances.has(voiceName)) {
    return ttsInstances.get(voiceName);
  }
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  ttsInstances.set(voiceName, tts);
  return tts;
}

// Kokoro in-memory instance for server-side acceleration
let kokoroInstance = null;
let kokoroLoading = false;

async function getKokoroInstance() {
  if (kokoroInstance) return kokoroInstance;
  if (kokoroLoading) {
    while (kokoroLoading) {
      await new Promise((r) => setTimeout(r, 200));
    }
    return kokoroInstance;
  }
  kokoroLoading = true;
  try {
    const { KokoroTTS } = await import('kokoro-js');
    kokoroInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8',
      device: 'cpu',
    });
    return kokoroInstance;
  } catch (err) {
    console.warn('[Server Kokoro] Init notice:', err.message);
    return null;
  } finally {
    kokoroLoading = false;
  }
}

export function createTTSMiddleware() {
  return async (req, res, next) => {
    // Only handle /api/tts
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/tts') {
      return next();
    }

    try {
      let text = '';
      let voice = 'vi-VN-HoaiMyNeural';
      let engine = 'edge';
      let rate = 1.0;
      let pitch = 1.0;

      if (req.method === 'GET') {
        text = url.searchParams.get('text') || '';
        voice = url.searchParams.get('voice') || 'vi-VN-HoaiMyNeural';
        engine = url.searchParams.get('engine') || 'edge';
        rate = parseFloat(url.searchParams.get('rate') || '1.0');
        pitch = parseFloat(url.searchParams.get('pitch') || '1.0');
      } else if (req.method === 'POST') {
        // Read JSON body
        const buffers = [];
        for await (const chunk of req) {
          buffers.push(chunk);
        }
        const bodyStr = Buffer.concat(buffers).toString('utf8');
        try {
          const data = JSON.parse(bodyStr || '{}');
          text = data.text || '';
          voice = data.voice || 'vi-VN-HoaiMyNeural';
          engine = data.engine || 'edge';
          rate = data.rate !== undefined ? parseFloat(data.rate) : 1.0;
          pitch = data.pitch !== undefined ? parseFloat(data.pitch) : 1.0;
        } catch {
          text = '';
        }
      } else {
        res.statusCode = 405;
        return res.end('Method Not Allowed');
      }

      const cleanText = text.trim();
      if (!cleanText) {
        res.statusCode = 400;
        return res.end('Missing text parameter');
      }

      // Check Cache
      const cacheKey = `${engine}:${voice}:${rate.toFixed(2)}:${pitch.toFixed(2)}:${cleanText}`;
      if (audioCache.has(cacheKey)) {
        const cached = audioCache.get(cacheKey);
        res.setHeader('Content-Type', cached.mimeType || 'audio/mpeg');
        res.setHeader('Content-Length', cached.buffer.length);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(cached.buffer);
      }

      // 1. Kokoro Direct Engine (English Top Voices)
      if ((engine === 'kokoro' || voice.startsWith('kokoro:')) && voice.includes('heart')) {
        const ktts = await getKokoroInstance();
        if (ktts) {
          const kokoroAudio = await ktts.generate(cleanText, {
            voice: 'af_heart',
            speed: rate,
          });
          const rawBuf = Buffer.from(
            kokoroAudio.toBlob().arrayBuffer
              ? await kokoroAudio.toBlob().arrayBuffer()
              : kokoroAudio.audio.buffer
          );
          audioCache.set(cacheKey, { buffer: rawBuf, mimeType: 'audio/wav' });
          res.setHeader('Content-Type', 'audio/wav');
          res.setHeader('Content-Length', rawBuf.length);
          res.setHeader('X-Cache', 'MISS');
          return res.end(rawBuf);
        }
      }

      // 2. Map Voice for VieNeu and Kokoro Vietnamese to optimized neural profiles
      let targetEdgeVoice = 'vi-VN-HoaiMyNeural';
      let effectiveRate = rate;
      let effectivePitch = pitch;

      if (voice === 'kokoro:diem_trinh' || voice === 'diem_trinh') {
        targetEdgeVoice = 'vi-VN-HoaiMyNeural';
        effectivePitch = 1.03; // slightly warmer
      } else if (voice === 'kokoro:mai_linh' || voice === 'mai_linh') {
        targetEdgeVoice = 'vi-VN-NamMinhNeural';
        effectivePitch = 1.25; // northern melodic
      } else if (voice === 'kokoro:hung_thinh' || voice === 'hung_thinh') {
        targetEdgeVoice = 'vi-VN-NamMinhNeural';
        effectivePitch = 0.95; // deep narrative
      } else if (voice === 'kokoro:ngoc_huyen' || voice === 'ngoc_huyen') {
        targetEdgeVoice = 'vi-VN-HoaiMyNeural';
        effectiveRate = 1.05;
      } else if (voice === 'vieneu:minh_quan' || voice === 'minh_quan') {
        targetEdgeVoice = 'vi-VN-NamMinhNeural';
        effectivePitch = 0.98; // broadcast announcer
      } else if (voice === 'vieneu:phuong_trang' || voice === 'phuong_trang') {
        targetEdgeVoice = 'vi-VN-HoaiMyNeural';
        effectivePitch = 1.08;
      } else if (voice === 'vieneu:bao_ngoc' || voice === 'bao_ngoc') {
        targetEdgeVoice = 'vi-VN-HoaiMyNeural';
        effectivePitch = 0.96;
      } else if (voice.startsWith('vi-') || voice.startsWith('en-') || voice.endsWith('Neural')) {
        targetEdgeVoice = voice;
      }

      // Format Prosody
      const ratePercent = Math.round((effectiveRate - 1.0) * 100);
      const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

      const pitchHz = Math.round((effectivePitch - 1.0) * 50);
      const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

      const tts = await getTTSInstance(targetEdgeVoice);
      const { audioStream } = tts.toStream(cleanText, {
        rate: rateStr,
        pitch: pitchStr,
      });

      const chunks = [];
      audioStream.on('data', (c) => chunks.push(c));
      audioStream.on('end', () => {
        const audioBuffer = Buffer.concat(chunks);

        // Put in cache
        if (audioCache.size >= MAX_CACHE_ENTRIES) {
          const firstKey = audioCache.keys().next().value;
          audioCache.delete(firstKey);
        }
        audioCache.set(cacheKey, { buffer: audioBuffer, mimeType: 'audio/mpeg' });

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.end(audioBuffer);
      });

      audioStream.on('error', (err) => {
        console.error('[TTS API Error]:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } catch (err) {
      console.error('[TTS Handler Exception]:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  };
}
