import { useCallback, useMemo, useReducer } from 'react';
import { supabase } from '@/lib/supabase';
import { createMatchReducer, maxInvitees } from './reducer';
import { isStepValid, isDraftValid, wouldDropInvitees } from './validation';
import { buildListingPayload, buildInviteeIds } from './payload';
import {
  initialDraftState,
  type CreateMatchStep, type ActivityType, type PlayFormat, type MatchLocation, type MatchInvitee,
  type MatchVisibility, type GenderPreference, type SkillPreference,
} from './types';

export interface UseCreateMatchDraftResult {
  step: CreateMatchStep;
  stepIndex: number;
  totalSteps: number;
  canGoBack: boolean;
  canGoNext: boolean;
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: CreateMatchStep) => void;

  activity: { activityType: ActivityType | null; playFormat: PlayFormat | null; organizerIsPlaying: boolean };
  setActivityType: (v: ActivityType) => void;
  setPlayFormat: (v: PlayFormat) => void;
  setOrganizerPlaying: (v: boolean) => void;
  wouldDropInviteesFor: (nextFormat: PlayFormat, nextOrganizerPlaying: boolean) => boolean;

  location: MatchLocation | null;
  setLocation: (v: MatchLocation) => void;

  dateTime: { date: Date; time: string | null; durationMinutes: number };
  setDateTime: (date: Date, time: string, durationMinutes: number) => void;

  players: MatchInvitee[];
  maxPlayers: number;
  setPlayers: (v: MatchInvitee[]) => void;

  visibility: MatchVisibility;
  setVisibility: (v: MatchVisibility) => void;
  genderPreference: GenderPreference;
  setGenderPreference: (v: GenderPreference) => void;
  skillPreference: SkillPreference;
  setSkillPreference: (v: Partial<SkillPreference>) => void;

  note: string;
  setNote: (v: string) => void;
  courtReserved: boolean;
  setCourtReserved: (v: boolean) => void;

  isDraftValid: boolean;
  hasMeaningfulSelections: boolean;

  submitting: boolean;
  submitError: string | null;
  notificationWarning: string | null;
  submit: () => Promise<string | null>;
  reset: () => void;
}

export function useCreateMatchDraft(): UseCreateMatchDraftResult {
  const [state, dispatch] = useReducer(createMatchReducer, undefined, initialDraftState);
  const { draft, step, furthestStep, submitting, submitError } = state;

  const stepIndexOf = (s: CreateMatchStep) => ['activity','location','datetime','players','preferences','details','review'].indexOf(s);

  const goNext = useCallback(() => dispatch({ type: 'NEXT' }), []);
  const goBack = useCallback(() => dispatch({ type: 'BACK' }), []);
  const goToStep = useCallback((s: CreateMatchStep) => dispatch({ type: 'GO_TO_STEP', step: s }), []);

  const setActivityType = useCallback((v: ActivityType) => dispatch({ type: 'SET_ACTIVITY_TYPE', value: v }), []);
  const setPlayFormat = useCallback((v: PlayFormat) => dispatch({ type: 'SET_PLAY_FORMAT', value: v }), []);
  const setOrganizerPlaying = useCallback((v: boolean) => dispatch({ type: 'SET_ORGANIZER_PLAYING', value: v }), []);
  const wouldDropInviteesFor = useCallback(
    (nextFormat: PlayFormat, nextOrganizerPlaying: boolean) => wouldDropInvitees(draft.players, nextFormat, nextOrganizerPlaying),
    [draft.players],
  );

  const setLocation = useCallback((v: MatchLocation) => dispatch({ type: 'SET_LOCATION', value: v }), []);
  const setDateTime = useCallback((date: Date, time: string, durationMinutes: number) =>
    dispatch({ type: 'SET_DATE_TIME', date, time, durationMinutes }), []);
  const setPlayers = useCallback((v: MatchInvitee[]) => dispatch({ type: 'SET_PLAYERS', value: v }), []);
  const setVisibility = useCallback((v: MatchVisibility) => dispatch({ type: 'SET_VISIBILITY', value: v }), []);
  const setGenderPreference = useCallback((v: GenderPreference) => dispatch({ type: 'SET_GENDER_PREFERENCE', value: v }), []);
  const setSkillPreference = useCallback((v: Partial<SkillPreference>) => dispatch({ type: 'SET_SKILL_PREFERENCE', value: v }), []);
  const setNote = useCallback((v: string) => dispatch({ type: 'SET_NOTE', value: v }), []);
  const setCourtReserved = useCallback((v: boolean) => dispatch({ type: 'SET_COURT_RESERVED', value: v }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const activity = useMemo(
    () => ({ activityType: draft.activityType, playFormat: draft.playFormat, organizerIsPlaying: draft.organizerIsPlaying }),
    [draft.activityType, draft.playFormat, draft.organizerIsPlaying],
  );
  const dateTime = useMemo(() => ({ date: draft.date, time: draft.time, durationMinutes: draft.durationMinutes }), [draft.date, draft.time, draft.durationMinutes]);
  const maxPlayers = draft.playFormat ? maxInvitees(draft.playFormat, draft.organizerIsPlaying) : 1;

  const hasMeaningfulSelections =
    draft.activityType !== null || draft.playFormat !== null || draft.location !== null || draft.time !== null || draft.players.length > 0 || draft.note.trim().length > 0;

  const submit = useCallback(async (): Promise<string | null> => {
    if (!isDraftValid(draft)) return null;
    dispatch({ type: 'SUBMIT_START' });
    const payload = buildListingPayload(draft);
    const inviteeIds = buildInviteeIds(draft);
    const { data, error } = await (supabase as any).rpc('create_match_listing', {
      listing: payload,
      invitee_ids: inviteeIds,
      organizer_playing: draft.organizerIsPlaying,
    });
    if (error) {
      const friendly = mapCreateListingError(error.message);
      dispatch({ type: 'SUBMIT_ERROR', message: friendly });
      return null;
    }
    dispatch({ type: 'SUBMIT_SUCCESS', listingId: data as string });
    // Notification firing is intentionally outside this function's error path —
    // see Task 16 (matchRequests.ts) and Task 24 (match/new.tsx), which call the
    // notification helper separately after a successful submit() resolves, so a
    // notification failure can never surface as a listing-creation failure.
    return data as string;
  }, [draft]);

  return {
    step, stepIndex: stepIndexOf(step), totalSteps: 7,
    canGoBack: stepIndexOf(step) > 0,
    canGoNext: isStepValid(step, draft),
    goNext, goBack, goToStep,
    activity, setActivityType, setPlayFormat, setOrganizerPlaying, wouldDropInviteesFor,
    location: draft.location, setLocation,
    dateTime, setDateTime,
    players: draft.players, maxPlayers, setPlayers,
    visibility: draft.visibility, setVisibility,
    genderPreference: draft.genderPreference, setGenderPreference,
    skillPreference: draft.skillPreference, setSkillPreference,
    note: draft.note, setNote,
    courtReserved: draft.courtReserved, setCourtReserved,
    isDraftValid: isDraftValid(draft),
    hasMeaningfulSelections,
    submitting, submitError, notificationWarning: null,
    submit, reset,
  };
}

function mapCreateListingError(message: string): string {
  if (message.includes('invitee_count_exceeds_capacity')) return 'You\'ve invited more players than this format allows.';
  if (message.includes('duplicate_invitation')) return 'One of these players has already been invited or has requested to join.';
  if (message.includes('unauthorized')) return 'You need to be signed in to create a match.';
  return 'Something went wrong creating your match. Please try again.';
}
