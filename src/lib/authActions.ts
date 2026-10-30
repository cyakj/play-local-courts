import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { runSignOut, type SignOutResult } from '@/lib/signOutCore';

export function signOutAndReset(): Promise<SignOutResult> {
  return runSignOut({
    getUserId: async () => (await supabase.auth.getSession()).data.session?.user.id ?? null,
    // 'local' ends only this device's session.
    signOut: async () => (await supabase.auth.signOut({ scope: 'local' })).error,
    removeKeys: (keys) => AsyncStorage.multiRemove(keys),
    navigateToLogin: () => {
      // Drop any stacked protected screens so history cannot lead back into them, then land on login.
      try { if (router.canDismiss()) router.dismissAll(); } catch { /* nothing to dismiss */ }
      router.replace('/(auth)/login');
    },
  });
}

/**
 * react-native-web's Alert.alert() silently no-ops for multi-button confirm dialogs, so web signs out directly;
 * native keeps the real confirm dialog. Failures are reported through onError on every platform.
 */
export function confirmAndSignOut(onError: (message: string) => void) {
  async function perform() {
    const result = await signOutAndReset();
    if (!result.ok) {
      onError(result.message);
      if (Platform.OS !== 'web') Alert.alert('Sign out failed', result.message);
    }
  }

  if (Platform.OS === 'web') {
    void perform();
    return;
  }

  Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: () => void perform() },
  ]);
}
