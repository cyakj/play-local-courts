import {
  Manrope_800ExtraBold as ManropeBlack,
  Manrope_800ExtraBold as ManropeExtraBold,
  Manrope_700Bold as ManropeBold,
} from '@expo-google-fonts/manrope';
import {
  Inter_400Regular as InterRegular,
  Inter_600SemiBold as InterSemiBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

SplashScreen.preventAutoHideAsync();
setBackgroundColorAsync('#F9FAFB');

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [fontsLoaded, fontError] = useFonts({
    'Manrope-Black': ManropeBlack,
    'Manrope-ExtraBold': ManropeExtraBold,
    'Manrope-Bold': ManropeBold,
    'Inter-Regular': InterRegular,
    'Inter-SemiBold': InterSemiBold,
  });

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

  useEffect(() => {
    if ((fontsLoaded || fontError) && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, authLoading]);

  if ((!fontsLoaded && !fontError) || authLoading) {
    return <View style={{ flex: 1, backgroundColor: '#F9FAFB' }} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F9FAFB' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(cm)" />
      <Stack.Screen name="(admin)" />
      <Stack.Screen name="(resident)" />
    </Stack>
  );
}
