import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from './types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // @supabase/auth-js defaults to flowType 'implicit' when this is omitted —
    // it is NOT 'pkce' by default, despite that being a common assumption.
    // Implicit flow puts recovery tokens in a URL hash fragment
    // (#access_token=...), which reset-password.tsx's useLocalSearchParams()
    // can never see (fragments aren't sent to the router). PKCE puts them in
    // a real ?code= query param instead, which is what that screen expects.
    flowType: 'pkce',
  },
});
