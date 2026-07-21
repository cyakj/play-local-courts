/**
 * Pure logic tests for the Create Match draft reducer, validation, and
 * payload mapping. Mirrors the production functions in
 * src/hooks/createMatchDraft/{reducer,validation,payload}.ts. Runs entirely
 * in Node (no browser, no Supabase) via the @playwright/test runner —
 * see tests/coach-logic.spec.ts for the established pattern.
 *
 * Run: npx playwright test tests/create-match-logic.spec.ts --reporter=list
 */
import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mirrors src/hooks/createMatchDraft/types.ts
// ---------------------------------------------------------------------------
type CreateMatchStep = 'activity' | 'location' | 'datetime' | 'players' | 'preferences' | 'details' | 'review';
const STEP_ORDER: CreateMatchStep[] = ['activity', 'location', 'datetime', 'players', 'preferences', 'details', 'review'];
type PlayFormat = 'singles' | 'doubles';
type RatingSystem = 'utr' | 'ntrp' | 'none';
type RatingEnforcement = 'preference' | 'strict';

interface SkillPreference { ratingSystem: RatingSystem; minimum: number | null; maximum: number | null; enforcement: RatingEnforcement; }
interface MatchInvitee { id: string; name: string; avatarUrl: string | null; utrRating: number | null; }
interface MatchLocation { id: string | null; name: string; city: string; distance: string; source: 'hoa' | 'club' | 'directory'; }

interface CreateMatchDraft {
  activityType: 'match' | 'practice_hit' | null;
  playFormat: PlayFormat | null;
  visibility: 'public' | 'invite_only';
  location: MatchLocation | null;
  date: Date;
  time: string | null;
  durationMinutes: number;
  organizerIsPlaying: boolean;
  players: MatchInvitee[];
  genderPreference: 'all' | 'men' | 'women' | 'mixed';
  skillPreference: SkillPreference;
  note: string;
  courtReserved: boolean;
  linkedReservationId: string | null;
}

interface DraftState { step: CreateMatchStep; furthestStep: CreateMatchStep; draft: CreateMatchDraft; submitting: boolean; submitError: string | null; }

type Action =
  | { type: 'SET_ACTIVITY_TYPE'; value: 'match' | 'practice_hit' }
  | { type: 'SET_PLAY_FORMAT'; value: PlayFormat }
  | { type: 'SET_ORGANIZER_PLAYING'; value: boolean }
  | { type: 'SET_LOCATION'; value: MatchLocation }
  | { type: 'SET_DATE_TIME'; date: Date; time: string; durationMinutes: number }
  | { type: 'SET_PLAYERS'; value: MatchInvitee[] }
  | { type: 'SET_VISIBILITY'; value: 'public' | 'invite_only' }
  | { type: 'SET_GENDER_PREFERENCE'; value: 'all' | 'men' | 'women' | 'mixed' }
  | { type: 'SET_SKILL_PREFERENCE'; value: Partial<SkillPreference> }
  | { type: 'SET_NOTE'; value: string }
  | { type: 'SET_COURT_RESERVED'; value: boolean }
  | { type: 'NEXT' } | { type: 'BACK' } | { type: 'GO_TO_STEP'; step: CreateMatchStep }
  | { type: 'SUBMIT_START' } | { type: 'SUBMIT_SUCCESS'; listingId: string } | { type: 'SUBMIT_ERROR'; message: string }
  | { type: 'RESET' };

function initialDraft(): CreateMatchDraft {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  return {
    activityType: null, playFormat: null, visibility: 'public', location: null, date: d, time: null,
    durationMinutes: 90, organizerIsPlaying: true, players: [], genderPreference: 'all',
    skillPreference: { ratingSystem: 'none', minimum: null, maximum: null, enforcement: 'preference' },
    note: '', courtReserved: false, linkedReservationId: null,
  };
}
function initialDraftState(): DraftState {
  return { step: 'activity', furthestStep: 'activity', draft: initialDraft(), submitting: false, submitError: null };
}

