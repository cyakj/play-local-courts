import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { supabase } from '@/lib/supabase';
import { db } from '@/lib/untypedDb';
import { createLatestGuard } from '@/lib/latestGuard';
import {
  PROFILE_PHOTO_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  classifyAvatarValue,
  initialsFor,
} from '@/lib/profilePhoto';

// Module-level store (same pattern as useActiveCommunity): the header, the account menu, Me and Edit Profile all show
// the same name/photo, and a photo change or an account switch updates every one of them at once.

export interface ProfileIdentity {
  userId: string | null;
  fullName: string;
  initials: string;
  /** Renderable image URL (signed, or a legacy public URL); null when there is no photo or it could not be loaded. */
  photoUrl: string | null;
}

interface Snapshot extends ProfileIdentity {
  loaded: boolean;
  /** When the signed photo URL stops working (ms since epoch); 0 when there is no signed URL. */
  expiresAt: number;
}

const EMPTY: Snapshot = { loaded: false, userId: null, fullName: '', initials: '', photoUrl: null, expiresAt: 0 };
let snapshot: Snapshot = EMPTY;
let inflight: Promise<void> | null = null;
let boundUserId: string | null | undefined;
const listeners = new Set<() => void>();
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
    if (!user) { emit({ ...EMPTY, loaded: true }); return; }

    const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle();
    if (isStale()) return;
    const fullName = (data?.full_name as string | null) ?? '';

    // The private photo path is in its own column (migration 20261030120000). Selected separately so a server that
    // does not have the column yet still loads the name and legacy avatar instead of failing the whole profile read.
    const pathRes = await db.from('profiles').select('avatar_path').eq('id', user.id).maybeSingle();
    if (isStale()) return;
    const storagePath = !pathRes.error ? ((pathRes.data?.avatar_path as string | null) ?? null) : null;

    let photoUrl: string | null = null;
    let expiresAt = 0;
    if (storagePath) {
      const { data: signed } = await supabase.storage.from(PROFILE_PHOTO_BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      if (isStale()) return;
      photoUrl = signed?.signedUrl ?? null; // a missing object/bucket degrades to initials
      expiresAt = photoUrl ? Date.now() + SIGNED_URL_TTL_SECONDS * 1000 : 0;
    } else {
      const legacy = classifyAvatarValue(data?.avatar_url as string | null);
      if (legacy.kind === 'legacy-url') photoUrl = legacy.url;
    }
    emit({ loaded: true, userId: user.id, fullName, initials: initialsFor(fullName), photoUrl, expiresAt });
  } catch {
    if (!isStale()) emit({ ...snapshot, loaded: true });
  }
}

export function refreshProfileIdentity(): Promise<void> {
  const run: Promise<void> = load().finally(() => { if (inflight === run) inflight = null; });
  inflight = run;
  return run;
}

// Refresh a minute before the signed URL expires so a long-lived session never keeps a dead image URL.
const EXPIRY_MARGIN_MS = 60 * 1000;

function ensureLoaded() {
  if (inflight) return;
  if (!snapshot.loaded || (snapshot.expiresAt > 0 && snapshot.expiresAt - EXPIRY_MARGIN_MS < Date.now())) refreshProfileIdentity();
}

// A different account (or sign-out) must never inherit the previous person's name or photo.
supabase.auth.onAuthStateChange((_event, session) => {
  const nextId = session?.user?.id ?? null;
  if (boundUserId !== undefined && nextId === boundUserId) return;
  boundUserId = nextId;
  loadGuard.invalidate();
  emit(EMPTY);
  refreshProfileIdentity();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
const getSnapshot = () => snapshot;

export function useProfileIdentity(): ProfileIdentity & { loading: boolean; refresh: () => Promise<void> } {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => { ensureLoaded(); }, []);
  const refresh = useCallback(() => refreshProfileIdentity(), []);
  return { userId: s.userId, fullName: s.fullName, initials: s.initials, photoUrl: s.photoUrl, loading: !s.loaded, refresh };
}
