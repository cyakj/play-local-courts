/**
 * Community registration -> Platform Admin review, end to end in two real sessions:
 *   applicant (resident session)   and   TenisX Platform Admin (the existing platform_reviewer account).
 *
 * The reviewer session is captured by YOU, in a real browser window, so its password never reaches a script or an AI:
 *     node scripts/capture-session.cjs reviewer
 *
 * Flow A (non-destructive): apply -> reviewer sees it pending -> requests information -> applicant sees the request and
 *   resubmits the SAME application (no duplicate) -> reviewer rejects with a note -> applicant sees the rejection.
 * Flow B (activation): the reviewer approves a prepared application (E2E_APPROVE_APPLICATION_ID, seeded for a throwaway
 *   test applicant by the maintainer) and the community becomes active. Skipped unless that id is provided.
 *
 * Requires migration 20261013120000 for the "no bypass" guarantees; Flow A also works before it.
 * No email/SMS/push is sent: application notifications are in-app rows only.
 */
import { test, expect } from '@playwright/test';
import { STATE, contextFor, hasState, runTag } from './helpers';

test.describe.configure({ mode: 'serial' });

test.skip(!hasState(STATE.resident) || !hasState(STATE.reviewer),
  'needs the resident session file and a reviewer session (run: node scripts/capture-session.cjs reviewer)');

test('reviewer lands on the Platform Admin dashboard (role-based routing)', async ({ browser }) => {
  const ctx = await contextFor(browser, STATE.reviewer);
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await expect(page.getByTestId('platform-dashboard')).toBeVisible({ timeout: 90000 });
  expect(new URL(page.url()).pathname).toContain('platform');
  // Not a community shell: no portfolio, no resident tab bar.
  await expect(page.getByTestId('admin-portfolio')).toHaveCount(0);
  await ctx.close();
});

test('a resident can never open the Platform Admin shell', async ({ browser }) => {
  const ctx = await contextFor(browser, STATE.resident);
  const page = await ctx.newPage();
  await page.goto('/(platform)', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForTimeout(8000);
  await expect(page.getByTestId('platform-dashboard')).toHaveCount(0);
  await ctx.close();
});

test('apply -> request information -> resubmit (same row) -> reject', async ({ browser }) => {
  const tag = runTag();
  const name = `${tag} Palms HOA`;

  // --- applicant submits a new application
  const appCtx = await contextFor(browser, STATE.resident);
  const applicant = await appCtx.newPage();
  applicant.on('dialog', (d) => d.accept());
  await applicant.goto('/hoa-application?new=1', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await applicant.getByPlaceholder('Sunset Park HOA').fill(name);
  await applicant.getByPlaceholder('City, State').fill('San Juan, PR');
  await applicant.getByPlaceholder('e.g. 150').fill('120');
  await applicant.getByText('Board Member', { exact: true }).click();
  await applicant.getByText('Submit Application', { exact: true }).click();

  // --- reviewer sees it in the pending queue (realtime or refresh) and requests information
  const revCtx = await contextFor(browser, STATE.reviewer);
  const reviewer = await revCtx.newPage();
  await reviewer.goto('/', { waitUntil: 'domcontentloaded', timeout: 240000 });
  await expect(reviewer.getByTestId('platform-dashboard')).toBeVisible({ timeout: 90000 });
  await expect(reviewer.getByText(name)).toBeVisible({ timeout: 60000 });
  await reviewer.getByText(name).first().click();
  await expect(reviewer.getByTestId('platform-application')).toBeVisible();
  const infoNote = `${tag}: please upload the board resolution`;
  await reviewer.getByTestId('review-note').fill(infoNote);
  reviewer.once('dialog', (d) => d.accept());
  await reviewer.getByTestId('request-info').click();
  await expect(reviewer.getByText('Needs Information').first()).toBeVisible({ timeout: 30000 });

  // --- applicant sees the request and the note, and resubmits the same application
  await applicant.goto('/hoa-application', { waitUntil: 'domcontentloaded' });
  await expect(applicant.getByText('Additional Information Needed')).toBeVisible({ timeout: 60000 });
  await expect(applicant.getByText(infoNote)).toBeVisible();
  await applicant.getByText('Update Documents', { exact: true }).click();
  await applicant.getByText('Submit Application', { exact: true }).click();
  await applicant.goto('/hoa-application', { waitUntil: 'domcontentloaded' });
  await expect(applicant.getByText('Verification Pending')).toBeVisible({ timeout: 60000 });

  // --- exactly ONE application with this name exists (resubmission updated the row)
  await reviewer.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(reviewer.getByTestId('platform-dashboard')).toBeVisible({ timeout: 90000 });
  await expect(reviewer.getByText(name)).toHaveCount(1, { timeout: 60000 });

  // --- reviewer rejects with a note; applicant sees the rejection
  await reviewer.getByText(name).first().click();
  const rejectNote = `${tag}: cannot verify authority`;
  await reviewer.getByTestId('review-note').fill(rejectNote);
  reviewer.once('dialog', (d) => d.accept());
  await reviewer.getByTestId('reject').click();
  await expect(reviewer.getByText('Rejected').first()).toBeVisible({ timeout: 30000 });

  await applicant.goto('/hoa-application', { waitUntil: 'domcontentloaded' });
  await expect(applicant.getByText('Application Not Approved')).toBeVisible({ timeout: 60000 });
  await expect(applicant.getByText(rejectNote)).toBeVisible();

  await appCtx.close();
  await revCtx.close();
});

test('approval activates the community (prepared application)', async ({ browser }) => {
  const id = process.env.E2E_APPROVE_APPLICATION_ID;
  test.skip(!id, 'set E2E_APPROVE_APPLICATION_ID to a seeded pending application for a throwaway applicant');

  const ctx = await contextFor(browser, STATE.reviewer);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(`/(platform)/application/${id}`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await expect(page.getByTestId('platform-application')).toBeVisible({ timeout: 90000 });
  await page.getByTestId('review-note').fill('e2e: verified');
  await page.getByTestId('approve').click();
  await expect(page.getByText('Approved').first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/community is active/i)).toBeVisible();
  await ctx.close();
});
