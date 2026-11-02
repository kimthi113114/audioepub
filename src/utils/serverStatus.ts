import { useSyncExternalStore } from 'react';

/** Whether /api/tts is reachable (null = unknown yet). Static hosts have no server, so server voices are hidden. */
let status: boolean | null = null;
const listeners = new Set<() => void>();

export const setServerStatus = (ok: boolean) => {
  status = ok;
  listeners.forEach((l) => l());
};

export const useServerAvailable = (): boolean | null =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status
  );

export const SERVER_TABS = ['edge', 'kokoro', 'vieneu'];
