/**
 * Tiny persistent ring buffer for audio / lifecycle events.
 * Background (screen-locked) playback on iOS Safari cannot be debugged with a console,
 * so the log survives the page being frozen/reloaded and can be viewed or copied from the menu.
 */
const KEY = 'audioepub-audio-log';
const MAX = 120;

let buffer: string[] | null = null;
let flushTimer: number | undefined;

const load = (): string[] => {
  if (buffer) return buffer;
  try {
    buffer = JSON.parse(localStorage.getItem(KEY) || '[]') as string[];
  } catch {
    buffer = [];
  }
  return buffer;
};

const flush = () => {
  window.clearTimeout(flushTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
  } catch {}
};

export const logAudio = (event: string, detail?: string | number | boolean | null) => {
  const buf = load();
  const t = new Date();
  const stamp = `${t.toTimeString().slice(0, 8)}.${String(t.getMilliseconds()).padStart(3, '0')}`;
  buf.push(`${stamp} ${event}${detail !== undefined && detail !== null ? ` ${detail}` : ''}`);
  if (buf.length > MAX) buf.splice(0, buf.length - MAX);
  // Persist right away for lifecycle events (the page may be frozen next), debounced otherwise
  if (/^(page|vis|freeze|resume)/.test(event)) flush();
  else {
    window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flush, 800);
  }
};

export const getAudioLog = (): string[] => [...load()];

export const clearAudioLog = () => {
  buffer = [];
  flush();
};
