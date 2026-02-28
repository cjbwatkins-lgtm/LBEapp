import { useRef, useCallback } from 'react';

export function useWakeLock() {
  const lockRef = useRef(null);

  const request = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      lockRef.current = await navigator.wakeLock.request('screen');
      lockRef.current.addEventListener('release', () => { lockRef.current = null; });
    } catch (e) { /* ignore — user denied or not supported */ }
  }, []);

  const release = useCallback(async () => {
    if (lockRef.current) {
      try { await lockRef.current.release(); } catch (e) { /* ignore */ }
      lockRef.current = null;
    }
  }, []);

  return { request, release, isActive: () => !!lockRef.current };
}
