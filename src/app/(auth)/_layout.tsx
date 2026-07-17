import { Stack, Redirect } from 'expo-router';
import { useSession } from '@/context/NativeAuthContext';

export default function AuthLayout() {
  const { session, loading, isPasswordRecovery } = useSession();
  if (loading) return null;
  // A PASSWORD_RECOVERY session must never be treated as "signed in" — it
  // exists only so reset-password.tsx can call updateUser(). Redirecting it
  // to "/" for role-based routing is the exact bug this guards against.
  if (session && !isPasswordRecovery) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
