import type { CreateMatchStep, CreateMatchDraft, PlayFormat } from './types';
import { maxInvitees } from './reducer';

const MAX_DAYS_AHEAD = 14;

export function isWithinCreateWindow(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAhead = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  return daysAhead >= 0 && daysAhead <= MAX_DAYS_AHEAD;
}

export function isStepValid(step: CreateMatchStep, draft: CreateMatchDraft): boolean {
  switch (step) {
    case 'activity':
      return draft.activityType !== null && draft.playFormat !== null;
    case 'location':
      return draft.location !== null;
    case 'datetime':
      return draft.time !== null && isWithinCreateWindow(draft.date);
    case 'players':
      return true;
    case 'preferences':
      return draft.skillPreference.enforcement !== 'strict' || draft.skillPreference.ratingSystem !== 'none';
    case 'details':
      return true;
    case 'review':
      return isDraftValid(draft);
    default:
      return false;
  }
}

export function isDraftValid(draft: CreateMatchDraft): boolean {
  return (
    isStepValid('activity', draft) &&
    isStepValid('location', draft) &&
    isStepValid('datetime', draft) &&
    isStepValid('preferences', draft)
  );
}

export function wouldDropInvitees(
  currentPlayers: { id: string }[],
  nextFormat: PlayFormat,
  nextOrganizerPlaying: boolean,
): boolean {
  return currentPlayers.length > maxInvitees(nextFormat, nextOrganizerPlaying);
}
