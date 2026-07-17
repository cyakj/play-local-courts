import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
  // True from the moment a recovery deep link is being exchanged for a session
  // until the user signs out. Navigation guards must treat this as an override
  // of normal "session exists -> go to authenticated area" routing, or the
  // recovery session silently drops the user onto Home instead of reset-password.
  isPasswordRecovery: boolean;
  // Called by reset-password.tsx the instant it recognizes recovery-shaped
  // link params, BEFORE it awaits the session exchange. We can't rely solely
  // on the SDK's PASSWORD_RECOVERY event: exchangeCodeForSession only emits it
  // for the PKCE flow — the implicit-flow fallback (setSession with
  // access_token/refresh_token) emits plain SIGNED_IN, which would otherwise
  // read as a normal login and bounce the user to Home before they can set a
  // new password.
  markPasswordRecovery: () => void;
  // Called when the user explicitly cancels out of recovery (e.g. "Back to
  // login" on an invalid/expired link) or the exchange itself fails. Without
  // this, isPasswordRecovery stays stuck true — since it's normally only
  // cleared by a SIGNED_OUT event, which never fires for a link whose
  // exchange failed (no session was ever created to sign out of) — and the
  // root AuthGuard's recovery-override redirect fights every navigation
  // attempt away from /reset-password, including "Back to login" itself.
  clearPasswordRecovery: () => void;
}

const noop = () => {};

const NativeAuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  isPasswordRecovery: false,
  markPasswordRecovery: noop,
  clearPasswordRecovery: noop,
});

export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Use INITIAL_SESSION event (Supabase v2 recommended pattern).
    // getSession() was removed because it has no error path: if it throws,
    // setLoading(false) never fires and the app hangs on a blank screen.
    // onAuthStateChange fires INITIAL_SESSION reliably even when offline
    // (it reads from AsyncStorage, not the network).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (__DEV__) console.log(`[AUTH] event=${event} session=${s ? 'present' : 'null'}`);
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
      }
      if (event === 'INITIAL_SESSION') {
        setLoading(false);
        if (__DEV__) console.log('[AUTH] INITIAL_SESSION → loading=false');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const markPasswordRecovery = () => setIsPasswordRecovery(true);
  const clearPasswordRecovery = () => setIsPasswordRecovery(false);

  return (
    <NativeAuthContext.Provider value={{ session, loading, isPasswordRecovery, markPasswordRecovery, clearPasswordRecovery }}>
      {children}
    </NativeAuthContext.Provider>
  );
}

export function useSession(): AuthState {
  return useContext(NativeAuthContext);
}
