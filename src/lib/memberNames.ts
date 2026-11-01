import { db } from '@/lib/untypedDb';
import { supabase } from '@/lib/supabase';

/** "function not found": a server that has not applied 20261031120000_profiles_member_read_gap.sql yet. */
function isMissingFunctionError(err: { code?: string; message?: string } | null | undefined): boolean {
  return !!err && (err.code === 'PGRST202' || err.code === '42883' || /could not find the function|does not exist/i.test(err.message ?? ''));
}

/**
 * Display names (id -> full_name) of people the caller shares a community with. Uses community_member_names(), which returns ONLY
 * id + full_name. A server without that function (legacy) falls back to selecting just those two columns from profiles.
 * Never selects other profile columns.
 */
export async function fetchMemberNames(ids: readonly string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = [...new Set(ids)].filter(Boolean);
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const res = await db.rpc('community_member_names', { p_ids: chunk });
    let rows = res.data as { id: string; full_name: string | null }[] | null;
    if (res.error) {
      if (!isMissingFunctionError(res.error)) throw res.error;
      const legacy = await supabase.from('profiles').select('id, full_name').in('id', chunk);
      if (legacy.error) throw legacy.error;
      rows = legacy.data;
    }
    for (const r of rows ?? []) out.set(r.id, r.full_name ?? null);
  }
  return out;
}
