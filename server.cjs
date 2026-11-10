const http = require('http');
const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const PORT = process.env.PORT || 5173;
const DIST_DIR = path.join(__dirname, 'dist');

const MAX_CACHE_ENTRIES = 500;
const audioCache = new Map();
const ttsInstances = new Map();
const IDLE_TIMEOUT_MS = 90000;

function closeTTSInstance(voiceName) {
  const item = ttsInstances.get(voiceName);
  if (item) {
    ttsInstances.delete(voiceName);
    try {
      item.tts.close();
    } catch {}
  }
}

async function getTTSInstance(voiceName, forceNew = false) {
  if (!forceNew && ttsInstances.has(voiceName)) {
    const item = ttsInstances.get(voiceName);
    item.lastUsed = Date.now();
    return item.tts;
  }
  if (forceNew) {
    closeTTSInstance(voiceName);
  }
  const tts = new MsEdgeTTS({
    connectionTimeoutMs: 15000,
    synthesisTimeoutMs: 30000,
  });
  await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  ttsInstances.set(voiceName, { tts, lastUsed: Date.now() });
  return tts;
}

setInterval(() => {
  const now = Date.now();
  for (const [voiceName, item] of ttsInstances.entries()) {
    if (now - item.lastUsed > IDLE_TIMEOUT_MS) {
      closeTTSInstance(voiceName);
    }
  }
}, 30000);

async function synthesizeEdgeAudio(voice, cleanText, rateStr, pitchStr) {
  const doSynth = async (forceNew) => {
    const tts = await getTTSInstance(voice, forceNew);
    return new Promise((resolve, reject) => {
      let isDone = false;
      const { audioStream } = tts.toStream(cleanText, { rate: rateStr, pitch: pitchStr });
      const chunks = [];
      audioStream.on('data', c => chunks.push(c));
      audioStream.on('end', () => {
        if (isDone) return;
        isDone = true;
        resolve(Buffer.concat(chunks));
      });
      audioStream.on('error', err => {
        if (isDone) return;
        isDone = true;
        closeTTSInstance(voice);
        reject(err);
      });
    });
  };

  try {
    return await doSynth(false);
  } catch (err) {
    console.warn(`[Server Edge-TTS] Stream error (${err?.message}). Retrying once with fresh connection...`);
    await new Promise(r => setTimeout(r, 500));
    return await doSynth(true);
  }
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Handle /api/tts
  if (url.pathname === '/api/tts') {
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
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        const data = JSON.parse(Buffer.concat(buffers).toString('utf8') || '{}');
        text = data.text || '';
        voice = data.voice || 'vi-VN-HoaiMyNeural';
        rate = data.rate !== undefined ? parseFloat(data.rate) : 1.0;
        pitch = data.pitch !== undefined ? parseFloat(data.pitch) : 1.0;
      }

      let cleanText = text.trim();
      if (!cleanText) {
        res.statusCode = 400;
        return res.end('Missing text parameter');
      }

      // Skip synthesis if text has no letters or digits (e.g. only "...", "---", "***")
      if (!/[\p{L}\p{N}]/u.test(cleanText)) {
        res.statusCode = 204;
        return res.end();
      }

      // Normalize ellipsis to prevent neural TTS from vocalizing "chấm chấm chấm" or stuttering
      cleanText = cleanText
        .replace(/[.…]{2,}$/u, '.')
        .replace(/…$/u, '.')
        .replace(/\s*[.…]{2,}\s*/gu, ', ')
        .replace(/\s*…\s*/gu, ', ')
        .replace(/,\s*,+/g, ',')
        .replace(/\.\s*\.+/g, '.')
        .trim();

      const cacheKey = `${voice}:${rate.toFixed(2)}:${pitch.toFixed(2)}:${cleanText}`;
      if (audioCache.has(cacheKey)) {
        const cached = audioCache.get(cacheKey);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', cached.length);
        res.setHeader('X-Cache', 'HIT');
        return res.end(cached);
      }

      const ratePercent = Math.round((rate - 1.0) * 100);
      const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
      const pitchHz = Math.round((pitch - 1.0) * 50);
      const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;

      const buf = await synthesizeEdgeAudio(voice, cleanText, rateStr, pitchStr);
      if (audioCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = audioCache.keys().next().value;
        audioCache.delete(firstKey);
      }
      audioCache.set(cacheKey, buf);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', buf.length);
      res.setHeader('X-Cache', 'MISS');
      res.end(buf);
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Serve static files from dist
  let filePath = path.join(DIST_DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AudioEpub Server running at http://0.0.0.0:${PORT}`);
});
