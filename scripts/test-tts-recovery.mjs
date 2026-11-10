import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestTTSBlob, TTSConnectionError } from '../src/services/ttsRequest.ts';
import { LookaheadQueue } from '../src/services/lookaheadQueue.ts';

test('transport failures and temporary HTTP responses retain a retryable error', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('route changed'); };
    await assert.rejects(requestTTSBlob('/tts', {}), TTSConnectionError);
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(requestTTSBlob('/tts', {}), TTSConnectionError);
    globalThis.fetch = async () => new Response('', { status: 400 });
    await assert.rejects(requestTTSBlob('/tts', {}), (error) => !(error instanceof TTSConnectionError));
  } finally { globalThis.fetch = original; }
});

test('timeout aborts a connection stalled before headers or during its body', async () => {
  const original = globalThis.fetch;
  try {
    for (const bodyStall of [false, true]) {
      globalThis.fetch = async (_url, { signal }) => {
        const neverUntilAbort = () => new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true });
        });
        return bodyStall ? { ok: true, blob: neverUntilAbort } : neverUntilAbort();
      };
      await assert.rejects(requestTTSBlob('/tts', {}, 10), TTSConnectionError);
    }
    globalThis.fetch = async () => new Response('audio');
    assert.equal((await requestTTSBlob('/tts', {})).size, 5);
  } finally { globalThis.fetch = original; }
});

test('old chapter rejection cannot delete a new chapter item at the same index', async () => {
  const queue = new LookaheadQueue();
  let rejectOld;
  const old = queue.prefetch(0, 'old', () => new Promise((_resolve, reject) => { rejectOld = reject; }));
  const handled = old.catch(() => {});
  queue.clear();
  const fresh = queue.prefetch(0, 'new', async () => new Blob(['new']));
  rejectOld(new Error('old route failed'));
  await handled;
  await fresh;
  assert.equal(queue.get(0)?.text, 'new');
  assert.equal(queue.hasReady(0), true);
  queue.clear();
});

test('revoking pending audio prevents stale URL allocation; clear releases serial backlog', async () => {
  const queue = new LookaheadQueue();
  let resolveOld;
  const old = queue.prefetchSerial(0, 'old', () => new Promise((resolve) => { resolveOld = resolve; }));
  const handled = old.catch((error) => error.message);
  await Promise.resolve();
  queue.clear();
  await queue.prefetchSerial(0, 'new', async () => new Blob(['new']));
  resolveOld(new Blob(['old']));
  assert.equal(await handled, 'cancelled');
  assert.equal(queue.get(0)?.text, 'new');
  queue.clear();
});
