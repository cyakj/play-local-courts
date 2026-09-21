import { useEffect, useState } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { LayoutDashboard, AlertCircle, Calendar, Bell } from 'lucide-react-native';
import { BottomNav } from '@/components/ui/BottomNav';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/context/NativeAuthContext';
import { isCMRoutable } from '@/lib/roleRouting';

// This group renders the Condo Manager shell. Unlike the tab-hiding in
// (resident)/_layout.tsx, which is cosmetic only, this check is the sole
// thing standing between a plain resident and the admin UI on a cold
// load/refresh of a URL like /calendar or /maintenance — src/app/index.tsx's
// role-based redirect only runs for the literal `/` route, so a direct
// deep link here bypasses it entirely.
export default function CMLayout() {
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
    <Tabs
      tabBar={(props) => <BottomNav {...(props as any)} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'Issues',
          tabBarIcon: ({ color, size }) => <AlertCircle color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} strokeWidth={1.5} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{ href: null }}
      />
    </Tabs>
  );
}
