import { db } from '@/lib/untypedDb';
import { type PrefChange, type ToggleState, diffToggles, readToggles } from '@/lib/notificationPrefs';

// email_preferences is read/written through the same RPCs the rest of the product uses. get/create refuse a caller
// asking about someone else (migration 20261023140000); update_email_preference exists on the hosted database only.

export interface LoadedToggles {
  toggles: ToggleState;
  /** False when the user has no email_preferences row yet (a brand-new account). */
  rowExists: boolean;
}

/**
 * Read-only. A failed read THROWS so the screen can show an error and keep editing disabled (it must never present
 * guessed defaults as the saved values). A genuinely absent row yields the senders' defaults; the row is only created
 * by an explicit save.
 */
export async function loadToggles(userId: string): Promise<LoadedToggles> {
  const got = await db.rpc('get_email_preferences', { target_user_id: userId });
  if (got.error) throw new Error(got.error.message);
  const row = Array.isArray(got.data) && got.data[0] ? (got.data[0] as Record<string, unknown>) : null;
  return { toggles: readToggles(row), rowExists: !!row };
}

export type SaveResult = { ok: true } | { ok: false; failed: PrefChange[] };

/** Applies only what changed; reports exactly which writes failed so the screen never claims a false success. */
export async function saveToggles(userId: string, saved: ToggleState, next: ToggleState, rowExists: boolean): Promise<SaveResult> {
  const changes = diffToggles(saved, next);
  if (changes.length === 0) return { ok: true };
  if (!rowExists) {
    // First explicit save for this account: create the default row, then apply the change on top of it.
    const created = await db.rpc('create_default_email_preferences', { target_user_id: userId });
    if (created.error) return { ok: false, failed: changes };
  }
  const failed: PrefChange[] = [];
  for (const change of changes) {
    const { error } = await db.rpc('update_email_preference', {
      target_user_id: userId, preference_key: change.column, preference_value: change.value,
    });
    if (error) failed.push(change);
  }
  return failed.length === 0 ? { ok: true } : { ok: false, failed };
}
