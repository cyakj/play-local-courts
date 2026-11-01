// Pure slot-availability rules for the reservation sheet. No React / Supabase: unit tested in Node.
//
// Every candidate start time inside operating hours is returned with a state so the UI can keep unavailable
// times VISIBLE but disabled. Times outside operating hours (or past times today) are not returned at all.
// The database remains authoritative (exclusion constraint on overlapping confirmed bookings, blockout trigger,
// amenity-rules trigger); this is the optimistic client view of the same rules.

export type SlotState = 'available' | 'reserved' | 'blocked' | 'limit';

export interface SlotInfo {
  /** HH:MM, 24h */
  start: string;
  state: SlotState;
  /**
   * state === 'reserved' only. True when this START TIME itself lies inside one of the resident's own reservations
   * ("Yours"). A start whose duration merely overlaps a reservation (e.g. 09:00 for a 90 minute booking next to a 10:00
   * reservation) is unavailable but is NOT the resident's time, so it is not "Yours".
   */
  mine?: boolean;
  /** state === 'reserved' only. True when this start time lies inside a reservation; false when it only overlaps one. */
  inside?: boolean;
  /** state === 'reserved' && mine only. True when the resident's own reservation here is still awaiting approval. */
  pending?: boolean;
}

export interface TimeRange {
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string;
  /** reservations only */
  isMine?: boolean;
  /** reservations only. The booking is awaiting administrator approval (shown amber, never as confirmed). */
  pending?: boolean;
  /** reservations only. The booking is already over: it no longer occupies time or counts as "mine" in the picker. */
  ended?: boolean;
  /** reservations only. One of the resident's own pending/confirmed bookings for the date, ended or not: the database
   *  daily-cap trigger counts every one of them, so the picker must too. Implied by isMine. */
  ownForCap?: boolean;
}

export interface ComputeSlotsInput {
  /** Operating hours as minutes since midnight (amenity_rules times may be on the half hour). */
  openMins: number;
  closeMins: number;
  durationMins: number;
  isToday: boolean;
  /** Minutes since midnight in the community's timezone; only used when isToday. */
  nowMins: number;
  reservations: TimeRange[];
  /** Blockouts / maintenance already filtered to the selected date. */
  blocks: TimeRange[];
  /** Candidate start interval, default 30. */
  stepMins?: number;
  /**
   * Per-amenity limits that the database enforces (enforce_amenity_booking_rules). Surfaced here so a resident who is
   * already at the cap is not offered selectable times. Not modelled: buffers/min-time-between-reservations and weekly
   * caps - the schema has columns but no Greens V1 admin screen sets them and no trigger enforces them.
   */
  limits?: { maxPerDay?: number | null; maxDurationMins?: number | null };
}

export type LimitReason = 'daily' | 'duration' | null;

export function limitReason(input: Pick<ComputeSlotsInput, 'durationMins' | 'reservations' | 'limits'>): LimitReason {
  const { limits, durationMins, reservations } = input;
  if (!limits) return null;
  if (limits.maxDurationMins != null && durationMins > limits.maxDurationMins) return 'duration';
  if (limits.maxPerDay != null && reservations.filter((r) => r.isMine === true || r.ownForCap === true).length >= limits.maxPerDay) return 'daily';
  return null;
}

export function toMins(t: string): number {
  const [h, m] = t.split(':');
  return parseInt(h, 10) * 60 + parseInt(m ?? '0', 10);
}

export function fmtHHMM(mins: number): string {
  return `${Math.floor(mins / 60).toString().padStart(2, '0')}:${(mins % 60).toString().padStart(2, '0')}`;
}

function overlaps(aStart: number, aEnd: number, r: TimeRange): boolean {
  return aStart < toMins(r.end_time) && aEnd > toMins(r.start_time);
}

export function computeSlots(input: ComputeSlotsInput): SlotInfo[] {
  const { openMins: open, closeMins: close, durationMins, isToday, nowMins, blocks, stepMins = 30 } = input;
  // Ended reservations no longer occupy time (they still count toward the daily cap via limitReason).
  const reservations = input.reservations.filter((r) => !r.ended);
  const limited = limitReason(input) !== null;
  const out: SlotInfo[] = [];
  for (let s = open; s < close; s += stepMins) {
    const e = s + durationMins;
    if (e > close) continue; // would run past closing
    if (isToday && s <= nowMins) continue; // past times are hidden
    const start = fmtHHMM(s);
    // A blockout wins over a reservation: it is the stronger, management-set reason.
    if (blocks.some((b) => overlaps(s, e, b))) { out.push({ start, state: 'blocked' }); continue; }
    const hit = reservations.filter((r) => overlaps(s, e, r));
    if (hit.length > 0) {
      const containing = reservations.filter((r) => s >= toMins(r.start_time) && s < toMins(r.end_time));
      out.push({ start, state: 'reserved', inside: containing.length > 0, mine: containing.some((r) => r.isMine === true), pending: containing.some((r) => r.isMine === true && r.pending === true) && !containing.some((r) => r.isMine === true && !r.pending) });
      continue;
    }
    out.push({ start, state: limited ? 'limit' : 'available' });
  }
  return out;
}

export function isSelectable(slot: SlotInfo | undefined): boolean {
  return !!slot && slot.state === 'available';
}

/** Local calendar date key (YYYY-MM-DD). toISOString() would shift evening times to the next UTC day. */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

/** Re-check a chosen start against freshly fetched data; used right before the insert. */
export function revalidateSelection(selectedStart: string, input: ComputeSlotsInput): SlotState | 'gone' {
  const hit = computeSlots(input).find((s) => s.start === selectedStart);
  return hit ? hit.state : 'gone';
}
