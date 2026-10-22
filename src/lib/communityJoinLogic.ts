// Pure rules for Resident signup + "find my community" + membership-request status.
// No React / Supabase imports so it runs in the Node-only logic tests
// (npx playwright test -c playwright.logic.config.ts community-join-logic).
// Authorization is enforced server-side (migration 20261022120000); nothing here is a security boundary.

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_CHARS = 60;
export const SEARCH_LIMIT = 20;
export const PASSWORD_MIN = 8;
export const JOIN_MESSAGE_MAX = 500;

export type MembershipStatus = 'pending' | 'approved' | 'rejected';

/** Escape LIKE wildcards so a typed `%` / `_` cannot widen the match across the directory. */
export function sanitizeSearchTerm(raw: string): { term: string; valid: boolean } {
  const collapsed = raw.replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX_CHARS);
  const term = collapsed.replace(/[\\%_]/g, (c) => `\\${c}`);
  return { term, valid: collapsed.length >= SEARCH_MIN_CHARS };
}

export interface SignupInput { fullName: string; email: string; password: string }

export function validateSignup({ fullName, email, password }: SignupInput): string | null {
  if (fullName.trim().length < 2) return 'Please enter your full name.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  return null;
}

/**
 * Resident accounts are created with identity data only. Role, community and status are NEVER sent from the
 * client: a new account is a plain Resident, and community access only comes from an approved membership.
 */
export function buildSignupOptions(fullName: string, emailRedirectTo?: string) {
  return {
    ...(emailRedirectTo ? { emailRedirectTo } : {}),
    data: { full_name: fullName.trim() },
  };
}

export function buildJoinRpcArgs(hoaId: string, message?: string) {
  const trimmed = (message ?? '').trim().slice(0, JOIN_MESSAGE_MAX);
  return { target_hoa_id: hoaId, join_message: trimmed.length ? trimmed : undefined };
}

export type StatusTone = 'pending' | 'approved' | 'rejected' | 'unknown';

export function membershipDisplay(status: string | null | undefined): { label: string; tone: StatusTone; description: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending approval', tone: 'pending', description: 'Your request was sent to the community admin. You will get access once it is approved.' };
    case 'approved':
      return { label: 'Approved', tone: 'approved', description: 'You are a member of this community.' };
    case 'rejected':
      return { label: 'Not approved', tone: 'rejected', description: 'The community admin did not approve this request. Contact them directly if you think this is a mistake.' };
    default:
      return { label: 'Status unavailable', tone: 'unknown', description: 'We could not read the status of this request. Pull to retry.' };
  }
}

export type JoinErrorKind = 'already_requested' | 'unverified' | 'not_available' | 'network' | 'other';

export function classifyJoinError(err: unknown): JoinErrorKind {
  const msg = (() => {
    if (err instanceof Error) return err.message;
    if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
      return (err as { message: string }).message;
    }
    return typeof err === 'string' ? err : '';
  })().toLowerCase();
  if (msg.includes('already exists') || msg.includes('duplicate key')) return 'already_requested';
  if (msg.includes('verify your email')) return 'unverified';
  if (msg.includes('community not found')) return 'not_available';
  if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout')) return 'network';
  return 'other';
}

export function joinErrorMessage(kind: JoinErrorKind): string {
  switch (kind) {
    case 'already_requested': return 'You already have a request for this community.';
    case 'unverified': return 'Verify your email address first, then try again.';
    case 'not_available': return 'That community is not available to join.';
    case 'network': return 'Network problem. Check your connection and try again.';
    default: return 'Something went wrong. Please try again.';
  }
}

export interface DirectoryRow { id: string | null; name: string | null; community_type: string | null }
export interface MyMembership { hoaId: string; status: MembershipStatus | string }

export interface CommunityResult { id: string; name: string; communityType: string | null; myStatus: string | null }

/** Drop malformed rows and attach the caller's own request status so duplicates are blocked in the UI too. */
export function toCommunityResults(rows: DirectoryRow[], mine: MyMembership[]): CommunityResult[] {
  const byHoa = new Map(mine.map((m) => [m.hoaId, m.status]));
  return rows
    .filter((r): r is DirectoryRow & { id: string; name: string } => !!r.id && !!r.name)
    .map((r) => ({ id: r.id, name: r.name, communityType: r.community_type, myStatus: byHoa.get(r.id) ?? null }));
}

/** A request can only be started when there is no existing row for that community (UNIQUE(user_id, hoa_id)). */
export function canRequestToJoin(myStatus: string | null): boolean {
  return myStatus === null;
}
