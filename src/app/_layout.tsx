import {
  Manrope_800ExtraBold as ManropeBlack,
  Manrope_800ExtraBold as ManropeExtraBold,
  Manrope_700Bold as ManropeBold,
  Manrope_600SemiBold as ManropeSemiBold,
  Manrope_500Medium as ManropeMedium,
} from '@expo-google-fonts/manrope';
import { SpaceGrotesk_700Bold as SpaceGroteskBold } from '@expo-google-fonts/space-grotesk';
import { JetBrainsMono_600SemiBold as JetbrainsMonoSemiBold } from '@expo-google-fonts/jetbrains-mono';
import {
  Inter_400Regular as InterRegular,
  Inter_600SemiBold as InterSemiBold,
} from '@expo-google-fonts/inter';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemeProvider, STORAGE_KEY } from '@/context/ThemeContext';
import { NativeAuthProvider, useSession } from '@/context/NativeAuthContext';
import type { ThemeMode } from '@/constants/theme-tokens';

// Single authoritative auth guard — fires exactly once per session change,
// preventing the race condition that occurs when multiple layout <Redirect>
// components call router.replace() simultaneously.
function AuthGuard() {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (__DEV__) console.log(`[AUTH] Guard — session:${!!session} segment:${segments[0] ?? 'root'} inAuth:${inAuth}`);
    if (!session && !inAuth) {
      if (__DEV__) console.log('[AUTH] → router.replace /(auth)/login');
      router.replace('/(auth)/login');
    }
  }, [session, loading, segments]);

  return null;
}

SplashScreen.preventAutoHideAsync();
setBackgroundColorAsync('#0C0F18');

export default function RootLayout() {
  const [initialTheme, setInitialTheme] = useState<ThemeMode>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'Manrope-Black': ManropeBlack,
    'Manrope-ExtraBold': ManropeExtraBold,
    'Manrope-Bold': ManropeBold,
    'Manrope-SemiBold': ManropeSemiBold,
    'Manrope-Medium': ManropeMedium,
    'SpaceGrotesk-Bold': SpaceGroteskBold,
    'JetBrainsMono-SemiBold': JetbrainsMonoSemiBold,
    'Inter-Regular': InterRegular,
    'Inter-SemiBold': InterSemiBold,
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved === 'dark' || saved === 'light') setInitialTheme(saved);
      setThemeLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if ((!fontsLoaded && !fontError) || !themeLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0C0F18' }} />;
  }

  return (
    <NativeAuthProvider>
      <AuthGuard />
      <ThemeProvider initialMode={initialTheme}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(cm)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(resident)" />
          <Stack.Screen name="(coach)" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="messages" />
          <Stack.Screen name="my-reservations" />
          <Stack.Screen name="my-reports" />
          <Stack.Screen name="hoa-application" />
          <Stack.Screen name="amenity-book" />
          <Stack.Screen name="coach-profile/[id]" />
          <Stack.Screen name="my-coaching" />
          <Stack.Screen name="coach-favorites" />
          <Stack.Screen name="report-detail/[id]" />
          <Stack.Screen name="announcements" />
          <Stack.Screen name="survey-results/[id]" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="settings-notifications" />
          <Stack.Screen name="settings-privacy" />
          <Stack.Screen name="settings-account" />
          <Stack.Screen name="settings-help" />
        </Stack>
      </ThemeProvider>
    </NativeAuthProvider>
  );
}
