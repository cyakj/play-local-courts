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
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ThemeProvider, STORAGE_KEY } from '@/context/ThemeContext';
import type { ThemeMode } from '@/constants/theme-tokens';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

SplashScreen.preventAutoHideAsync();
setBackgroundColorAsync('#0C0F18');

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [initialTheme, setInitialTheme] = useState<ThemeMode>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    // Existing Manrope weights
    'Manrope-Black': ManropeBlack,
    'Manrope-ExtraBold': ManropeExtraBold,
    'Manrope-Bold': ManropeBold,
    // New Manrope weights (body / UI)
    'Manrope-SemiBold': ManropeSemiBold,
    'Manrope-Medium': ManropeMedium,
    // New design system fonts
    'SpaceGrotesk-Bold': SpaceGroteskBold,
    'JetBrainsMono-SemiBold': JetbrainsMonoSemiBold,
    // Legacy Inter — kept so non-refactored screens don't break
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Redirect to login whenever session is cleared (sign-out or expiry)
  useEffect(() => {
    if (!authLoading && !session) {
      router.replace('/(auth)/login');
    }
  }, [session, authLoading]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authLoading]);

  if ((!fontsLoaded && !fontError) || authLoading || !themeLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#0C0F18' }} />;
  }

  return (
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
    </Stack>
    </ThemeProvider>
  );
}
