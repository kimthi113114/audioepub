/**
 * Where /api/tts lives. Same origin by default (local server); a static deployment (GitHub Pages) can point
 * at a remote proxy, e.g. the Cloudflare Worker in /cloudflare, set at build time (VITE_TTS_API) or by the
 * user in the voice settings (stored in localStorage).
 */
const STORAGE_KEY = 'audioepub-tts-api';

const clean = (url: string): string => url.trim().replace(/\/+$/, '');

export const getTtsApiBase = (): string => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return clean(stored);
  } catch {
    /* storage unavailable */
  }
  return clean((import.meta.env.VITE_TTS_API as string | undefined) || '');
};

export const setTtsApiBase = (url: string): void => {
  try {
    if (url.trim()) localStorage.setItem(STORAGE_KEY, clean(url));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

/** Absolute (or same-origin) URL for an API path such as "/api/tts". */
export const apiUrl = (path: string): string => `${getTtsApiBase()}${path}`;
