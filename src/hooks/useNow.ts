import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * A ticking "now". Reservation screens derive upcoming / in progress / completed from this, never from a timestamp
 * taken when the screen first mounted, so a booking moves to History by itself as time passes. It also advances
 * immediately when the screen regains focus and when the app returns to the foreground.
 * `onRefresh` (optional) is called on those same events plus every `refetchMs`, to pick up changes made elsewhere
 * (for example an administrator approving or declining a request) without a logout.
 */
export function useNow(opts: { tickMs?: number; refetchMs?: number; onRefresh?: () => void } = {}): Date {
  const { tickMs = 30_000, refetchMs = 60_000, onRefresh } = opts;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);

  useEffect(() => {
    if (!onRefresh) return;
    const t = setInterval(onRefresh, refetchMs);
    return () => clearInterval(t);
  }, [onRefresh, refetchMs]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') { setNow(new Date()); onRefresh?.(); }
    });
    return () => sub.remove();
  }, [onRefresh]);

  useFocusEffect(useCallback(() => { setNow(new Date()); }, []));
  return now;
}
