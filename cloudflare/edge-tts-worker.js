/**
 * Cloudflare Worker: tiny /api/tts proxy for Microsoft Edge neural voices.
 *
 * Browsers cannot open Microsoft's speech WebSocket themselves (it requires an Origin and headers that
 * only a server can set), so the static site calls this Worker instead. Same API as the local server:
 *   POST /api/tts  { text, voice, rate, pitch }  ->  audio/mpeg
 *   GET  /api/tts?health=1                       ->  { ok:false, edge:true }  (no Kokoro / VieNeu here)
 *
 * Deploy: see cloudflare/README.md. Set ALLOWED_ORIGINS (comma separated) so only your site can use it.
 */

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_URL = 'https://api.msedgeservices.com/tts/cognitiveservices/websocket/v1';
const GEC_VERSION = '1-143.0.3650.96';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0';
const OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const MAX_TEXT = 700;

const DEFAULT_ORIGINS = ['https://kimthi113114.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173'];

const allowedOrigins = (env) =>
  (env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS);

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const uuid = () => crypto.randomUUID().replace(/-/g, '');

async function secMsGec(clockSkewMs = 0) {
  // Windows file-time ticks of "now", rounded down to 5 minutes, hashed with the trusted client token
  const seconds = Math.floor((Date.now() + clockSkewMs) / 1000) + 11644473600;
  const rounded = seconds - (seconds % 300);
  const data = new TextEncoder().encode(`${rounded * 10000000}${TRUSTED_CLIENT_TOKEN}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const escapeXml = (s) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]);

function buildSsml(text, voice, rate, pitch) {
  const locale = /^[a-z]{2,3}-[A-Z]{2}/.exec(voice)?.[0] || 'vi-VN';
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${locale}">` +
    `<voice name="${voice}"><prosody pitch="${pitch}" rate="${rate}" volume="+0%">${escapeXml(text)}</prosody></voice></speak>`
  );
}

/** Open the Edge TTS socket, synthesise `text`, resolve with the mp3 bytes. */
async function synthesize(text, voice, rate, pitch) {
  let skew = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const url = `${WSS_URL}?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${await secMsGec(skew)}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${uuid()}`;
    const resp = await fetch(url, {
      headers: {
        Upgrade: 'websocket',
        Origin: 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'User-Agent': USER_AGENT,
      },
    });
    const ws = resp.webSocket;
    if (!ws) {
      // 403 usually means our clock differs from Microsoft's: retry once with their Date header
      const serverDate = Date.parse(resp.headers.get('date') || '');
      if (resp.status === 403 && attempt === 0 && Number.isFinite(serverDate)) {
        skew = serverDate - Date.now();
        continue;
      }
      throw new Error(`Edge TTS handshake failed: ${resp.status}`);
    }
    ws.accept();

    return await new Promise((resolve, reject) => {
      const chunks = [];
      const requestId = uuid();
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        reject(new Error('Edge TTS timed out'));
      }, 20000);

      ws.addEventListener('message', (event) => {
        if (typeof event.data === 'string') {
          if (event.data.includes('Path:turn.end')) {
            clearTimeout(timer);
            try { ws.close(); } catch {}
            const total = chunks.reduce((n, c) => n + c.length, 0);
            if (!total) return reject(new Error('No audio received'));
            const out = new Uint8Array(total);
            let offset = 0;
            for (const c of chunks) { out.set(c, offset); offset += c.length; }
            resolve(out);
          }
          return;
        }
        // Binary frame: 2-byte big-endian header length, "...Path:audio\r\n" headers, then mp3 data
        const bytes = new Uint8Array(event.data);
        const headerLen = (bytes[0] << 8) | bytes[1];
        const headers = new TextDecoder().decode(bytes.subarray(2, 2 + headerLen));
        if (headers.includes('Path:audio')) chunks.push(bytes.slice(2 + headerLen));
      });
      ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Edge TTS socket error')); });
      ws.addEventListener('close', () => {
        clearTimeout(timer);
        if (!chunks.length) reject(new Error('Edge TTS closed without audio'));
      });

      ws.send(
        `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          JSON.stringify({
            context: { synthesis: { audio: { metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' }, outputFormat: OUTPUT_FORMAT } } },
          })
      );
      ws.send(
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${buildSsml(text, voice, rate, pitch)}`
      );
    });
  }
  throw new Error('Edge TTS unavailable');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = allowedOrigins(env);
    const originOk = allowed.includes(origin);
    const cors = originOk ? corsHeaders(origin) : {};

    if (url.pathname !== '/api/tts') return new Response('Not found', { status: 404 });
    if (request.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });

    if (url.searchParams.get('health') === '1') {
      return Response.json({ ok: false, worker: false, edge: true, kokoro_ready: false, vieneu_ready: false }, { headers: cors });
    }
    // Only the configured sites may use this proxy (it is otherwise an open relay to Microsoft)
    if (!originOk) return new Response('Forbidden', { status: 403 });

    let text = '', voice = 'vi-VN-HoaiMyNeural', rate = 1, pitch = 1;
    try {
      if (request.method === 'POST') {
        const body = await request.json();
        text = String(body.text || '');
        voice = String(body.voice || voice);
        rate = body.rate !== undefined ? parseFloat(body.rate) : 1;
        pitch = body.pitch !== undefined ? parseFloat(body.pitch) : 1;
      } else if (request.method === 'GET') {
        text = url.searchParams.get('text') || '';
        voice = url.searchParams.get('voice') || voice;
        rate = parseFloat(url.searchParams.get('rate') || '1');
        pitch = parseFloat(url.searchParams.get('pitch') || '1');
      } else {
        return new Response('Method Not Allowed', { status: 405, headers: cors });
      }
    } catch {
      return new Response('Bad request', { status: 400, headers: cors });
    }

    text = text.trim();
    if (!text) return new Response('Missing text', { status: 400, headers: cors });
    if (text.length > MAX_TEXT) return new Response('Text too long', { status: 413, headers: cors });
    if (!/^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/.test(voice)) voice = 'vi-VN-HoaiMyNeural';
    rate = Number.isFinite(rate) ? Math.min(2, Math.max(0.5, rate)) : 1;
    pitch = Number.isFinite(pitch) ? Math.min(1.5, Math.max(0.5, pitch)) : 1;

    const ratePct = Math.round((rate - 1) * 100);
    const pitchHz = Math.round((pitch - 1) * 50);
    const rateStr = `${ratePct >= 0 ? '+' : ''}${ratePct}%`;
    const pitchStr = `${pitchHz >= 0 ? '+' : ''}${pitchHz}Hz`;

    // Identical sentences (re-reading, prefetch retries) are served from the edge cache
    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${voice}|${rateStr}|${pitchStr}|${text}`));
    const key = new Request(`https://edge-tts-cache.invalid/${[...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')}`);
    const cache = caches.default;
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'X-Cache': 'HIT' } });

    try {
      const audio = await synthesize(text, voice, rateStr, pitchStr);
      const response = new Response(audio, {
        headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=86400' },
      });
      ctx.waitUntil(cache.put(key, response.clone()));
      return new Response(audio, { headers: { ...cors, 'Content-Type': 'audio/mpeg', 'X-Cache': 'MISS' } });
    } catch (err) {
      return new Response(`TTS failed: ${err.message}`, { status: 502, headers: cors });
    }
  },
};
