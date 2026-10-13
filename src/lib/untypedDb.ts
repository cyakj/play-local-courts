import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

/**
 * Same client as `supabase`, but without the generated `Database` generic.
 *
 * Needed only for tables/columns/RPCs introduced by migrations that are not yet applied to the
 * live project (so `src/lib/types.ts` cannot know them): report_notes visibility, status history,
 * court_maintenance.resident_message, court_maintenance_private and admin_* RPCs.
 * After applying 20261013100000 / 20261013110000 and regenerating types, switch these call sites
 * back to `supabase` and delete this file.
 */
export const db = supabase as unknown as SupabaseClient;
