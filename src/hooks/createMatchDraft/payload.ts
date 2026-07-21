import type { CreateMatchDraft } from './types';

export interface ListingPayload {
  activity_type: string;
  format: string;
  visibility: string;
  match_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  location: string;
  location_id: string | null;
  location_source: string;
  play_with: string;
  rating_system: string;
  rating_enforcement: string;
  ntrp_min: number;
  ntrp_max: number;
  utr_min: number;
  utr_max: number;
  note: string | null;
  court_reserved: boolean;
  linked_reservation_id: string | null;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function endTime(start: string, durationMinutes: number): string {
  const [hour, minute] = start.split(':').map(Number);
  const total = hour * 60 + minute + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const NTRP_DEFAULT_MIN = 1.0;
const NTRP_DEFAULT_MAX = 7.0;
const UTR_DEFAULT_MIN = 0;
const UTR_DEFAULT_MAX = 16.5;

export function buildListingPayload(draft: CreateMatchDraft): ListingPayload {
  if (!draft.activityType || !draft.playFormat || !draft.location || !draft.time) {
    throw new Error('buildListingPayload called with an incomplete draft');
  }
  const { ratingSystem, minimum, maximum, enforcement } = draft.skillPreference;
  return {
    activity_type: draft.activityType,
    format: draft.playFormat,
    visibility: draft.visibility,
    match_date: dateKey(draft.date),
    start_time: draft.time,
    end_time: endTime(draft.time, draft.durationMinutes),
    duration_minutes: draft.durationMinutes,
    location: draft.location.name,
    location_id: draft.location.id,
    location_source: draft.location.source,
    play_with: draft.genderPreference,
    rating_system: ratingSystem,
    rating_enforcement: enforcement,
    ntrp_min: ratingSystem === 'ntrp' && minimum !== null ? minimum : NTRP_DEFAULT_MIN,
    ntrp_max: ratingSystem === 'ntrp' && maximum !== null ? maximum : NTRP_DEFAULT_MAX,
    utr_min: ratingSystem === 'utr' && minimum !== null ? minimum : UTR_DEFAULT_MIN,
    utr_max: ratingSystem === 'utr' && maximum !== null ? maximum : UTR_DEFAULT_MAX,
    note: draft.note.trim() || null,
    court_reserved: draft.courtReserved,
    linked_reservation_id: draft.linkedReservationId,
  };
}

export function buildInviteeIds(draft: CreateMatchDraft): string[] {
  return draft.players.map(p => p.id);
}
