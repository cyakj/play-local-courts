import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * react-native-web's Alert.alert() silently no-ops for multi-button confirm
 * dialogs — tapping Sign Out on web did nothing at all, with no error, no
 * confirm prompt, and no sign-out. Skip the confirm step on web and sign out
 * directly; native platforms keep the real confirm dialog.
 */
export function confirmAndSignOut(onError: (message: string) => void) {
  async function performSignOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) onError(error.message);
  }

  if (Platform.OS === 'web') {
    void performSignOut();
    return;
  }

  Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign Out', style: 'destructive', onPress: performSignOut },
  ]);
}
