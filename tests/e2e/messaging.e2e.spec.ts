/**
 * HOA messaging end to end, in two real browser sessions at once:
 *   resident (saved session)  <->  HOA administrator (TEST_ADMIN_* sign-in)
 *
 * Covers: resident sends to HOA, HOA receives (tab badge + unread), HOA replies, resident receives the reply
 * WITHOUT reloading (realtime), read receipt, history persists across reload.
 *
 * No email/SMS/push: the community messaging code never invokes an edge function.
 * Requires migration 20261013120000 for the contact picker (my_message_contacts); see the note on the picker test.
 */
import { test, expect } from '@playwright/test';
import { STATE, contextFor, hasState, runTag, signInAdmin } from './helpers';

test.describe.configure({ mode: 'serial' });

test.skip(!hasState(STATE.resident) || !process.env.TEST_ADMIN_EMAIL, 'needs the resident session file and TEST_ADMIN_* in .env');

test('resident -> HOA -> reply, with unread badge, realtime delivery, read receipt and persistence', async ({ browser }) => {
  const tag = runTag();
  const toHoa = `${tag} question from resident`;
  const reply = `${tag} reply from HOA`;

  // --- resident opens a conversation with a community administrator and sends a message
  const residentCtx = await contextFor(browser, STATE.resident);
  const resident = await residentCtx.newPage();
  await resident.goto('/messages', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await expect(resident.getByTestId('messages-list')).toBeVisible({ timeout: 90000 });

  await resident.getByTestId('new-message').click();
  await expect(resident.getByTestId('messages-picker')).toBeVisible();
  const firstContact = resident.locator('[aria-label^="Message "]').first();
  await expect(firstContact, 'the resident must see at least one community administrator').toBeVisible({ timeout: 30000 });
  await firstContact.click();

  await resident.getByTestId('message-input').fill(toHoa);
  await resident.getByTestId('message-send').click();
  await expect(resident.getByText(toHoa)).toBeVisible();
  await expect(resident.getByText('Sent')).toBeVisible();

  // --- HOA admin signs in separately and sees the unread badge, then the message
  const adminCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const admin = await adminCtx.newPage();
  await signInAdmin(admin);
  const tab = admin.getByTestId('tab-messages');
  await expect(tab).toBeVisible({ timeout: 60000 });
  await expect(tab).toHaveAttribute('aria-label', /unread/, { timeout: 30000 });
  await tab.click();
  await expect(admin.getByTestId('messages-list')).toBeVisible();
  await admin.getByText(toHoa).first().click();
  await expect(admin.getByTestId('messages-thread')).toBeVisible();
  await expect(admin.getByText(toHoa)).toBeVisible();

  // --- the resident's message is marked read in realtime (no reload)
  await expect(resident.getByText('Read')).toBeVisible({ timeout: 30000 });

  // --- HOA replies; the resident receives it live, without reloading
  await admin.getByTestId('message-input').fill(reply);
  await admin.getByTestId('message-send').click();
  await expect(admin.getByText(reply)).toBeVisible();
  await expect(resident.getByText(reply)).toBeVisible({ timeout: 30000 });

  // --- history persists: reload the resident and reopen the conversation
  await resident.reload({ waitUntil: 'domcontentloaded' });
  await expect(resident.getByTestId('messages-list')).toBeVisible({ timeout: 90000 });
  await resident.getByText(reply).first().click();
  await expect(resident.getByText(toHoa)).toBeVisible();
  await expect(resident.getByText(reply)).toBeVisible();

  await residentCtx.close();
  await adminCtx.close();
});

test('timestamps and day separators are shown on messages', async ({ browser }) => {
  const ctx = await contextFor(browser, STATE.resident);
  const page = await ctx.newPage();
  await page.goto('/messages', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await expect(page.getByTestId('messages-list')).toBeVisible({ timeout: 90000 });
  await page.locator('[data-testid^="conversation-"]').first().click();
  await expect(page.getByTestId('messages-thread')).toBeVisible();
  await expect(page.getByText(/^(Today|Yesterday|\w+day, \w+ \d+)$/).first()).toBeVisible();
  await expect(page.getByText(/\d{1,2}:\d{2}\s?(AM|PM)/i).first()).toBeVisible();
  await ctx.close();
});
