import { useEffect, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { Colors } from '@/constants/design';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/context/NativeAuthContext';
import { isCMRoutable } from '@/lib/roleRouting';

// Same role gate as (cm)/_layout.tsx, and for the same reason: this group
// holds Manage Amenities / Manage Courts / Pending Requests, and a cold
// load/refresh of their URLs bypasses index.tsx's role-based redirect
// entirely since that redirect only runs for the literal `/` route.
export default function AdminLayout() {
  const { session, loading } = useSession();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) { setAuthorized(null); return; }
    let cancelled = false;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setAuthorized(isCMRoutable((data ?? []).map((r) => r.role)));
      });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (authorized === null) return null;
  if (!authorized) return <Redirect href="/(resident)" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.pageBg },
      }}
    />
  );
}
