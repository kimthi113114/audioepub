/** Transient transport errors must retain the sentence while the VPN reconnects. */
export class TTSConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TTSConnectionError';
  }
}

export async function requestTTSBlob(
  url: string,
  init: RequestInit,
  timeoutMs = 20000,
): Promise<Blob> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      if (response.status === 408 || response.status === 429 || response.status >= 500) {
        throw new TTSConnectionError(`TTS temporarily unavailable (${response.status})`);
      }
      throw new Error(`TTS request failed (${response.status})`);
    }
    // Keep the timeout alive until the complete body arrives, not only HTTP headers.
    const blob = await response.blob();
    if (!blob.size) throw new TTSConnectionError('TTS returned empty audio');
    return blob;
  } catch (error) {
    if (controller.signal.aborted || error instanceof TypeError ||
        (error as { name?: string })?.name === 'AbortError') {
      throw new TTSConnectionError('TTS connection interrupted or timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
