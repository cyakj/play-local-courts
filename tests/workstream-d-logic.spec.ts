/**
 * Workstream D (V1-006 messaging, V1-007 privacy, V1-008 notifications, V1-009 account).
 * Node only:  npx playwright test -c playwright.logic.config.ts workstream-d-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  ALWAYS_ON_IN_APP, DEFAULT_TOGGLES, NOTIFICATION_TOGGLES, PUSH_NOTE, diffToggles, readToggles,
} from '../src/lib/notificationPrefs';
import { checkNewEmail, checkPhone } from '../src/lib/accountSettings';
import { contactsForActiveCommunity } from '../src/lib/messagingScope';
import { PRIVACY_FACTS } from '../src/lib/privacyInfo';

const src = (p: string) => readFileSync(`src/${p}`, 'utf8');
const fn = (p: string) => readFileSync(`supabase/functions/${p}`, 'utf8');

test.describe('V1-008 notifications: only switches whose delivery path honors them', () => {
  test('every switch maps to a preference the sending code really checks', () => {
    const booking = fn('send-booking-email/index.ts');
    const reminders = fn('send-scheduled-reminders/index.ts');
    expect(NOTIFICATION_TOGGLES.map((t) => t.column)).toEqual(['booking_confirmations', 'cancellation_notifications', 'booking_reminders']);
    for (const t of NOTIFICATION_TOGGLES) expect(booking, t.column).toMatch(new RegExp(`preferences\\.${t.column}`));
    expect(reminders).toMatch(/email_preferences/);
  });
  test('D-004: HOA messages are not a switch because the community messaging screen never triggers an email', () => {
    expect(NOTIFICATION_TOGGLES.some((t) => /message/i.test(t.label))).toBe(false);
    const cm = src('components/messaging/CommunityMessages.tsx');
    expect(cm).not.toMatch(/send-message-notification|functions\.invoke/);
    expect(ALWAYS_ON_IN_APP[0].label).toBe('Messages from HOA management');
    expect(ALWAYS_ON_IN_APP[0].desc).toMatch(/not available yet/);
  });
  test('legacy tennis categories are gone', () => {
    const labels = NOTIFICATION_TOGGLES.map((t) => t.label.toLowerCase()).join('|');
    for (const gone of ['match', 'lesson', 'coach']) expect(labels).not.toContain(gone);
    const screen = src('app/settings-notifications.tsx');
    for (const gone of ['match_invitations', 'lesson_reminders', 'coach_messages', 'Match Invitations', 'Lesson Reminders', 'Coach Messages']) {
      expect(screen).not.toContain(gone);
    }
  });
  test('categories without a preference-aware delivery path are NOT switches and push is not claimed', () => {
    expect(ALWAYS_ON_IN_APP.map((x) => x.label)).toEqual([
      'Messages from HOA management', 'HOA announcements', 'Maintenance report updates', 'Membership approvals and updates', 'Community events & meeting reminders',
    ]);
    expect(PUSH_NOTE).toMatch(/not available/i);
    const screen = src('app/settings-notifications.tsx');
    expect((screen.match(/<Switch/g) ?? []).length).toBe(1); // one Switch inside the NOTIFICATION_TOGGLES map
    expect(screen).toMatch(/NOTIFICATION_TOGGLES\.map/);
    expect(screen).toContain('testID="notif-essential-note"');
  });
  test('persistence: only changed values are written', () => {
    const next = { ...DEFAULT_TOGGLES, reservation_reminders: false };
    expect(diffToggles(DEFAULT_TOGGLES, DEFAULT_TOGGLES)).toEqual([]);
    expect(diffToggles(DEFAULT_TOGGLES, next)).toEqual([
      { store: 'email_preferences', column: 'booking_reminders', value: false, key: 'reservation_reminders' },
    ]);
  });
  test('reading: stored booleans win, anything missing defaults to on (the senders default to send)', () => {
    expect(readToggles({ booking_confirmations: false, booking_reminders: true })).toEqual({
      reservation_confirmations: false, reservation_changes: true, reservation_reminders: true,
    });
    expect(readToggles(null)).toEqual(DEFAULT_TOGGLES);
    expect(readToggles({ booking_confirmations: 'no' })).toEqual(DEFAULT_TOGGLES);
  });
  test('D-001/D-002: loading is read-only and strict; a row is created only by an explicit save', () => {
    const api = src('lib/notificationPrefsApi.ts');
    const load = api.slice(api.indexOf('export async function loadToggles'), api.indexOf('export type SaveResult'));
    expect(load).not.toMatch(/create_default_email_preferences/);
    expect(load).toMatch(/if \(got\.error\) throw new Error/);
    const save = api.slice(api.indexOf('export async function saveToggles'));
    expect(save.indexOf('create_default_email_preferences')).toBeGreaterThan(save.indexOf('if (!rowExists)'));
    expect(src('app/settings-notifications.tsx')).toMatch(/setLoadError\(true\)/);
  });
  test('save never claims success on a partial failure (failed values snap back to what is stored)', () => {
    const screen = src('app/settings-notifications.tsx');
    expect(screen).toMatch(/if \(!result\.ok\) \{/);
    expect(screen).toMatch(/reverted\[f\.key\] = saved\[f\.key\]/);
    const api = src('lib/notificationPrefsApi.ts');
    expect(api).toMatch(/failed\.push\(change\)/);
    expect(api).toMatch(/return failed\.length === 0 \? \{ ok: true, rowCreated \} : \{ ok: false, failed, rowCreated \}/);
    expect(api).toMatch(/rpc\('update_email_preference'/);
    expect(api).not.toMatch(/notification_preferences/); // no read-modify-write of the shared JSON column
  });
});

test.describe('V1-007 privacy: no decorative or unenforced controls', () => {
  const screen = src('app/settings-privacy.tsx');
  test('the legacy tennis toggles are removed from the screen', () => {
    expect(screen).not.toMatch(/<Switch/);
    for (const gone of ['Show Location', 'Activity Status', 'Exact Distance', 'Hide Contact Until Match', 'location_visible', 'show_exact_distance', 'show_activity_status', 'hide_contact_until_confirmed']) {
      expect(screen).not.toContain(gone);
    }
    expect(screen).not.toMatch(/\.update\(/); // nothing to persist
  });
  test('the statements shown are limited to what is verifiably true, and make no enforcement promise', () => {
    const text = PRIVACY_FACTS.map((f) => `${f.title} ${f.body}`).join(' ');
    expect(text).toMatch(/administrators/i);
    expect(text).toMatch(/no resident directory/i);
    expect(text).not.toMatch(/\b(encrypt|guarantee|never shared|anonymous|hidden from)\b/i);
    expect(screen).toContain('PRIVACY_PLANNED_NOTE');
    expect(screen).toContain("'/legal/privacy'");
    expect(screen).toContain("'/legal/terms'");
  });
  test('Edit Profile no longer shows the unenforced Profile Visibility / Home Location controls outside Tennis mode', () => {
    const e = src('app/edit-profile.tsx');
    const i = e.indexOf('PROFILE VISIBILITY');
    expect(e.slice(e.lastIndexOf('{isTennisMode && (', i), i)).toContain('isTennisMode');
  });
  test('Settings describes Privacy truthfully', () => {
    expect(src('app/settings.tsx')).not.toContain('Profile visibility settings');
  });
});

test.describe('V1-009 account settings', () => {
  test('email validation', () => {
    expect(checkNewEmail('  New@Example.com ', 'old@example.com')).toEqual({ ok: true, email: 'new@example.com' });
    expect(checkNewEmail('', null)).toMatchObject({ ok: false });
    expect(checkNewEmail('not-an-email', null)).toMatchObject({ ok: false });
    expect(checkNewEmail('OLD@example.com', 'old@example.com')).toMatchObject({ ok: false });
  });
  test('phone validation keeps digits and a leading plus; empty clears', () => {
    expect(checkPhone('(787) 555-1234')).toEqual({ ok: true, phone: '7875551234' });
    expect(checkPhone('+1 787 555 1234')).toEqual({ ok: true, phone: '+17875551234' });
    expect(checkPhone('')).toEqual({ ok: true, phone: null });
    expect(checkPhone('12')).toMatchObject({ ok: false });
    expect(checkPhone('call me')).toMatchObject({ ok: false });
    expect(checkPhone('1'.repeat(16))).toMatchObject({ ok: false });
  });
  test('email change reuses Supabase Auth (no second identity system); phone writes only the own profile row', () => {
    const a = src('app/settings-account.tsx');
    expect(a).toMatch(/supabase\.auth\.updateUser\(\{ email: check\.email \}\)/);
    expect(a).toMatch(/from\('profiles'\)\.update\(\{ phone_number: check\.phone \}\)\.eq\('id', session!\.user\.id\)/);
    expect(a).not.toMatch(/signUp|admin\.createUser|auth\.admin/);
  });
  test('password change and reset already exist and are reachable', () => {
    expect(src('app/settings-account.tsx')).toContain("'/settings-change-password'");
    expect(src('app/settings-change-password.tsx')).toMatch(/resetPasswordForEmail/);
    expect(src('app/(auth)/login.tsx')).toMatch(/resetPasswordForEmail/);
  });
  test('privacy policy and terms are reachable from Account', () => {
    const a = src('app/settings-account.tsx');
    expect(a).toContain("'/legal/privacy'");
    expect(a).toContain("'/legal/terms'");
  });
  test('account deletion is a REQUEST to support, never an in-app destructive action', () => {
    const a = src('app/settings-account.tsx');
    expect(a).toMatch(/openSupportEmail\('Account deletion request'\)/);
    expect(a).not.toMatch(/deleteUser|\.delete\(\)|auth\.admin|rpc\('delete/);
    expect(src('lib/accountSettings.ts')).toMatch(/reservation history, HOA membership and records/);
  });
  test('sign out is still the shared helper', () => {
    expect(src('app/settings-account.tsx')).toMatch(/confirmAndSignOut\(setSignOutError\)/);
  });
});

test.describe('V1-006 resident-to-administrator messaging', () => {
  const contacts = [
    { user_id: 'a1', hoa_id: 'A', contact_is_admin: true },
    { user_id: 'b1', hoa_id: 'B', contact_is_admin: true },
    { user_id: 'r1', hoa_id: 'A', contact_is_admin: false },
  ];
  test('a resident is offered only administrators of the ACTIVE community; never other residents', () => {
    expect(contactsForActiveCommunity(contacts, 'resident', 'A').map((c) => c.user_id)).toEqual(['a1']);
    expect(contactsForActiveCommunity(contacts, 'resident', 'B').map((c) => c.user_id)).toEqual(['b1']);
    expect(contactsForActiveCommunity(contacts, 'resident', null)).toEqual([]);
    expect(contactsForActiveCommunity(contacts, 'resident', 'C')).toEqual([]);
  });
  test('managers keep their member list (the server enforces it)', () => {
    expect(contactsForActiveCommunity(contacts, 'admin', 'A')).toHaveLength(3);
  });
  test('the messages screen applies the scope, handles load/send/thread errors, and prefers the server contact list', () => {
    const m = src('components/messaging/CommunityMessages.tsx');
    expect(m).toMatch(/contactsForActiveCommunity\(allContacts, role, activeCommunity\?\.hoaId\)/);
    // D-003: eligibility also covers existing conversations, deep links and send; community change clears thread + draft
    expect(m).toMatch(/const visibleConversations = conversations\.filter\(\(c\) => canMessage\(c\.partnerId\)\)/);
    expect(m).toMatch(/if \(!canMessage\(active\.partnerId\)\) \{\s*setSendError\('You can only message administrators of your active community\.'\);/);
    expect(m).toMatch(/if \(role !== 'admin' && !contact\) return;/);
    expect(m).toMatch(/threadGen\.current \+= 1;\s*setActive\(null\);\s*setThread\(\[\]\);\s*setDraft\(''\);/);
    expect(m).toMatch(/if \(gen !== threadGen\.current\) return;/);
    for (const state of ['loadError', 'threadError', 'sendError']) expect(m).toContain(state);
    expect(m).toMatch(/rpc\('my_message_contacts'/);
  });
  test('Me labels the entry "Message my community" in Community mode and there is no resident-to-resident entry point', () => {
    expect(src('app/(resident)/me.tsx')).toMatch(/isCommunityMode \? 'Message my community' : 'Messages'/);
    const mig = readFileSync('supabase/migrations/20261013120000_platform_approval_and_secure_messaging.sql', 'utf8');
    expect(mig).toMatch(/CREATE POLICY "Users can send messages" ON public\.messages/);
  });
});

test.describe('inspection round 2 regressions (D-REVIEW-001/002)', () => {
  test('D-REVIEW-001: a send that finishes after the thread/community changed cannot touch the current thread or draft', () => {
    const m = src('components/messaging/CommunityMessages.tsx');
    const send = m.slice(m.indexOf('async function send()'), m.indexOf('function back()'));
    expect(send).toMatch(/const sendGen = threadGen\.current;\s*const recipient = active\.partnerId;/);
    expect(send).toMatch(/receiver_id: recipient/);
    const guard = send.indexOf('sendGen !== threadGen.current || activeRef.current?.partnerId !== recipient');
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(send.indexOf("setThread((prev)"));
    expect(guard).toBeLessThan(send.indexOf("setDraft('')"));
    expect(guard).toBeLessThan(send.indexOf('Your message was not sent'));
  });
  test('D-REVIEW-002: switches are frozen while saving so no edit can be lost to the submitted snapshot', () => {
    expect(src('app/settings-notifications.tsx')).toMatch(/disabled=\{loading \|\| loadError \|\| !userId \|\| saving\}/);
  });
});

test.describe('fresh-inspection follow-ups (D)', () => {
  test('D-101: a created preferences row is remembered even when a later update fails', () => {
    expect(src('lib/notificationPrefsApi.ts')).toMatch(/rowCreated = true;/);
    expect(src('app/settings-notifications.tsx')).toMatch(/if \(result\.rowCreated\) setRowExists\(true\);/);
  });
  test('D-102: a failed administrator lookup is shown as an error, never as an empty inbox', () => {
    const m = src('components/messaging/CommunityMessages.tsx');
    expect(m).toMatch(/if \(hoasError\) throw hoasError;/);
    expect(m).toMatch(/setContactsFailed\(true\)/);
    expect(m).toMatch(/Could not load your community administrators/);
  });
  test('D-103: the location disclosure says it is sent to the weather service (and for what)', () => {
    const loc = PRIVACY_FACTS.find((f) => f.title === 'Location')!;
    expect(loc.body).toMatch(/sent to the weather service/);
    expect(loc.body).not.toMatch(/not shared\./);
  });
  test('proposed report-insert policy requires an approved membership and a matching amenity (not applied)', () => {
    const m = readFileSync('supabase/migrations/20261030130000_report_insert_requires_membership.sql', 'utf8');
    expect(m).toMatch(/NOT APPLIED/);
    expect(m).toMatch(/m\.status = 'approved'/);
    expect(m).toMatch(/c\.hoa_id = maintenance_reports\.hoa_id/);
    expect(m).toMatch(/auth\.uid\(\) = reporter_id/);
  });
});
