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
import { Platform, View } from 'react-native';

import { ThemeProvider, STORAGE_KEY } from '@/context/ThemeContext';
import { NativeAuthProvider, useSession } from '@/context/NativeAuthContext';
import type { ThemeMode } from '@/constants/theme-tokens';

// Single authoritative auth guard — fires exactly once per session change,
// preventing the race condition that occurs when multiple layout <Redirect>
// components call router.replace() simultaneously.
function AuthGuard() {
  const { session, loading, isPasswordRecovery } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    // reset-password is a top-level route directory (src/app/reset-password/),
    // not nested under (auth) — see that group's _layout.tsx for why. This
    // covers both /reset-password (index) and /reset-password/confirm since
    // it only checks the first segment.
    const onResetPassword = segments[0] === 'reset-password';
    if (__DEV__) console.log(`[AUTH] Guard — session:${!!session} recovery:${isPasswordRecovery} segment:${segments[0] ?? 'root'} inAuth:${inAuth}`);

    // PASSWORD_RECOVERY always overrides normal navigation — a recovery
    // session must never be treated as "signed in", no matter where the
    // deep link lands the user (cold start, or already inside the app).
    if (isPasswordRecovery && !onResetPassword) {
      if (__DEV__) console.log('[AUTH] recovery session → router.replace /reset-password');
      router.replace('/reset-password');
      return;
    }

    // reset-password must be reachable with no session at all — that's the
    // normal state for an anonymous recovery link, including one whose
    // exchange just failed (invalid/expired code). Without this exemption,
    // an anonymous user here gets bounced to /login, which then immediately
    // bounces back here because isPasswordRecovery is still true from
    // markPasswordRecovery() — an infinite redirect loop between the two
    // routes (React's "Maximum update depth exceeded").
    if (!session && !inAuth && !onResetPassword) {
      if (__DEV__) console.log('[AUTH] → router.replace /(auth)/login');
      router.replace('/(auth)/login');
    }
  }, [session, loading, isPasswordRecovery, segments]);

  return null;
}

SplashScreen.preventAutoHideAsync();
setBackgroundColorAsync('#0C0F18');

// Global web-only focus style: browsers default text inputs to an orange/
// yellow outline (and Chrome autofill paints a yellow background) — neither
// matches the app's dark UI. Replace with a neutral resting border (each
// screen already sets its own via theme.border) and a TenisX-blue ring on
// keyboard focus, applied once for every <input>/<textarea> app-wide since
// there's no single shared Input component to patch instead.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('tenisx-global-focus-style')) {
  const style = document.createElement('style');
  style.id = 'tenisx-global-focus-style';
  style.textContent = `
    input, textarea, select { outline: none; }
    input:focus, textarea:focus, select:focus { outline: none; }
    input:focus-visible, textarea:focus-visible, select:focus-visible {
      outline: 2px solid #2D6BFF;
      outline-offset: 1px;
    }
    input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus,
    textarea:-webkit-autofill, textarea:-webkit-autofill:hover, textarea:-webkit-autofill:focus {
      -webkit-text-fill-color: #F5F8FF;
      -webkit-box-shadow: 0 0 0px 1000px #161A26 inset;
      box-shadow: 0 0 0px 1000px #161A26 inset;
      transition: background-color 9999s ease-in-out 0s;
    }
  `;
  document.head.appendChild(style);
}

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
          <Stack.Screen name="reset-password/index" />
          <Stack.Screen name="reset-password/confirm" />
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
          <Stack.Screen name="settings-change-password" />
          <Stack.Screen name="settings-help" />
        </Stack>
      </ThemeProvider>
    </NativeAuthProvider>
  );
}
