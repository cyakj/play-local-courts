// Pure interest rules. Authorization and request limits are enforced by the RPCs.
export const COMMUNITY_TYPES = [
  { value: 'hoa', label: 'HOA' }, { value: 'condo', label: 'Condo' },
  { value: 'coop', label: 'Co-op' }, { value: 'townhome', label: 'Townhome' },
  { value: 'other', label: 'Other' },
] as const;
export const INTEREST_STATUSES = ['new', 'contacted', 'in_review', 'onboarding', 'declined', 'closed'] as const;
export type InterestStatus = typeof INTEREST_STATUSES[number];
export type InterestTone = 'warning' | 'info' | 'success' | 'error' | 'neutral';
const STATUS_DISPLAY: Record<InterestStatus, { label: string; tone: InterestTone }> = {
  new: { label: 'New', tone: 'warning' }, contacted: { label: 'Contacted', tone: 'info' },
  in_review: { label: 'In review', tone: 'info' }, onboarding: { label: 'Onboarding', tone: 'success' },
  declined: { label: 'Declined', tone: 'error' }, closed: { label: 'Closed', tone: 'neutral' },
};
export interface InterestFormInput {
  communityName: string; city: string; region: string; communityType: string;
  approxUnits: string; contactName: string; contactEmail: string; notes: string;
}
export type InterestFormErrors = Partial<Record<keyof InterestFormInput, string>>;
export function normalizeInterestInput(input: InterestFormInput) {
  const optional = (s: string) => s.trim() || null;
  return {
    communityName: input.communityName.trim(), city: input.city.trim(), region: optional(input.region),
    communityType: input.communityType.trim(), approxUnits: input.approxUnits.trim() ? Number(input.approxUnits.trim()) : null,
    contactName: optional(input.contactName), contactEmail: optional(input.contactEmail), notes: optional(input.notes),
  };
}
export function validateInterestForm(input: InterestFormInput): InterestFormErrors {
  const n = normalizeInterestInput(input);
  const errors: InterestFormErrors = {};
  if (n.communityName.length < 2 || n.communityName.length > 120) errors.communityName = 'Use 2 to 120 characters.';
  if (n.city.length < 2 || n.city.length > 80) errors.city = 'Use 2 to 80 characters.';
  if ((n.region?.length ?? 0) > 80) errors.region = 'Use at most 80 characters.';
  if (!COMMUNITY_TYPES.some((t) => t.value === n.communityType)) errors.communityType = 'Choose a community type.';
  if (n.approxUnits !== null && (!/^\d+$/.test(input.approxUnits.trim()) || !Number.isInteger(n.approxUnits) || n.approxUnits < 1 || n.approxUnits > 100000)) errors.approxUnits = 'Enter a whole number from 1 to 100000.';
  if ((n.contactName?.length ?? 0) > 120) errors.contactName = 'Use at most 120 characters.';
  if (n.contactEmail && (n.contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n.contactEmail))) errors.contactEmail = 'Enter a valid email address.';
  if ((n.notes?.length ?? 0) > 1000) errors.notes = 'Use at most 1000 characters.';
  return errors;
}
export function interestStatusDisplay(status: string | null | undefined): { label: string; tone: InterestTone } {
  return INTEREST_STATUSES.includes(status as InterestStatus)
    ? STATUS_DISPLAY[status as InterestStatus] : { label: 'Status unavailable', tone: 'neutral' };
}
export function buildInviteMessage({ communityName, requesterFirstName }: { communityName: string; requesterFirstName?: string }): string {
  return `${requesterFirstName?.trim() ? `Hi, it's ${requesterFirstName.trim().split(/\s+/)[0]}. ` : 'Hello! '}TenisX helps communities manage tennis and sports court bookings. Please register ${communityName.trim()} with TenisX at tenisx.ai so our residents can get started.`;
}
export function classifyInterestError(error: unknown): string {
  const e = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown; details?: unknown; constraint?: unknown } : {};
  const code = typeof e.code === 'string' ? e.code : '';
  const message = typeof e.message === 'string' ? e.message : typeof error === 'string' ? error : '';
  if (['42883', 'PGRST202', '42P01', 'PGRST205'].includes(code)) return 'Community interest is not available yet - the latest database update has not been applied.';
  if (code === '23505' && [message, e.details, e.constraint].some((value) => typeof value === 'string' && value.includes('community_interest_one_open_per_community'))) return 'This requester already has an open request for that community';
  if (code === '23505' || /already told us|duplicate|already exists/i.test(message)) return 'You have already told us about this community.';
  if (code === '42501') return 'You do not have permission for this action. Sign in with a verified email address and try again.';
  if (code === '22023') return message || 'Check the community details and try again.';
  return 'Could not complete this request. Check your connection and try again.';
}
