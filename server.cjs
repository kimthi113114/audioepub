const http = require('http');
const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const PORT = process.env.PORT || 5173;
const DIST_DIR = path.join(__dirname, 'dist');

const MAX_CACHE_ENTRIES = 500;
const audioCache = new Map();
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

      const cleanText = text.trim();
      if (!cleanText) {
        res.statusCode = 400;
        return res.end('Missing text parameter');
      }

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

      const tts = await getTTSInstance(voice);
      const { audioStream } = tts.toStream(cleanText, { rate: rateStr, pitch: pitchStr });

      const chunks = [];
      audioStream.on('data', c => chunks.push(c));
      audioStream.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (audioCache.size >= MAX_CACHE_ENTRIES) {
          const firstKey = audioCache.keys().next().value;
          audioCache.delete(firstKey);
        }
        audioCache.set(cacheKey, buf);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', buf.length);
        res.setHeader('X-Cache', 'MISS');
        res.end(buf);
      });
      audioStream.on('error', err => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      });
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
