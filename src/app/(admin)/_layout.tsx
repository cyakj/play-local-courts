import { Stack, Redirect } from 'expo-router';
import { Colors } from '@/constants/design';
import { useSession } from '@/context/NativeAuthContext';

export default function AdminLayout() {
  const { session, loading } = useSession();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.pageBg },
      }}
    />
  );
}
