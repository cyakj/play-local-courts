import { Stack, Redirect } from 'expo-router';
import { useSession } from '@/context/NativeAuthContext';

export default function AuthLayout() {
  const { session, loading } = useSession();
  if (loading) return null;
  // reset-password lives as a top-level route (src/app/reset-password.tsx),
  // not under this group, precisely so it is never subject to this redirect:
  // useSegments()-based exemptions here would race against the child screen
  // mounting (this layout's render commits, and can redirect away, before a
  // nested screen's own effects ever run) — see commit history for the bug
  // that caused. Login/signup are the only screens left in this group, and
  // both should redirect away from an existing session.
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
