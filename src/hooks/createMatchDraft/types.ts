// src/hooks/createMatchDraft/types.ts

export type CreateMatchStep = 'activity' | 'location' | 'datetime' | 'players' | 'preferences' | 'details' | 'review';

export const STEP_ORDER: CreateMatchStep[] = ['activity', 'location', 'datetime', 'players', 'preferences', 'details', 'review'];

export type ActivityType = 'match' | 'practice_hit';
export type PlayFormat = 'singles' | 'doubles';
export type MatchVisibility = 'public' | 'invite_only';
export type GenderPreference = 'all' | 'men' | 'women' | 'mixed';
export type RatingSystem = 'utr' | 'ntrp' | 'none';
export type RatingEnforcement = 'preference' | 'strict';

export interface SkillPreference {
  ratingSystem: RatingSystem;
  minimum: number | null;
  maximum: number | null;
  enforcement: RatingEnforcement;
}

export interface MatchLocation {
  id: string | null;
  name: string;
  city: string;
  distance: string;
  source: 'hoa' | 'club' | 'directory';
}

export interface MatchInvitee {
  id: string;
  name: string;
  avatarUrl: string | null;
  utrRating: number | null;
  sameCommunity?: boolean;
}

export interface CreateMatchDraft {
  activityType: ActivityType | null;
  playFormat: PlayFormat | null;
  visibility: MatchVisibility;
  location: MatchLocation | null;
  date: Date;
  time: string | null;
  durationMinutes: number;
  organizerIsPlaying: boolean;
  players: MatchInvitee[];
  genderPreference: GenderPreference;
  skillPreference: SkillPreference;
  note: string;
  courtReserved: boolean;
  linkedReservationId: string | null;
}

export interface DraftState {
  step: CreateMatchStep;
  furthestStep: CreateMatchStep;
  draft: CreateMatchDraft;
  submitting: boolean;
  submitError: string | null;
}

export type Action =
  | { type: 'SET_ACTIVITY_TYPE'; value: ActivityType }
  | { type: 'SET_PLAY_FORMAT'; value: PlayFormat }
  | { type: 'SET_ORGANIZER_PLAYING'; value: boolean }
  | { type: 'SET_LOCATION'; value: MatchLocation }
  | { type: 'SET_DATE_TIME'; date: Date; time: string; durationMinutes: number }
  | { type: 'SET_PLAYERS'; value: MatchInvitee[] }
  | { type: 'SET_VISIBILITY'; value: MatchVisibility }
  | { type: 'SET_GENDER_PREFERENCE'; value: GenderPreference }
  | { type: 'SET_SKILL_PREFERENCE'; value: Partial<SkillPreference> }
  | { type: 'SET_NOTE'; value: string }
  | { type: 'SET_COURT_RESERVED'; value: boolean }
  | { type: 'NEXT' }
  | { type: 'BACK' }
  | { type: 'GO_TO_STEP'; step: CreateMatchStep }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS'; listingId: string }
  | { type: 'SUBMIT_ERROR'; message: string }
  | { type: 'RESET' };

export function todayAtMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function initialDraft(): CreateMatchDraft {
  return {
    activityType: null,
    playFormat: null,
    visibility: 'public',
    location: null,
    date: todayAtMidnight(),
    time: null,
    durationMinutes: 90,
    organizerIsPlaying: true,
    players: [],
    genderPreference: 'all',
    skillPreference: { ratingSystem: 'none', minimum: null, maximum: null, enforcement: 'preference' },
    note: '',
    courtReserved: false,
    linkedReservationId: null,
  };
}

export function initialDraftState(): DraftState {
  return {
    step: 'activity',
    furthestStep: 'activity',
    draft: initialDraft(),
    submitting: false,
    submitError: null,
  };
}
