import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

export default function RootIndex() {
  useEffect(() => {
    async function determineRoute() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id);

      const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
      const isCM    = roles.some((r) => ['admin', 'condo_manager', 'manager'].includes(r));
      const isCoach = roles.includes('coach');

      if (isCM)         router.replace('/(cm)');
      else if (isCoach) router.replace('/(coach)');
      else              router.replace('/(resident)');
    }

    determineRoute();
  }, []);

  // Dark screen while session resolves — matches splash color
  return <View style={{ flex: 1, backgroundColor: '#0C0F18' }} />;
}
