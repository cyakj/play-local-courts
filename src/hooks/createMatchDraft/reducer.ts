import { STEP_ORDER, initialDraftState, type Action, type DraftState, type PlayFormat } from './types';

export function formatCapacity(playFormat: PlayFormat): number {
  return playFormat === 'doubles' ? 4 : 2;
}

export function maxInvitees(playFormat: PlayFormat, organizerIsPlaying: boolean): number {
  return formatCapacity(playFormat) - (organizerIsPlaying ? 1 : 0);
}

function clampPlayers<T>(players: T[], max: number): T[] {
  return players.length > max ? players.slice(0, max) : players;
}

export function createMatchReducer(state: DraftState, action: Action): DraftState {
  switch (action.type) {
    case 'SET_ACTIVITY_TYPE':
      return { ...state, draft: { ...state.draft, activityType: action.value } };

    case 'SET_PLAY_FORMAT': {
      const max = maxInvitees(action.value, state.draft.organizerIsPlaying);
      const nextGender = action.value === 'singles' && state.draft.genderPreference === 'mixed'
        ? 'all'
        : state.draft.genderPreference;
      return {
        ...state,
        draft: {
          ...state.draft,
          playFormat: action.value,
          players: clampPlayers(state.draft.players, max),
          genderPreference: nextGender,
        },
      };
    }

    case 'SET_ORGANIZER_PLAYING': {
      if (!state.draft.playFormat) {
        return { ...state, draft: { ...state.draft, organizerIsPlaying: action.value } };
      }
      const max = maxInvitees(state.draft.playFormat, action.value);
      return {
        ...state,
        draft: { ...state.draft, organizerIsPlaying: action.value, players: clampPlayers(state.draft.players, max) },
      };
    }

    case 'SET_LOCATION':
      return { ...state, draft: { ...state.draft, location: action.value } };

    case 'SET_DATE_TIME':
      return {
        ...state,
        draft: { ...state.draft, date: action.date, time: action.time, durationMinutes: action.durationMinutes },
      };

    case 'SET_PLAYERS':
      return { ...state, draft: { ...state.draft, players: action.value } };

    case 'SET_VISIBILITY':
      return { ...state, draft: { ...state.draft, visibility: action.value } };

    case 'SET_GENDER_PREFERENCE':
      return { ...state, draft: { ...state.draft, genderPreference: action.value } };

    case 'SET_SKILL_PREFERENCE': {
      const merged = { ...state.draft.skillPreference, ...action.value };
      if (merged.ratingSystem === 'none') {
        merged.minimum = null;
        merged.maximum = null;
        merged.enforcement = 'preference';
      }
      if (merged.enforcement === 'strict' && merged.ratingSystem === 'none') {
        merged.enforcement = 'preference';
      }
      if (merged.minimum !== null && merged.maximum !== null && merged.minimum > merged.maximum) {
        return state;
      }
      return { ...state, draft: { ...state.draft, skillPreference: merged } };
    }

    case 'SET_NOTE':
      return { ...state, draft: { ...state.draft, note: action.value } };

    case 'SET_COURT_RESERVED':
      return { ...state, draft: { ...state.draft, courtReserved: action.value } };

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

    case 'SUBMIT_START':
      return { ...state, submitting: true, submitError: null };

    case 'SUBMIT_SUCCESS':
      return { ...state, submitting: false, submitError: null };

    case 'SUBMIT_ERROR':
      return { ...state, submitting: false, submitError: action.message };

    case 'RESET':
      return initialDraftState();

    default:
      return state;
  }
}
