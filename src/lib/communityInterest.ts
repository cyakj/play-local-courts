import { db } from '@/lib/untypedDb';
import { normalizeInterestInput, validateInterestForm, type InterestFormInput } from '@/lib/communityInterestLogic';

export interface InterestRequest {
  id: string; requester_id: string; community_name: string; city: string; region: string | null;
  community_type: string; approx_units: number | null; contact_name: string | null;
  contact_email: string | null; notes: string | null; status: string; status_message: string | null;
  linked_application_id: string | null; created_at: string; updated_at: string;
}
export interface InterestNote { id: string; request_id: string; reviewer_id: string; note: string; created_at: string }
export interface InterestUpdate {
  requestId: string; status: string; statusMessage: string; internalNote?: string; linkedApplicationId?: string | null;
  clearLink?: boolean;
}

export async function submitCommunityInterest(input: InterestFormInput): Promise<string> {
  const errors = validateInterestForm(input);
  if (Object.keys(errors).length) throw { code: '22023', message: Object.values(errors)[0] };
  const n = normalizeInterestInput(input);
  const { data, error } = await db.rpc('submit_community_interest', {
    p_community_name: n.communityName, p_city: n.city, p_region: n.region,
    p_community_type: n.communityType, p_approx_units: n.approxUnits,
    p_contact_name: n.contactName, p_contact_email: n.contactEmail, p_notes: n.notes,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchMyInterestRequests(): Promise<InterestRequest[]> {
  // Explicit own-user scope also keeps reviewers' resident view limited to their own requests.
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw { code: '42501', message: 'Sign in first.' };
  const { data, error } = await db.from('community_interest_requests').select('*')
    .eq('requester_id', auth.user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InterestRequest[];
}

export async function fetchAllInterestRequests(): Promise<InterestRequest[]> {
  const { data, error } = await db.from('community_interest_requests').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InterestRequest[];
}

export async function updateCommunityInterest(input: InterestUpdate): Promise<void> {
  const { error } = await db.rpc('update_community_interest', {
    p_request_id: input.requestId, p_status: input.status, p_status_message: input.statusMessage,
    p_internal_note: input.internalNote ?? null, p_linked_application_id: input.linkedApplicationId ?? null,
    p_clear_link: input.clearLink ?? false,
  });
  if (error) throw error;
}

export async function fetchInterestNotes(requestId: string): Promise<InterestNote[]> {
  const { data, error } = await db.from('community_interest_notes').select('id, request_id, reviewer_id, note, created_at')
    .eq('request_id', requestId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as InterestNote[];
}
