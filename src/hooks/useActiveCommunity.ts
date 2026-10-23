import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { createLatestGuard } from '@/lib/latestGuard';

export interface CommunityIdentity {
  hoaId: string;
  name: string;
  logoUrl: string | null;
}

interface Snapshot {
  loaded: boolean;
  active: CommunityIdentity | null;
  communities: CommunityIdentity[];
}

const ACTIVE_KEY = 'tenisx_active_hoa';

// Module-level store: every screen's Header reads the same state, so switching
// community updates all of them at once and tab changes never re-query.
let snapshot: Snapshot = { loaded: false, active: null, communities: [] };
let inflight: Promise<void> | null = null;
let boundUserId: string | null | undefined;
const listeners = new Set<() => void>();
// A load that was started for one account must never publish after the account changed or a newer load began.
const loadGuard = createLatestGuard();

function emit(next: Snapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

async function load(): Promise<void> {
  const isStale = loadGuard.begin();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (isStale()) return;
    const user = session?.user ?? null;
    boundUserId = user?.id ?? null;
    if (!user) {
      emit({ loaded: true, active: null, communities: [] });
      return;
    }

    const { data: memberships } = await supabase
      .from('hoa_memberships')
      .select('hoa_id, is_primary, last_active_at')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .order('is_primary', { ascending: false })
      .order('last_active_at', { ascending: false, nullsFirst: false });
    if (isStale()) return;

    const ids = [...new Set((memberships ?? []).map((m: any) => m.hoa_id as string))];
    if (ids.length === 0) {
      emit({ loaded: true, active: null, communities: [] });
      return;
    }

    const { data: hoas } = await supabase.from('hoas').select('id, name, logo_url').in('id', ids);
    if (isStale()) return;
    const byId = new Map((hoas ?? []).map((h: any) => [h.id as string, h]));
    const communities: CommunityIdentity[] = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((h: any) => ({ hoaId: h.id, name: h.name, logoUrl: h.logo_url ?? null }));

    let storedId: string | null = null;
    try { storedId = await AsyncStorage.getItem(`${ACTIVE_KEY}:${user.id}`); } catch { /* storage unavailable */ }
    if (isStale()) return;
    const active = communities.find((c) => c.hoaId === storedId) ?? communities[0] ?? null;
    emit({ loaded: true, active, communities });
  } catch {
    // A failed load only marks the store loaded; a superseded one must not touch the newer account's state.
    if (!isStale()) emit({ ...snapshot, loaded: true });
  }
}

export function refreshActiveCommunity(): Promise<void> {
  const run: Promise<void> = load().finally(() => { if (inflight === run) inflight = null; });
  inflight = run;
  return run;
}

function ensureLoaded() {
  if (!snapshot.loaded && !inflight) refreshActiveCommunity();
}

// A different user signing in (or out) must never inherit the previous identity.
supabase.auth.onAuthStateChange((_event, session) => {
  const nextId = session?.user?.id ?? null;
  if (boundUserId !== undefined && nextId === boundUserId) return;
  boundUserId = nextId;
  loadGuard.invalidate(); // any load still running for the previous account is now stale
  emit({ loaded: false, active: null, communities: [] });
  refreshActiveCommunity();
});

/** Switch the active community (must be one the user is an approved member of). */
export async function setActiveCommunity(hoaId: string): Promise<boolean> {
  const next = snapshot.communities.find((c) => c.hoaId === hoaId);
  if (!next) return false;
  emit({ ...snapshot, active: next });
  if (boundUserId) {
    try { await AsyncStorage.setItem(`${ACTIVE_KEY}:${boundUserId}`, hoaId); } catch { /* best effort */ }
  }
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const getSnapshot = () => snapshot;

export function useActiveCommunity() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { ensureLoaded(); }, []);
  const switchTo = useCallback((hoaId: string) => setActiveCommunity(hoaId), []);
  return {
    community: state.active,
    communities: state.communities,
    loading: !state.loaded,
    setActive: switchTo,
    refresh: refreshActiveCommunity,
  };
}
