import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';

let signOutPromise: Promise<void> | null = null;

export function signOutAndReset(): Promise<void> {
  if (signOutPromise) return signOutPromise;

  signOutPromise = (async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (session) throw new Error('Your session could not be cleared. Please try again.');

    if (router.canDismiss()) router.dismissAll();
    router.replace('/(auth)/login');
  })().finally(() => {
    signOutPromise = null;
  });

  return signOutPromise;
}
