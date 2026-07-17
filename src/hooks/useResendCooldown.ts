import { useEffect, useRef, useState } from 'react';

const COOLDOWN_SECONDS = 60;

// Supabase enforces a 60s-per-address rate limit on recovery emails
// server-side by default; this mirrors it client-side so the button can't be
// mashed into a 429 in the first place, and shows a countdown instead of a
// dead disabled state.
export function useResendCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function start(seconds: number = COOLDOWN_SECONDS) {
    setSecondsLeft(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  return { secondsLeft, start, active: secondsLeft > 0 };
}
