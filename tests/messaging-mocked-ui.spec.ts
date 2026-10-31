import { test, expect, type Page } from '@playwright/test';
import { blockHostedWrites } from './helpers/hostedWriteGuard';

/**
 * Resident -> HOA administrator messaging in a real browser against a MOCKED backend. The contact list, history and the
 * outgoing message are all local (the POST is captured, never sent), so nothing is written to hosted. Proves the UI journey:
 * administrator discovery, starting a conversation, sending, history, and the error state. It does not prove the live RLS.
 */
const ADMIN = '55555555-5555-4555-8555-555555555555';
const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function setup(page: Page, opts: { contacts?: unknown[]; history?: unknown[] | 'error' } = {}) {
  await blockHostedWrites(page);
  const sent: any[] = [];
  // The screen only offers administrators of the resident's ACTIVE community (community isolation), so the mocked contact must
  // carry that community's real id, which the app keeps in per-user device storage once it has resolved the community.
  // Without a manual switch the app uses the first (primary / most recent) approved membership, so read that same response.
  let firstMembership: string | null = null;
  page.on('response', async (r) => {
    if (!/\/rest\/v1\/hoa_memberships\?.*is_primary/.test(r.url())) return;
    try { const rows = await r.json(); if (Array.isArray(rows) && rows[0]?.hoa_id) firstMembership ??= rows[0].hoa_id; } catch { /* not json */ }
  });
  const activeHoa = async () => page.evaluate(() => {
    const hit = Object.entries(localStorage).find(([k]) => k.startsWith('tenisx_active_hoa:'));
    return hit ? hit[1] : null;
  }).catch(() => null).then((stored) => stored ?? firstMembership);
  // registered AFTER the guard so these take priority over its canned answers
  await page.route(/\/rest\/v1\/rpc\/my_message_contacts/, async (route) => {
    const hoa = (await activeHoa()) ?? 'unresolved';
    await route.fulfill(json(opts.contacts ?? [{ user_id: ADMIN, full_name: 'Pat Admin', hoa_id: hoa, hoa_name: 'Dorado Beach East', contact_is_admin: true }]));
  });
  await page.route(/\/rest\/v1\/messages(\?|$)/, async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      sent.push(JSON.parse(req.postData() ?? '{}'));
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (req.method() !== 'GET') return route.fallback();
    if (opts.history === 'error') return route.fulfill(json({ message: 'boom' }, 500));
    return route.fulfill(json(opts.history ?? []));
  });
  await page.route(/\/rest\/v1\/profiles\?/, (route) =>
    route.request().method() === 'GET' ? route.fulfill(json([{ id: ADMIN, full_name: 'Pat Admin' }])) : route.fallback());
  return sent;
}

test.describe('Resident messaging the HOA administrator (mocked)', () => {
  test('discover the administrator, start a conversation and send a message to THAT administrator only', async ({ page }) => {
    const sent = await setup(page);
    await page.goto('/messages');
    await expect(page.locator('[data-testid="new-message"]')).toBeVisible({ timeout: 40000 });
    await page.locator('[data-testid="new-message"]').click();
    await expect(page.locator('[data-testid="messages-picker"]')).toBeVisible();
    await expect(page.getByText('Pat Admin')).toBeVisible();
    await expect(page.getByText('Dorado Beach East · Administrator')).toBeVisible();
    await page.getByLabel('Message Pat Admin').click();
    await expect(page.locator('[data-testid="messages-thread"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="message-input"]').fill('Is the court open on Saturday?');
    await page.locator('[data-testid="message-send"]').click();
    await expect.poll(() => sent.length, { timeout: 15000 }).toBe(1);
    expect(sent[0]).toMatchObject({ receiver_id: ADMIN, content: 'Is the court open on Saturday?' });
    expect(Object.keys(sent[0]).sort()).toEqual(['content', 'receiver_id', 'sender_id']); // nothing else is sent
  });

  test('existing conversation history is listed', async ({ page }) => {
    await setup(page, { history: [
      { id: 'm1', sender_id: ADMIN, receiver_id: 'me', content: 'Yes, from 8 AM.', created_at: new Date().toISOString(), read_at: null },
    ] });
    await page.goto('/messages');
    await expect(page.locator(`[data-testid="conversation-${ADMIN}"]`)).toBeVisible({ timeout: 40000 });
    await expect(page.locator(`[data-testid="conversation-${ADMIN}"]`)).toContainText('Yes, from 8 AM.');
  });

  test('a failed history load is an error with retry, never an empty inbox', async ({ page }) => {
    await setup(page, { history: 'error' });
    await page.goto('/messages');
    await expect(page.getByText('Something went wrong')).toBeVisible({ timeout: 40000 });
    await expect(page.getByText('Try again')).toBeVisible();
    await expect(page.locator('[data-testid^="conversation-"]')).toHaveCount(0);
  });

  test('community isolation: an administrator of ANOTHER community is never offered', async ({ page }) => {
    await setup(page, { contacts: [{ user_id: ADMIN, full_name: 'Other Community Admin', hoa_id: 'some-other-community', hoa_name: 'Elsewhere', contact_is_admin: true }] });
    await page.goto('/messages');
    await expect(page.locator('[data-testid="new-message"]')).toBeVisible({ timeout: 40000 });
    await page.locator('[data-testid="new-message"]').click();
    await expect(page.getByText('No one to message yet')).toBeVisible();
    await expect(page.getByText('Other Community Admin')).toHaveCount(0);
  });

  test('no administrator yet: the picker explains why instead of staying blank', async ({ page }) => {
    await setup(page, { contacts: [] });
    await page.goto('/messages');
    await expect(page.locator('[data-testid="new-message"]')).toBeVisible({ timeout: 40000 });
    await page.locator('[data-testid="new-message"]').click();
    await expect(page.getByText('No one to message yet')).toBeVisible();
  });
});