// Mirrors src/hooks/createMatchDraft/reducer.ts
function formatCapacity(playFormat: PlayFormat): number { return playFormat === 'doubles' ? 4 : 2; }
function maxInvitees(playFormat: PlayFormat, organizerIsPlaying: boolean): number {
  return formatCapacity(playFormat) - (organizerIsPlaying ? 1 : 0);
}
function clampPlayers<T>(players: T[], max: number): T[] { return players.length > max ? players.slice(0, max) : players; }

function createMatchReducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {
    case 'SET_ACTIVITY_TYPE': return { ...state, draft: { ...state.draft, activityType: action.value } };
    case 'SET_PLAY_FORMAT': {
      const max = maxInvitees(action.value, state.draft.organizerIsPlaying);
      const nextGender = action.value === 'singles' && state.draft.genderPreference === 'mixed' ? 'all' : state.draft.genderPreference;
      return { ...state, draft: { ...state.draft, playFormat: action.value, players: clampPlayers(state.draft.players, max), genderPreference: nextGender } };
    }
    case 'SET_ORGANIZER_PLAYING': {
      if (!state.draft.playFormat) return { ...state, draft: { ...state.draft, organizerIsPlaying: action.value } };
      const max = maxInvitees(state.draft.playFormat, action.value);
      return { ...state, draft: { ...state.draft, organizerIsPlaying: action.value, players: clampPlayers(state.draft.players, max) } };
    }
    case 'SET_LOCATION': return { ...state, draft: { ...state.draft, location: action.value } };
    case 'SET_DATE_TIME': return { ...state, draft: { ...state.draft, date: action.date, time: action.time, durationMinutes: action.durationMinutes } };
    case 'SET_PLAYERS': return { ...state, draft: { ...state.draft, players: action.value } };
    case 'SET_VISIBILITY': return { ...state, draft: { ...state.draft, visibility: action.value } };
    case 'SET_GENDER_PREFERENCE': return { ...state, draft: { ...state.draft, genderPreference: action.value } };
    case 'SET_SKILL_PREFERENCE': {
      const merged = { ...state.draft.skillPreference, ...action.value };
      if (merged.ratingSystem === 'none') { merged.minimum = null; merged.maximum = null; merged.enforcement = 'preference'; }
      if (merged.enforcement === 'strict' && merged.ratingSystem === 'none') merged.enforcement = 'preference';
      if (merged.minimum !== null && merged.maximum !== null && merged.minimum > merged.maximum) return state;
      return { ...state, draft: { ...state.draft, skillPreference: merged } };
    }
    case 'SET_NOTE': return { ...state, draft: { ...state.draft, note: action.value } };
    case 'SET_COURT_RESERVED': return { ...state, draft: { ...state.draft, courtReserved: action.value } };
    case 'NEXT': {
      const idx = STEP_ORDER.indexOf(state.step);
      if (idx >= STEP_ORDER.length - 1) return state;
      const furthestIdx = STEP_ORDER.indexOf(state.furthestStep);
      return { ...state, step: STEP_ORDER[idx + 1], furthestStep: STEP_ORDER[Math.max(idx + 1, furthestIdx)] };
    }
    case 'BACK': {
      const idx = STEP_ORDER.indexOf(state.step);
      if (idx <= 0) return state;
      return { ...state, step: STEP_ORDER[idx - 1] };
    }
    case 'GO_TO_STEP': {
      const targetIdx = STEP_ORDER.indexOf(action.step);
      const furthestIdx = STEP_ORDER.indexOf(state.furthestStep);
      if (targetIdx > furthestIdx) return state;
      return { ...state, step: action.step };
    }
    case 'SUBMIT_START': return { ...state, submitting: true, submitError: null };
    case 'SUBMIT_SUCCESS': return { ...state, submitting: false, submitError: null };
    case 'SUBMIT_ERROR': return { ...state, submitting: false, submitError: action.message };
    case 'RESET': return initialDraftState();
    default: return state;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
test.describe('createMatchReducer', () => {
  test('SET_PLAY_FORMAT to doubles allows up to 3 invitees when organizer plays', () => {
    expect(maxInvitees('doubles', true)).toBe(3);
    expect(maxInvitees('doubles', false)).toBe(4);
    expect(maxInvitees('singles', true)).toBe(1);
    expect(maxInvitees('singles', false)).toBe(2);
  });

  test('SET_PLAY_FORMAT to singles truncates players beyond new capacity', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'SET_PLAY_FORMAT', value: 'doubles' });
    const three: MatchInvitee[] = [
      { id: 'a', name: 'A', avatarUrl: null, utrRating: null },
      { id: 'b', name: 'B', avatarUrl: null, utrRating: null },
      { id: 'c', name: 'C', avatarUrl: null, utrRating: null },
    ];
    state = createMatchReducer(state, { type: 'SET_PLAYERS', value: three });
    state = createMatchReducer(state, { type: 'SET_PLAY_FORMAT', value: 'singles' });
    expect(state.draft.players).toEqual([three[0]]);
  });

  test('SET_PLAY_FORMAT to singles resets mixed gender preference to all', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'SET_PLAY_FORMAT', value: 'doubles' });
    state = createMatchReducer(state, { type: 'SET_GENDER_PREFERENCE', value: 'mixed' });
    state = createMatchReducer(state, { type: 'SET_PLAY_FORMAT', value: 'singles' });
    expect(state.draft.genderPreference).toBe('all');
  });

  test('SET_ORGANIZER_PLAYING false frees up a capacity slot and does not truncate', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'SET_PLAY_FORMAT', value: 'singles' });
    state = createMatchReducer(state, { type: 'SET_PLAYERS', value: [{ id: 'a', name: 'A', avatarUrl: null, utrRating: null }] });
    state = createMatchReducer(state, { type: 'SET_ORGANIZER_PLAYING', value: false });
    expect(state.draft.players.length).toBe(1);
    expect(state.draft.organizerIsPlaying).toBe(false);
  });

  test('SET_SKILL_PREFERENCE ratingSystem none clears range and forces preference enforcement', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'SET_SKILL_PREFERENCE', value: { ratingSystem: 'utr', minimum: 8, maximum: 12, enforcement: 'strict' } });
    state = createMatchReducer(state, { type: 'SET_SKILL_PREFERENCE', value: { ratingSystem: 'none' } });
    expect(state.draft.skillPreference).toEqual({ ratingSystem: 'none', minimum: null, maximum: null, enforcement: 'preference' });
  });

  test('SET_SKILL_PREFERENCE rejects strict enforcement when ratingSystem is none', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'SET_SKILL_PREFERENCE', value: { enforcement: 'strict' } });
    expect(state.draft.skillPreference.enforcement).toBe('preference');
  });

  test('SET_SKILL_PREFERENCE rejects minimum greater than maximum, keeps prior values', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'SET_SKILL_PREFERENCE', value: { ratingSystem: 'ntrp', minimum: 3, maximum: 5 } });
    const before = state.draft.skillPreference;
    state = createMatchReducer(state, { type: 'SET_SKILL_PREFERENCE', value: { minimum: 6 } });
    expect(state.draft.skillPreference).toEqual(before);
  });

  test('NEXT advances furthestStep, BACK does not regress it, GO_TO_STEP cannot jump past furthestStep', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'NEXT' }); // activity -> location
    state = createMatchReducer(state, { type: 'NEXT' }); // location -> datetime
    expect(state.step).toBe('datetime');
    expect(state.furthestStep).toBe('datetime');
    state = createMatchReducer(state, { type: 'BACK' }); // datetime -> location
    expect(state.step).toBe('location');
    expect(state.furthestStep).toBe('datetime');
    const blocked = createMatchReducer(state, { type: 'GO_TO_STEP', step: 'review' });
    expect(blocked.step).toBe('location'); // review is past furthestStep, rejected
    const allowed = createMatchReducer(state, { type: 'GO_TO_STEP', step: 'datetime' });
    expect(allowed.step).toBe('datetime'); // within furthestStep, allowed
  });

  test('NEXT is a no-op on the last step, BACK is a no-op on the first step', () => {
    let state = initialDraftState();
    const back = createMatchReducer(state, { type: 'BACK' });
    expect(back.step).toBe('activity');
    for (let i = 0; i < STEP_ORDER.length + 2; i++) state = createMatchReducer(state, { type: 'NEXT' });
    expect(state.step).toBe('review');
  });

  test('RESET returns a fresh initial state', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'SET_NOTE', value: 'hello' });
    state = createMatchReducer(state, { type: 'RESET' });
    expect(state.draft.note).toBe('');
    expect(state.step).toBe('activity');
  });

  test('SUBMIT_START/SUCCESS/ERROR manage submitting and submitError', () => {
    let state = initialDraftState();
    state = createMatchReducer(state, { type: 'SUBMIT_START' });
    expect(state.submitting).toBe(true);
    const errored = createMatchReducer(state, { type: 'SUBMIT_ERROR', message: 'boom' });
    expect(errored.submitting).toBe(false);
    expect(errored.submitError).toBe('boom');
    const succeeded = createMatchReducer(state, { type: 'SUBMIT_SUCCESS', listingId: 'abc' });
    expect(succeeded.submitting).toBe(false);
    expect(succeeded.submitError).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Mirrors src/hooks/createMatchDraft/validation.ts — add below the reducer mirror in the same file
// ---------------------------------------------------------------------------
const MAX_DAYS_AHEAD = 14;
function isWithinCreateWindow(date: Date): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAhead = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return daysAhead >= 0 && daysAhead <= MAX_DAYS_AHEAD;
}
function isStepValid(step: CreateMatchStep, draft: CreateMatchDraft): boolean {
  switch (step) {
    case 'activity': return draft.activityType !== null && draft.playFormat !== null;
    case 'location': return draft.location !== null;
    case 'datetime': return draft.time !== null && isWithinCreateWindow(draft.date);
    case 'players': return true;
    case 'preferences': return draft.skillPreference.enforcement !== 'strict' || draft.skillPreference.ratingSystem !== 'none';
    case 'details': return true;
    case 'review': return isDraftValid(draft);
    default: return false;
  }
}
function isDraftValid(draft: CreateMatchDraft): boolean {
  return isStepValid('activity', draft) && isStepValid('location', draft) && isStepValid('datetime', draft) && isStepValid('preferences', draft);
}
function wouldDropInvitees(currentPlayers: { id: string }[], nextFormat: PlayFormat, nextOrganizerPlaying: boolean): boolean {
  return currentPlayers.length > maxInvitees(nextFormat, nextOrganizerPlaying);
}

test.describe('validation', () => {
  const sampleLocation: MatchLocation = { id: '1', name: 'Court A', city: 'Dorado', distance: '1mi', source: 'hoa' };

  test('isStepValid activity requires both activityType and playFormat', () => {
    const draft = initialDraft();
    expect(isStepValid('activity', draft)).toBe(false);
    expect(isStepValid('activity', { ...draft, activityType: 'match' })).toBe(false);
    expect(isStepValid('activity', { ...draft, activityType: 'match', playFormat: 'singles' })).toBe(true);
  });

  test('isStepValid datetime requires a time and a date within 14 days', () => {
    const draft = initialDraft();
    expect(isStepValid('datetime', draft)).toBe(false);
    const withTime = { ...draft, time: '09:00' };
    expect(isStepValid('datetime', withTime)).toBe(true);
    const tooFar = new Date(); tooFar.setDate(tooFar.getDate() + 20);
    expect(isStepValid('datetime', { ...withTime, date: tooFar })).toBe(false);
  });

  test('isStepValid preferences rejects strict enforcement with no rating system', () => {
    const draft = initialDraft();
    expect(isStepValid('preferences', draft)).toBe(true); // default preference/none
    const strictNoSystem = { ...draft, skillPreference: { ratingSystem: 'none' as const, minimum: null, maximum: null, enforcement: 'strict' as const } };
    expect(isStepValid('preferences', strictNoSystem)).toBe(false);
    const strictWithSystem = { ...draft, skillPreference: { ratingSystem: 'utr' as const, minimum: 5, maximum: 10, enforcement: 'strict' as const } };
    expect(isStepValid('preferences', strictWithSystem)).toBe(true);
  });

  test('isDraftValid true only once activity, location, datetime, and preferences all pass', () => {
    const draft = { ...initialDraft(), activityType: 'match' as const, playFormat: 'singles' as const, location: sampleLocation, time: '09:00' };
    expect(isDraftValid(draft)).toBe(true);
    expect(isDraftValid({ ...draft, location: null })).toBe(false);
  });

  test('wouldDropInvitees predicts truncation without mutating anything', () => {
    const three = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(wouldDropInvitees(three, 'doubles', true)).toBe(false); // capacity 3
    expect(wouldDropInvitees(three, 'singles', true)).toBe(true);  // capacity 1
    expect(wouldDropInvitees(three, 'doubles', false)).toBe(false); // capacity 4
  });
});

// Mirrors src/hooks/createMatchDraft/payload.ts
function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function endTimeMirror(start: string, durationMinutes: number): string {
  const [hour, minute] = start.split(':').map(Number);
  const total = hour * 60 + minute + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function buildListingPayload(draft: CreateMatchDraft) {
  if (!draft.activityType || !draft.playFormat || !draft.location || !draft.time) throw new Error('incomplete draft');
  const { ratingSystem, minimum, maximum, enforcement } = draft.skillPreference;
  return {
    activity_type: draft.activityType, format: draft.playFormat, visibility: draft.visibility,
    match_date: dateKey(draft.date), start_time: draft.time, end_time: endTimeMirror(draft.time, draft.durationMinutes),
    duration_minutes: draft.durationMinutes, location: draft.location.name, location_id: draft.location.id,
    location_source: draft.location.source, play_with: draft.genderPreference, rating_system: ratingSystem,
    rating_enforcement: enforcement,
    ntrp_min: ratingSystem === 'ntrp' && minimum !== null ? minimum : 1.0,
    ntrp_max: ratingSystem === 'ntrp' && maximum !== null ? maximum : 7.0,
    utr_min: ratingSystem === 'utr' && minimum !== null ? minimum : 0,
    utr_max: ratingSystem === 'utr' && maximum !== null ? maximum : 16.5,
    note: draft.note.trim() || null, court_reserved: draft.courtReserved, linked_reservation_id: draft.linkedReservationId,
  };
}
function buildInviteeIds(draft: CreateMatchDraft): string[] { return draft.players.map(p => p.id); }

test.describe('payload mapping', () => {
  function readyDraft(): CreateMatchDraft {
    return {
      ...initialDraft(),
      activityType: 'match', playFormat: 'doubles',
      location: { id: 'loc-1', name: 'The Greens Court', city: 'Dorado', distance: '2mi', source: 'hoa' },
      time: '14:30', durationMinutes: 90,
    };
  }

  test('buildListingPayload throws on an incomplete draft', () => {
    expect(() => buildListingPayload(initialDraft())).toThrow();
  });

  test('buildListingPayload computes end_time and match_date correctly', () => {
    const payload = buildListingPayload(readyDraft());
    expect(payload.end_time).toBe('16:00');
    expect(payload.match_date).toBe(dateKey(readyDraft().date));
  });

  test('buildListingPayload leaves both rating pairs at their full-range default when ratingSystem is none', () => {
    const payload = buildListingPayload(readyDraft());
    expect(payload.rating_system).toBe('none');
    expect(payload.ntrp_min).toBe(1.0); expect(payload.ntrp_max).toBe(7.0);
    expect(payload.utr_min).toBe(0); expect(payload.utr_max).toBe(16.5);
  });

  test('buildListingPayload writes only the selected rating pair, leaves the other at default', () => {
    const draft = { ...readyDraft(), skillPreference: { ratingSystem: 'utr' as const, minimum: 8, maximum: 12, enforcement: 'strict' as const } };
    const payload = buildListingPayload(draft);
    expect(payload.utr_min).toBe(8); expect(payload.utr_max).toBe(12);
    expect(payload.ntrp_min).toBe(1.0); expect(payload.ntrp_max).toBe(7.0); // untouched default
    expect(payload.rating_enforcement).toBe('strict');
  });

  test('buildListingPayload trims note to null when blank', () => {
    expect(buildListingPayload({ ...readyDraft(), note: '   ' }).note).toBeNull();
    expect(buildListingPayload({ ...readyDraft(), note: '  hi  ' }).note).toBe('hi');
  });

  test('buildInviteeIds maps players to their ids in order', () => {
    const draft = { ...readyDraft(), players: [{ id: 'p1', name: 'A', avatarUrl: null, utrRating: null }, { id: 'p2', name: 'B', avatarUrl: null, utrRating: null }] };
    expect(buildInviteeIds(draft)).toEqual(['p1', 'p2']);
  });
});
