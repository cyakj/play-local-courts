import { useEffect } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { isCommunityMode } from '@/config/productMode';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/context/NativeAuthContext';

export default function RootIndex() {
  const { session, loading } = useSession();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/(auth)/login');
      return;
    }

    async function routeByRole() {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session!.user.id);

      const roles = (rolesData ?? []).map((r: { role: string }) => r.role);
      const isCM    = roles.some((r) =>
        ['admin', 'condo_manager', 'manager', 'hoa_manager', 'board_admin'].includes(r),
      );
      const isCoach = roles.includes('coach') && !isCommunityMode;

      if (isCM)         router.replace('/(cm)');
      else if (isCoach) router.replace('/(coach)');
      else              router.replace('/(resident)');
    }

    routeByRole().catch(() => {
      // Role lookup failed (network error). Fall back to resident — layout guards
      // will redirect to login if the user's actual role lacks access.
      router.replace('/(resident)');
    });
  }, [session, loading]);

  return <View style={{ flex: 1, backgroundColor: '#0C0F18' }} />;
}
