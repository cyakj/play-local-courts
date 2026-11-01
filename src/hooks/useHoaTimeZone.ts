import { useEffect, useState } from 'react';

import { db } from '@/lib/untypedDb';
import { COMMUNITY_TIME_ZONE, isMissingColumnError, isValidTimeZone } from '@/lib/communityTime';

const cache = new Map<string, { timeZone: string | null; assumed: boolean; unavailable: boolean }>();

/**
 * Reservation time zone of ONE community (for manager screens that look at a community other than the resident's active one).
 * Tolerant of a server without hoas.timezone (legacy: Puerto Rico, `assumed`). `unset` = the column exists and this community has
 * not chosen a zone yet. Always returns a usable `timeZone` for display math.
 */
export function useHoaTimeZone(hoaId: string | null | undefined): { timeZone: string; unset: boolean; assumed: boolean; unavailable: boolean; loaded: boolean } {
  const [state, setState] = useState<{ timeZone: string | null; assumed: boolean; unavailable: boolean; loaded: boolean }>(() => {
    const c = hoaId ? cache.get(hoaId) : undefined;
    return c ? { ...c, loaded: true } : { timeZone: COMMUNITY_TIME_ZONE, assumed: true, unavailable: false, loaded: false };
  });

  useEffect(() => {
    if (!hoaId) { setState({ timeZone: COMMUNITY_TIME_ZONE, assumed: true, unavailable: false, loaded: true }); return; }
    let cancelled = false;
    (async () => {
      const res = await db.from('hoas').select('timezone').eq('id', hoaId).maybeSingle();
      if (cancelled) return;
      const raw = (res.data as { timezone?: string | null } | null)?.timezone;
      // Only a server WITHOUT the column falls back to Puerto Rico; any other failure is "could not read the zone".
      const next = res.error
        ? (isMissingColumnError(res.error) ? { timeZone: COMMUNITY_TIME_ZONE, assumed: true, unavailable: false } : { timeZone: null, assumed: false, unavailable: true })
        : { timeZone: isValidTimeZone(raw) ? raw : null, assumed: false, unavailable: false };
      cache.set(hoaId, next);
      setState({ ...next, loaded: true });
    })().catch(() => { if (!cancelled) setState({ timeZone: null, assumed: false, unavailable: true, loaded: true }); });
    return () => { cancelled = true; };
  }, [hoaId]);

  return { timeZone: state.timeZone ?? COMMUNITY_TIME_ZONE, unset: state.timeZone === null && !state.unavailable, assumed: state.assumed, unavailable: state.unavailable, loaded: state.loaded };
}
