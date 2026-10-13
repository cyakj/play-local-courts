import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { isCMRoutable } from '@/lib/roleRouting';
import { A } from '@/constants/adminTheme';
import CommunityMessages from '@/components/messaging/CommunityMessages';

/** Root /messages route in Community mode: picks the admin or resident flavour from the user's roles. */
export default function CommunityMessagesRoute() {
  const [role, setRole] = useState<'admin' | 'resident' | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { if (!cancelled) setRole('resident'); return; }
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
      if (!cancelled) setRole(isCMRoutable((data ?? []).map((r) => r.role)) ? 'admin' : 'resident');
    });
    return () => { cancelled = true; };
  }, []);

  if (!role) return <View style={{ flex: 1, backgroundColor: A.background }} />;
  return <CommunityMessages role={role} />;
}
