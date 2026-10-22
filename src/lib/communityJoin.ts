import { supabase } from '@/lib/supabase';
// withdraw_membership_request ships in migration 20261022120000 (not applied yet), so it is absent from the
// generated types. Switch to `supabase` and delete the untyped call once types are regenerated.
import { db } from '@/lib/untypedDb';
import {
  SEARCH_LIMIT,
  buildJoinRpcArgs,
  sanitizeSearchTerm,
  toCommunityResults,
  type CommunityResult,
  type MyMembership,
} from '@/lib/communityJoinLogic';

export interface MyMembershipRow extends MyMembership {
  id: string;
  hoaName: string;
  createdAt: string;
}

/** The caller's own memberships (RLS: own rows only) with community names, newest first. */
export async function fetchMyMemberships(userId: string): Promise<MyMembershipRow[]> {
  const { data, error } = await supabase
    .from('hoa_memberships')
    .select('id, hoa_id, status, created_at')
    .eq('user_id', userId)
    .eq('role', 'resident')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  // Names come from the approved-only directory view, never from `hoas` (which RLS limits to approved members).
  const { data: dir, error: dirErr } = await supabase
    .from('public_hoa_directory')
    .select('id, name')
    .in('id', rows.map((r) => r.hoa_id));
  if (dirErr) throw dirErr;
  const names = new Map((dir ?? []).map((d) => [d.id as string, d.name as string]));

  return rows.map((r) => ({
    id: r.id,
    hoaId: r.hoa_id,
    status: r.status,
    hoaName: names.get(r.hoa_id) ?? 'Community',
    createdAt: r.created_at,
  }));
}

/** Search discoverable (approved) communities by name. Returns [] without querying for short/blank input. */
export async function searchCommunities(raw: string, mine: MyMembership[]): Promise<CommunityResult[]> {
  const { term, valid } = sanitizeSearchTerm(raw);
  if (!valid) return [];
  const { data, error } = await supabase
    .from('public_hoa_directory')
    .select('id, name, community_type')
    .ilike('name', `%${term}%`)
    .order('name')
    .limit(SEARCH_LIMIT);
  if (error) throw error;
  return toCommunityResults(data ?? [], mine);
}

/** The only supported way to request membership. Role/status/user are decided server-side. */
export async function requestToJoin(hoaId: string, message?: string): Promise<void> {
  const { error } = await supabase.rpc('request_hoa_membership', buildJoinRpcArgs(hoaId, message));
  if (error) throw error;
}

/** Withdraw the caller's own pending request. Returns false when there was nothing pending to withdraw. */
export async function withdrawRequest(hoaId: string): Promise<boolean> {
  const { data, error } = await db.rpc('withdraw_membership_request', { target_hoa_id: hoaId });
  if (error) throw error;
  return data === true;
}
