import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

// In-Memory LRU Cache for synthesized audio buffers
const MAX_CACHE_ENTRIES = 500;
const audioCache = new Map();

// Map of pre-initialized instances per voice to keep WSS connections alive
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
      let rate = 1.0;
      let pitch = 1.0;

      if (req.method === 'GET') {
        text = url.searchParams.get('text') || '';
        voice = url.searchParams.get('voice') || 'vi-VN-HoaiMyNeural';
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
      const cacheKey = `${voice}:${rate.toFixed(2)}:${pitch.toFixed(2)}:${cleanText}`;
      if (audioCache.has(cacheKey)) {
        const cached = audioCache.get(cacheKey);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', cached.length);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(cached);
      }

      // Format Prosody
      // rate: 1.0 -> '+0%', 1.25 -> '+25%', 0.75 -> '-25%'
      const ratePercent = Math.round((rate - 1.0) * 100);
      const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

      // pitch: 1.0 -> '+0Hz', 1.1 -> '+10Hz'
      const pitchHz = Math.round((pitch - 1.0) * 50);
      const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

      const tts = await getTTSInstance(voice);
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
        audioCache.set(cacheKey, audioBuffer);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', audioBuffer.length);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.end(audioBuffer);
      });

      audioStream.on('error', (err) => {
        console.error('[Edge-TTS API Error]:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } catch (err) {
      console.error('[Edge-TTS Handler Exception]:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  };
}
