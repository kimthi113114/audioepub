/**
 * Lookahead Sentence Prefetching Queue (Zero Latency Buffer)
 * Ref: ARCHITECTURE_DUAL_ENGINE_TTS.md (ADR-03, ADR-04, TC-41, TC-45)
 *
 * Prefetches the next sentence (N+1) audio blob in the background while sentence N is playing.
 * Provides < 15ms transition latency and strictly revokes Object URLs to eliminate RAM leaks.
 */

export interface QueuedAudioItem {
  index: number;
  text: string;
  blobUrl: string | null;
  promise: Promise<string> | null;
  status: 'idle' | 'generating' | 'ready' | 'playing' | 'revoked';
}

export class LookaheadQueue {
  private queue: Map<number, QueuedAudioItem> = new Map();
  public readonly maxLookaheadDepth: number = 2; // Prefetch up to 2 sentences ahead
  private activeBlobUrls: Set<string> = new Set();

  /**
   * Request prefetching of audio for sentence at `index`.
   * Returns existing or newly created Promise resolving to blobUrl.
   */
  public prefetch(
    index: number,
    text: string,
    generator: (text: string) => Promise<Blob>
  ): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) {
      return Promise.resolve('');
    }

    if (this.queue.has(index)) {
      const existing = this.queue.get(index)!;
      if (existing.promise) {
        return existing.promise;
      }
      if (existing.blobUrl) {
        return Promise.resolve(existing.blobUrl);
      }
    }

    const item: QueuedAudioItem = {
      index,
      text: trimmed,
      blobUrl: null,
      promise: null,
      status: 'generating',
    };

    const promise = generator(trimmed)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        item.blobUrl = url;
        item.status = 'ready';
        this.activeBlobUrls.add(url);
        return url;
      })
      .catch((err) => {
        item.status = 'idle';
        item.promise = null;
        this.queue.delete(index);
        throw err;
      });

    item.promise = promise;
    this.queue.set(index, item);
    return promise;
  }

  /**
   * Get pre-generated blobUrl or promise for sentence index.
   */
  public get(index: number): QueuedAudioItem | undefined {
    return this.queue.get(index);
  }

  /**
   * Check if audio for sentence index is already synthesized and ready.
   */
  public hasReady(index: number): boolean {
    const item = this.queue.get(index);
    return !!(item && item.blobUrl && item.status === 'ready');
  }

  /**
   * Mark item as actively playing.
   */
  public markPlaying(index: number): void {
    const item = this.queue.get(index);
    if (item) {
      item.status = 'playing';
    }
  }

  /**
   * Strict memory cleanup (TC-45 compliance):
   * Immediately revoke Object URL for finished sentence index and free JS Heap memory.
   */
  public revoke(index: number): void {
    const item = this.queue.get(index);
    if (item) {
      if (item.blobUrl) {
        URL.revokeObjectURL(item.blobUrl);
        this.activeBlobUrls.delete(item.blobUrl);
        item.blobUrl = null;
      }
      item.status = 'revoked';
      this.queue.delete(index);
    }
  }

  /**
   * Revoke all sentences older than the given index.
   */
  public pruneOlderThan(currentIndex: number): void {
    for (const [idx] of this.queue.entries()) {
      if (idx < currentIndex) {
        this.revoke(idx);
      }
    }
  }

  /**
   * Clear entire queue and revoke all active blob URLs.
   */
  public clear(): void {
    for (const url of this.activeBlobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        console.warn('Error revoking ObjectURL:', e);
      }
    }
    this.activeBlobUrls.clear();
    this.queue.clear();
  }
}
