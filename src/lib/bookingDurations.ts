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
  /** Explicit HOA-chosen lists (migration 20261106100000). null / missing = not configured: legacy cap behaviour applies. */
  allowed_durations?: number[] | null;
  singles_allowed_durations?: number[] | null;
  doubles_allowed_durations?: number[] | null;
}

export type PlayType = 'singles' | 'doubles';

/** Only these amenities have a Singles/Doubles choice. Pools, clubhouses, meeting rooms etc. never do. */
export const RACQUET_TYPES: ReadonlySet<string> = new Set(['tennis', 'pickleball']);
export const isRacquetType = (courtType: string | null | undefined): boolean => RACQUET_TYPES.has((courtType ?? '').toLowerCase());

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

// ─── HOA-configured allowed durations ─────────────────────────────────────────────────────────────────────────────
// Server mirror: enforce_amenity_booking_rules (cap) + enforce_allowed_durations (explicit list, migration 20261106100000).

/** Valid minutes only: finite positive integers, unique, ascending. Anything else (null, junk, empty) yields []. */
export function sanitizeDurationList(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out = new Set<number>();
  for (const x of v) if (typeof x === 'number' && Number.isInteger(x) && x > 0) out.add(x);
  return Array.from(out).sort((a, b) => a - b);
}

/** The cap the legacy server trigger applies: tennis -> the format's duration; every other type -> max_duration_minutes. */
export function serverDurationCap(courtType: string | null | undefined, playType: PlayType, rules: DurationRules | null | undefined): number {
  return durationCap((courtType ?? '').toLowerCase() === 'tennis', playType, rules);
}

/**
 * Durations a resident may pick, ascending, for this amenity (and play format when racquet).
 *  - Explicit HOA list (allowed_durations, or singles/doubles_allowed_durations) wins, minus anything the server cap would refuse.
 *  - No list configured: legacy behaviour (racquet = the format's single length; others = allowedDurations()).
 * Returns [] ONLY for a configuration conflict (an explicit list whose lengths all exceed the server cap): the caller must
 * block booking and explain, because offering an unlisted length would be rejected by enforce_allowed_durations.
 * Never hard-codes 60/90 beyond the legacy defaults already enforced by the server.
 */
export function durationOptions(courtType: string | null | undefined, playType: PlayType, rules: DurationRules | null | undefined): number[] {
  const cap = serverDurationCap(courtType, playType, rules);
  if (isRacquetType(courtType)) {
    const configured = sanitizeDurationList(playType === 'doubles' ? rules?.doubles_allowed_durations : rules?.singles_allowed_durations);
    if (configured.length) return configured.filter((d) => d <= cap); // [] = configuration conflict (every listed length exceeds the server cap)
    const base = playType === 'doubles' ? (rules?.doubles_duration_minutes ?? 90) : (rules?.singles_duration_minutes ?? 60);
    return [Math.min(base, cap)];
  }
  const configured = sanitizeDurationList(rules?.allowed_durations);
  if (configured.length) return configured.filter((d) => d <= cap); // [] = conflict: never fall back to an unlisted length the trigger would reject
  return allowedDurations(false, rules);
}

/** The chosen length: the resident's pick when still allowed, otherwise the shortest allowed option. */
export function pickDuration(options: number[], override: number | null): number {
  if (override !== null && options.includes(override)) return override;
  return options[0] ?? DEFAULT_DURATION_CAP;
}

/** Compact label, always with units ("90 min"); never a bare decimal such as 1.5. */
export const durationLabel = (minutes: number): string => `${minutes} min`;

/** Subtext for a format button: one length -> "90 min"; several -> "60 · 90 min" so it never implies a single option. */
export function formatDurationSubtext(options: number[]): string {
  if (options.length === 0) return '';
  if (options.length === 1) return durationLabel(options[0]);
  return `${options.join(' · ')} min`;
}

/** Admin-side validation of a list before saving. Returns an error message or null. */
export function validateDurationList(list: number[], label: string): string | null {
  if (list.length === 0) return `${label}: choose at least one duration.`;
  if (list.some((d) => !Number.isInteger(d) || d < 15 || d > 480 || d % 15 !== 0)) return `${label}: durations must be 15–480 minutes in 15-minute steps.`;
  return null;
}

// ─── Admin editor model (Manage Amenities) ──────────────────────────────────────────────────────────────────────────

export interface DurationDraft { general: number[]; singles: number[]; doubles: number[] }

/** Initial editor state: what residents currently get (explicit list when configured, otherwise the legacy single length / cap). */
export function draftFromRules(courtType: string | null | undefined, rules: DurationRules | null | undefined): DurationDraft {
  return {
    general: isRacquetType(courtType) ? [] : durationOptions(courtType, 'singles', rules),
    singles: isRacquetType(courtType) ? durationOptions(courtType, 'singles', rules) : [],
    doubles: isRacquetType(courtType) ? durationOptions(courtType, 'doubles', rules) : [],
  };
}

/** Validation message for the draft that applies to this amenity type, or null. */
export function validateDraft(courtType: string | null | undefined, d: DurationDraft): string | null {
  if (isRacquetType(courtType)) return validateDurationList(d.singles, 'Singles') ?? validateDurationList(d.doubles, 'Doubles');
  return validateDurationList(d.general, 'Reservation length');
}

/**
 * Columns to write. Lists are written together with the legacy cap columns (set to the longest listed length) so the older
 * server check (enforce_amenity_booking_rules) and the new one (enforce_allowed_durations) always agree.
 * Columns of the other amenity kind are not touched.
 */
export function draftToColumns(courtType: string | null | undefined, d: DurationDraft): Record<string, number | number[]> {
  const asc = (l: number[]) => sanitizeDurationList(l);
  if (isRacquetType(courtType)) {
    const s = asc(d.singles), b = asc(d.doubles);
    return {
      singles_allowed_durations: s, doubles_allowed_durations: b,
      singles_duration_minutes: Math.max(...s), doubles_duration_minutes: Math.max(...b),
      max_duration_minutes: Math.max(...s, ...b),
    };
  }
  const g = asc(d.general);
  return { allowed_durations: g, max_duration_minutes: Math.max(...g) };
}

/**
 * Legacy-only columns (server without the list columns). A non-racquet amenity's legacy options come from singles/doubles minutes
 * (<= the cap), so those are set to the longest length as well: residents then get exactly that one length, as the notice says.
 */
export function legacyColumnsFor(courtType: string | null | undefined, d: DurationDraft): Record<string, number> {
  const cols = draftToColumns(courtType, d);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(cols)) if (typeof v === 'number') out[k] = v;
  if (!isRacquetType(courtType)) { out.singles_duration_minutes = out.max_duration_minutes; out.doubles_duration_minutes = out.max_duration_minutes; }
  return out;
}
