// User-scoped keys written to device storage. Cleared on sign-out so the next person on this device starts clean.
export const USER_SCOPED_KEY_PREFIXES = ['tenisx_active_hoa:'];

export interface SignOutDeps {
  getUserId: () => Promise<string | null>;
  signOut: () => Promise<{ message: string } | null>;
  removeKeys: (keys: string[]) => Promise<void>;
  navigateToLogin: () => void;
}

export type SignOutResult = { ok: true } | { ok: false; message: string };

/** Ends the session, wipes user-scoped device state, then leaves the protected area. Never throws. */
export async function runSignOut(deps: SignOutDeps): Promise<SignOutResult> {
  let userId: string | null = null;
  try { userId = await deps.getUserId(); } catch { /* proceed with sign-out regardless */ }
  try {
    const error = await deps.signOut();
    if (error) return { ok: false, message: error.message };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Sign out failed. Please try again.' };
  }
  if (userId) {
    try { await deps.removeKeys(USER_SCOPED_KEY_PREFIXES.map((p) => `${p}${userId}`)); } catch { /* best effort */ }
  }
  deps.navigateToLogin();
  return { ok: true };
}

