import { Stack, Redirect } from 'expo-router';
import { useSession } from '@/context/NativeAuthContext';

export default function AuthLayout() {
  const { session, loading } = useSession();
  if (loading) return null;
  // Already authenticated — send back to index for role-based routing
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
