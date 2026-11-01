import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { spawn } from 'child_process';
import path from 'path';

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

// Local Python Worker Manager
const WORKER_URL = 'http://127.0.0.1:5055';
let workerStarting = false;
let workerProcess = null;

async function checkWorkerHealth() {
  try {
    const res = await fetch(`${WORKER_URL}/health`, {
      signal: AbortSignal.timeout(1200),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}
  return null;
}

async function ensureWorkerRunning() {
  const health = await checkWorkerHealth();
  if (health) return true;

  if (workerStarting) {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const h = await checkWorkerHealth();
      if (h) return true;
    }
    return false;
  }

  workerStarting = true;
  try {
    console.log('[TTS Middleware] Launching local python TTS worker (server/tts_worker.py)...');
    const workerScript = path.resolve(process.cwd(), 'server', 'tts_worker.py');
    workerProcess = spawn('python', [workerScript], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    workerProcess.unref();

    for (let i = 0; i < 35; i++) {
      await new Promise((r) => setTimeout(r, 600));
      const h = await checkWorkerHealth();
      if (h) {
        console.log('[TTS Middleware] Local python TTS worker is ready!');
        workerStarting = false;
        return true;
      }
    }
  } catch (err) {
    console.error('[TTS Middleware] Failed to spawn python TTS worker:', err);
  } finally {
    workerStarting = false;
  }
  return false;
}

// Ensure worker is checked/started at boot
ensureWorkerRunning().catch(() => {});

const KOKORO_VOICE_KEYS = [
  'diem_trinh', 'mai_linh', 'hung_thinh', 'ngoc_huyen',
  'duc_an', 'duc_duy', 'mai_loan', 'manh_dung',
  'my_yen', 'phat_tai', 'storyvert', 'thanh_dat',
  'thuc_trinh', 'tuan_ngoc'
];

const VIENEU_VOICE_KEYS = [
  'minh_quan', 'ai_han', 'my_duyen', 'duc_tri',
  'huu_quan', 'xuan_tien', 'mai_anh', 'truc_ly',
  'anh_khoi', 'manh_dung', 'adam', 'phuong_trang',
  'bao_ngoc', 'tuan_kiet'
];

export function createTTSMiddleware() {
  return async (req, res, next) => {
    // Only handle /api/tts
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/tts') {
      return next();
    }

    try {
      // 0. Handle health query
      if (url.searchParams.get('health') === '1') {
        const health = await checkWorkerHealth();
        res.setHeader('Content-Type', 'application/json');
        return res.end(
          JSON.stringify({
            ok: true,
            worker: !!health,
            kokoro_ready: health?.kokoro_ready ?? false,
            vieneu_ready: health?.vieneu_ready ?? false,
          })
        );
      }

      let text = '';
      let voice = 'vi-VN-HoaiMyNeural';
      let engine = 'edge';
      let mode = '';
      let rate = 1.0;
      let pitch = 1.0;

      if (req.method === 'GET') {
        text = url.searchParams.get('text') || '';
        voice = url.searchParams.get('voice') || 'vi-VN-HoaiMyNeural';
        engine = url.searchParams.get('engine') || 'edge';
        mode = url.searchParams.get('mode') || '';
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
          mode = data.mode || '';
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
      const cacheKey = `${engine}:${mode}:${voice}:${rate.toFixed(2)}:${pitch.toFixed(2)}:${cleanText}`;
      if (audioCache.has(cacheKey)) {
        const cached = audioCache.get(cacheKey);
        res.setHeader('Content-Type', cached.mimeType || 'audio/mpeg');
        res.setHeader('Content-Length', cached.buffer.length);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.end(cached.buffer);
      }

      // 1. Determine target engine
      const voiceLower = voice.toLowerCase().trim();
      // An explicit engine wins: voice ids can collide between engines (e.g. "ngoc_huyen")
      const isKokoro =
        engine === 'kokoro' ||
        (engine !== 'vieneu' &&
          (voiceLower.startsWith('kokoro:') ||
            KOKORO_VOICE_KEYS.some((k) => voiceLower === k || voiceLower === `kokoro:${k}`)));

      const isVieNeu =
        !isKokoro &&
        (engine === 'vieneu' ||
          voiceLower.startsWith('vieneu:') ||
          VIENEU_VOICE_KEYS.some((k) => voiceLower === k || voiceLower === `vieneu:${k}`));

      // Handle Kokoro or VieNeu via local Python worker
      if (isKokoro || isVieNeu) {
        const workerReady = await ensureWorkerRunning();
        if (workerReady) {
          const reqEngine = isKokoro ? 'kokoro' : 'vieneu';
          let reqVoice = voiceLower.replace(/^(kokoro|vieneu):/, '');

          const resp = await fetch(`${WORKER_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanText,
              engine: reqEngine,
              voice: reqVoice,
              speed: rate,
              mode: isVieNeu && mode ? mode : undefined,
            }),
          });

          if (resp.ok) {
            const arrBuf = await resp.arrayBuffer();
            const rawBuf = Buffer.from(arrBuf);

            // Put in cache
            if (audioCache.size >= MAX_CACHE_ENTRIES) {
              const firstKey = audioCache.keys().next().value;
              audioCache.delete(firstKey);
            }
            audioCache.set(cacheKey, { buffer: rawBuf, mimeType: 'audio/wav' });

            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Content-Length', rawBuf.length);
            res.setHeader('X-Cache', 'MISS');
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.end(rawBuf);
          } else {
            const errStr = await resp.text();
            console.error(`[TTS Worker] Error response (${resp.status}):`, errStr);
          }
        } else {
          console.warn('[TTS Middleware] Worker not available for Kokoro/VieNeu');
        }
      }

      // 2. Microsoft Studio / Edge-TTS Engine (Hoài My, Nam Minh, Jenny)
      let targetEdgeVoice = 'vi-VN-HoaiMyNeural';
      if (voice.startsWith('vi-') || voice.startsWith('en-') || voice.endsWith('Neural')) {
        targetEdgeVoice = voice;
      } else if (voiceLower.includes('nam') || voiceLower.includes('minh')) {
        targetEdgeVoice = 'vi-VN-NamMinhNeural';
      }

      const ratePercent = Math.round((rate - 1.0) * 100);
      const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

      const pitchHz = Math.round((pitch - 1.0) * 50);
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
        console.error('Edge-TTS stream error:', err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(`TTS generation failed: ${err.message}`);
        }
      });
    } catch (err) {
      console.error('TTS Middleware internal error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(`Internal server error: ${err.message}`);
      }
    }
  };
}
