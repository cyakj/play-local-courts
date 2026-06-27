import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const NativeAuthContext = createContext<AuthState>({ session: null, loading: true });

export function NativeAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Use INITIAL_SESSION event (Supabase v2 recommended pattern).
    // getSession() was removed because it has no error path: if it throws,
    // setLoading(false) never fires and the app hangs on a blank screen.
    // onAuthStateChange fires INITIAL_SESSION reliably even when offline
    // (it reads from AsyncStorage, not the network).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <NativeAuthContext.Provider value={{ session, loading }}>
      {children}
    </NativeAuthContext.Provider>
  );
}

export function useSession(): AuthState {
  return useContext(NativeAuthContext);
}
