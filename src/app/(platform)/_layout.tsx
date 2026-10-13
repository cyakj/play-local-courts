import { useEffect, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { A } from '@/constants/adminTheme';
import { ThemeProvider } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/context/NativeAuthContext';
import { isPlatformReviewerRoutable } from '@/lib/roleRouting';

// TenisX Platform Admin shell: reviews community registrations (hoa_applications).
//
// This client check only decides what to RENDER. Every action is enforced again in Postgres:
// approve_hoa_application / update_hoa_application_status require has_role(..., 'platform_reviewer')
// and the hoa_applications / hoa_application_notes policies only expose other people's rows to that
// role. A resident who deep-links here gets bounced, and could not read or change anything anyway.
export default function PlatformLayout() {
  const { session, loading } = useSession();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) { setAuthorized(null); return; }
    let cancelled = false;
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        setAuthorized(!error && isPlatformReviewerRoutable((data ?? []).map((r) => r.role)));
      });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (authorized === null) return null;
  if (!authorized) return <Redirect href="/" />;

  // Always light, like the other admin shells.
  return (
    <ThemeProvider initialMode="light">
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: A.background },
        }}
      />
    </ThemeProvider>
  );
}
