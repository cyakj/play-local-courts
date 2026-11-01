import { useCallback, useEffect, useRef, useState } from 'react';
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
  // Always call the latest callback without re-subscribing every render.
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const hasRefresh = !!onRefresh;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);

  useEffect(() => {
    if (!hasRefresh) return;
    const t = setInterval(() => refreshRef.current?.(), refetchMs);
    return () => clearInterval(t);
  }, [hasRefresh, refetchMs]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') { setNow(new Date()); refreshRef.current?.(); }
    });
    return () => sub.remove();
  }, []);

  // On focus: advance the clock and re-fetch (a status changed elsewhere shows up when the user comes back).
  // The first focus is skipped for the refetch because the screen is loading its data on mount anyway.
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    setNow(new Date());
    if (firstFocus.current) { firstFocus.current = false; return; }
    refreshRef.current?.();
  }, []));
  return now;
}
