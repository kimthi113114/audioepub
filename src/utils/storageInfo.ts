import { db } from '../db';
import { clearAudioLog, getAudioLog } from './audioDebugLog';
import { deleteModel } from '../services/piperService';

export interface StorageSummary {
  usage: number | null;
  quota: number | null;
  books: { count: number; bytes: number };
  /** Piper voice model kept in the Origin Private File System */
  model: { bytes: number | null };
  /** Browser Cache Storage (service-worker style caches) */
  caches: { count: number; entries: number; bytes: number | null };
  log: { lines: number };
}

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

type DirHandle = {
  values?: () => AsyncIterable<{ kind: 'file' | 'directory'; getFile?: () => Promise<File> } & Record<string, unknown>>;
  removeEntry: (name: string, opts?: { recursive?: boolean }) => Promise<void>;
};

const getOpfsRoot = async (): Promise<DirHandle | null> => {
  try {
    if (navigator.storage?.getDirectory) return (await navigator.storage.getDirectory()) as unknown as DirHandle;
  } catch {
    /* OPFS unavailable */
  }
  return null;
};

const dirSize = async (dir: DirHandle): Promise<number> => {
  let total = 0;
  if (!dir.values) return 0;
  for await (const entry of dir.values()) {
    if (entry.kind === 'file' && entry.getFile) {
      total += (await entry.getFile()).size;
    } else if (entry.kind === 'directory') {
      total += await dirSize(entry as unknown as DirHandle);
    }
  }
  return total;
};

const opfsSize = async (): Promise<number | null> => {
  const root = await getOpfsRoot();
  if (!root) return null;
  try {
    return await dirSize(root);
  } catch {
    return null;
  }
};

const cacheStorageInfo = async (): Promise<StorageSummary['caches']> => {
  if (typeof caches === 'undefined') return { count: 0, entries: 0, bytes: 0 };
  try {
    const names = await caches.keys();
    let entries = 0;
    let bytes = 0;
    let known = true;
    for (const name of names) {
      const cache = await caches.open(name);
      const reqs = await cache.keys();
      entries += reqs.length;
      for (const req of reqs.slice(0, 200)) {
        // content-length only: reading blobs here could pull a whole model file into memory
        const len = (await cache.match(req))?.headers.get('content-length');
        if (len) bytes += Number(len);
        else known = false;
      }
    }
    return { count: names.length, entries, bytes: known ? bytes : null };
  } catch {
    return { count: 0, entries: 0, bytes: null };
  }
};

export const loadStorageSummary = async (): Promise<StorageSummary> => {
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  const books = await db.books.toArray();
  const bookBytes = books.reduce((sum, b) => sum + (b.fileSize || 0) + (b.coverUrl?.length || 0), 0);
  return {
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null,
    books: { count: books.length, bytes: bookBytes },
    model: { bytes: await opfsSize() },
    caches: await cacheStorageInfo(),
    log: { lines: getAudioLog().length },
  };
};

export const clearCacheStorage = async (): Promise<void> => {
  if (typeof caches === 'undefined') return;
  for (const name of await caches.keys()) await caches.delete(name);
};

/** Remove the downloaded voice model(s) from OPFS. */
export const clearVoiceModels = async (): Promise<void> => {
  try {
    await deleteModel();
  } catch {
    /* not downloaded */
  }
  const root = await getOpfsRoot();
  if (root?.values) {
    const names: string[] = [];
    for await (const entry of root.values()) names.push(String(entry.name));
    for (const name of names) {
      try {
        await root.removeEntry(name, { recursive: true });
      } catch {
        /* ignore */
      }
    }
  }
  try {
    localStorage.removeItem('kokoro_model_downloaded');
  } catch {
    /* ignore */
  }
};

export const clearTempData = (): void => clearAudioLog();

/** Forget where the reader stopped in every book (keeps the books). */
export const resetReadingPositions = async (): Promise<void> => {
  await db.books.toCollection().modify((b) => {
    delete b.resumeHref;
    delete b.resumeSentence;
    delete b.currentCfi;
    b.progressPercent = 0;
  });
};

export const deleteAllBooks = async (): Promise<void> => {
  await db.books.clear();
  await db.bookmarks.clear();
};
