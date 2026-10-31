// V1 HOA notification preferences (V1-008). Pure: no React / Supabase.
//
// Only categories whose DELIVERY path actually reads the preference are shown as switches. Verified against the
// code that sends them:
//   * supabase/functions/send-booking-email  reads email_preferences.booking_confirmations (confirmations),
//     .cancellation_notifications (changes + cancellations) and .booking_reminders (reminders)
//   * supabase/functions/send-scheduled-reminders reads email_preferences.booking_reminders
// HOA messages are NOT a switch: the community messaging screen only inserts into public.messages and never calls
// send-message-notification (that function is used by the tennis messages screen), so no email is sent for them.
// In-app notifications (hoa_notifications) for announcements, maintenance updates, membership decisions and events are
// created without consulting any preference, so they are listed as "always on", NOT as switches. Push delivery does not
// exist (no expo-notifications / APNs registration in this build) and is not claimed anywhere.

export type PrefStore = 'email_preferences';

export interface NotificationToggle {
  key: 'reservation_confirmations' | 'reservation_changes' | 'reservation_reminders';
  label: string;
  desc: string;
  store: PrefStore;
  /** Column in email_preferences. */
  column: string;
  channel: 'Email';
}

export const NOTIFICATION_TOGGLES: NotificationToggle[] = [
  { key: 'reservation_confirmations', label: 'Reservation confirmations', desc: 'Email when a reservation is confirmed',
    store: 'email_preferences', column: 'booking_confirmations', channel: 'Email' },
  { key: 'reservation_changes', label: 'Reservation changes & cancellations', desc: 'Email when a reservation is changed, cancelled or declined',
    store: 'email_preferences', column: 'cancellation_notifications', channel: 'Email' },
  { key: 'reservation_reminders', label: 'Reservation reminders', desc: 'Email reminder before your reservation',
    store: 'email_preferences', column: 'booking_reminders', channel: 'Email' },
];

export type ToggleKey = NotificationToggle['key'];
export type ToggleState = Record<ToggleKey, boolean>;

export const DEFAULT_TOGGLES: ToggleState = {
  reservation_confirmations: true,
  reservation_changes: true,
  reservation_reminders: true,
};

/** Shown in the app's Notifications list and not switchable yet; honest about why. */
export const ALWAYS_ON_IN_APP: { label: string; desc: string }[] = [
  { label: 'Messages from HOA management', desc: 'Shown in your Messages inbox. Email alerts for messages are not available yet' },
  { label: 'HOA announcements', desc: 'Appear in your Notifications list' },
  { label: 'Maintenance report updates', desc: 'When the status of a report you filed changes' },
  { label: 'Membership approvals and updates', desc: 'When your community membership is approved or declined' },
  { label: 'Community events & meeting reminders', desc: 'When events are published or about to start' },
];

export const ESSENTIAL_NOTE = 'Account and security emails (verification, password reset) are always sent and cannot be turned off.';
export const PUSH_NOTE = 'Push notifications are not available in this version of the app. The settings above control email only.';

export interface PrefChange { store: PrefStore; column: string; value: boolean; key: ToggleKey }

/**
 * update_email_preference returns true only when a row was updated (false when none was). Anything else - an error, false,
 * null or a missing result - is a failed save, so a missing row can never be reported as "Saved".
 */
export function updateSucceeded(res: { data: unknown; error: unknown }): boolean {
  return !res.error && res.data === true;
}

/** The minimal set of writes needed to turn `saved` into `next`. */
export function diffToggles(saved: ToggleState, next: ToggleState): PrefChange[] {
  return NOTIFICATION_TOGGLES
    .filter((t) => saved[t.key] !== next[t.key])
    .map((t) => ({ store: t.store, column: t.column, value: next[t.key], key: t.key }));
}

/** Read the toggles out of the email_preferences row; anything missing defaults to ON (the senders' own default). */
export function readToggles(email: Record<string, unknown> | null | undefined): ToggleState {
  const out = { ...DEFAULT_TOGGLES };
  for (const t of NOTIFICATION_TOGGLES) {
    const v = email?.[t.column];
    if (typeof v === 'boolean') out[t.key] = v;
  }
  return out;
}
