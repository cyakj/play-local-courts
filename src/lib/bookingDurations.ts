// Pure duration rules for the reservation sheet. No React / Supabase: unit tested in Node.
//
// The server (enforce_amenity_booking_rules) caps a booking at:
//   tennis      -> the singles / doubles duration for the chosen play type
//   everything  -> amenity_rules.max_duration_minutes (default 60)
// The picker must only OFFER durations the server will accept, otherwise a resident picks a length that can never be
// booked (the Greens Pool bug: 90 min offered from doubles_duration_minutes while max_duration_minutes was 60).

export interface DurationRules {
  singles_duration_minutes?: number | null;
  doubles_duration_minutes?: number | null;
  max_duration_minutes?: number | null;
}

export const DEFAULT_DURATION_CAP = 60;

/** The longest booking the server accepts. */
export function durationCap(isTennis: boolean, playType: 'singles' | 'doubles', rules: DurationRules | null | undefined): number {
  if (isTennis) {
    return playType === 'doubles' ? (rules?.doubles_duration_minutes ?? 90) : (rules?.singles_duration_minutes ?? 60);
  }
  return rules?.max_duration_minutes ?? DEFAULT_DURATION_CAP;
}

/**
 * Durations a resident may choose for a NON-tennis amenity, ascending. Tennis length is fixed by play type, so [].
 * Candidates are the amenity's configured lengths (singles/doubles); anything above the server cap is dropped. If every
 * candidate is above the cap (or none is set) the cap itself is the only option. Never hard-codes 60/90.
 */
export function allowedDurations(isTennis: boolean, rules: DurationRules | null | undefined): number[] {
  if (isTennis) return [];
  const cap = durationCap(false, 'singles', rules);
  if (!rules) return [cap];
  const set = new Set<number>();
  for (const d of [rules.singles_duration_minutes, rules.doubles_duration_minutes]) {
    if (typeof d === 'number' && d > 0 && d <= cap) set.add(d);
  }
  if (set.size === 0) set.add(cap);
  return Array.from(set).sort((a, b) => a - b);
}

/** The duration actually used: the resident's choice when it is allowed, otherwise the amenity default, otherwise the first allowed. */
export function resolveDuration(allowed: number[], override: number | null, rules: DurationRules | null | undefined): number {
  if (override !== null && allowed.includes(override)) return override;
  const singles = rules?.singles_duration_minutes;
  if (typeof singles === 'number' && allowed.includes(singles)) return singles;
  return allowed[0] ?? DEFAULT_DURATION_CAP;
}
