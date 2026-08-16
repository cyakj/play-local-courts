import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isCommunityMode } from '@/config/productMode';

// Resolves the signed-in resident's HOA name for Community-mode headers.
// No-ops (and issues no query) in Tennis mode.
export function useCommunityName(): string | undefined {
  const [name, setName] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isCommunityMode) return;
    let cancelled = false;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data: membership } = await supabase
        .from('hoa_memberships')
        .select('hoa_id')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .limit(1)
        .maybeSingle();
      if (!membership?.hoa_id || cancelled) return;

      const { data: hoa } = await supabase
        .from('hoas')
        .select('name')
        .eq('id', membership.hoa_id)
        .single();
      if (!cancelled) setName(hoa?.name ?? undefined);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return name;
}
