/**
 * Direct-API regression coverage for court_maintenance blockout enforcement
 * (enforce_amenity_booking_rules trigger, extended in
 * supabase/migrations/..._greens_v1_enforce_blockout_conflicts.sql).
 *
 * These hit the real Supabase REST API directly via plain fetch() — no
 * browser, no UI — using the TEST_EMAIL / TEST_ADMIN_EMAIL accounts from
 * .env, mirroring exactly how the original direct-API bypass was reproduced
 * and fixed. Postgres trigger logic can't be exercised by a mock, so unlike
 * tests/coach-logic.spec.ts's pure-mock style, this hits the live DB by
 * design. Runs serially and each test creates/cleans its own controlled
 * data using distinct dates/hours so tests never interfere with each other
 * or with amenity_rules caps (Greens Pool: max_reservations_per_day = 1).
 */
import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config();

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
// Greens Pool, The Greens HOA — requires_admin_approval=false, so a
// successful insert is directly observable as status: 'confirmed'.
const POOL_ID = '631a5885-de4a-43c4-b2c9-565c85f60f86';
const RES_UID = 'f9fd5120-1735-4a27-a651-14a95e76a051';
const ADMIN_UID = 'f6eec1c1-fa0e-4806-b0fb-c61480870a95';

function tomorrowUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  return json.access_token;
}

async function insertRow(token: string, table: string, body: Record<string, unknown>) {
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, json };
}

async function deleteRow(token: string, table: string, id: string) {
  await fetch(`${URL}/rest/v1/${table}?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
}

// bookings has no DELETE policy for any role (residents/admins can only
// UPDATE status -> 'cancelled') -- confirmed live: a raw DELETE against a
// self-owned row silently affects 0 rows and returns no error. Test
// cleanup for bookings must cancel, not attempt to delete.
async function cancelBooking(token: string, id: string) {
  await fetch(`${URL}/rest/v1/bookings?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ status: 'cancelled' }),
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('Blockout enforcement — direct API (no browser)', () => {
  let adminToken: string;
  let resToken: string;

  test.beforeAll(async () => {
    adminToken = await tokenFor(process.env.TEST_ADMIN_EMAIL!, process.env.TEST_ADMIN_PASSWORD!);
    resToken = await tokenFor(process.env.TEST_EMAIL!, process.env.TEST_PASSWORD!);
  });

  test('overlapping booking inside an active blockout is rejected', async () => {
    const date = tomorrowUTC();
    const block = await insertRow(adminToken, 'court_maintenance', {
      court_id: POOL_ID, date, start_time: '10:00:00', end_time: '10:30:00',
      blockout_type: 'maintenance', description: 'AUTOMATED-TEST overlap',
    });
    expect(block.status).toBe(201);
    const blockId = block.json[0].id;

    const booking = await insertRow(resToken, 'bookings', {
      court_id: POOL_ID, user_id: RES_UID, date,
      start_time: '10:05:00', end_time: '10:25:00', play_type: 'singles', status: 'confirmed',
    });
    expect(booking.status).toBe(400);
    expect(booking.json.code).toBe('23514');
    expect(booking.json.message).toContain('blocked for maintenance');

    await deleteRow(adminToken, 'court_maintenance', blockId);
  });

  test('booking touching blockout boundary (non-overlapping) succeeds', async () => {
    const date = tomorrowUTC();
    const block = await insertRow(adminToken, 'court_maintenance', {
      court_id: POOL_ID, date, start_time: '14:00:00', end_time: '14:30:00',
      blockout_type: 'maintenance', description: 'AUTOMATED-TEST boundary',
    });
    expect(block.status).toBe(201);
    const blockId = block.json[0].id;

    // Ends exactly when the blockout starts — half-open semantics, not an overlap.
    const booking = await insertRow(resToken, 'bookings', {
      court_id: POOL_ID, user_id: RES_UID, date,
      start_time: '13:00:00', end_time: '14:00:00', play_type: 'singles', status: 'confirmed',
    });
    expect(booking.status).toBe(201);
    expect(booking.json[0].status).toBe('confirmed');

    await cancelBooking(resToken, booking.json[0].id);
    await deleteRow(adminToken, 'court_maintenance', blockId);
  });

  test('normal reservation with no blockout still succeeds', async () => {
    const date = todayUTC();
    const booking = await insertRow(adminToken, 'bookings', {
      court_id: POOL_ID, user_id: ADMIN_UID, date,
      start_time: '16:00:00', end_time: '17:00:00', play_type: 'singles', status: 'confirmed',
    });
    expect(booking.status).toBe(201);
    expect(booking.json[0].status).toBe('confirmed');

    await cancelBooking(adminToken, booking.json[0].id);
  });

  test('normal UI blockout filtering hides a blocked slot', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 900 });
    // The browser's local clock can resolve "Today"/"Tomorrow" to a
    // different calendar date than this file's UTC-based helpers (seen
    // during manual verification of this same fix) -- block the target
    // hour on both today and tomorrow so the assertion holds regardless of
    // which date the client-side tab actually renders.
    const dates = [todayUTC(), tomorrowUTC()];
    const blockIds: string[] = [];
    for (const date of dates) {
      const block = await insertRow(adminToken, 'court_maintenance', {
        court_id: POOL_ID, date, start_time: '11:00:00', end_time: '11:30:00',
        blockout_type: 'maintenance', description: 'AUTOMATED-TEST UI filtering',
      });
      expect(block.status).toBe(201);
      blockIds.push(block.json[0].id);
    }

    await page.goto('/courts');
    await page.waitForTimeout(1500);
    await page.getByText('Greens Pool', { exact: true }).first().click({ force: true });
    await page.waitForTimeout(1200);
    const tomorrowTab = page.getByText('Tomorrow', { exact: true });
    const tabBox = await tomorrowTab.boundingBox();
    if (tabBox) await page.mouse.click(tabBox.x + tabBox.width / 2, tabBox.y + tabBox.height / 2);
    await page.waitForTimeout(800);

    await expect(page.getByText('11:00 AM', { exact: true })).toHaveCount(0);
    // Some other slot is still selectable — proves the blockout selectively
    // filtered one time, not that the whole day rendered empty for an
    // unrelated reason (e.g. an environment/timezone edge in "today" vs
    // "tomorrow" resolution, seen elsewhere in this suite).
    await expect(page.getByText('Select', { exact: true }).first()).toBeVisible();

    for (const id of blockIds) await deleteRow(adminToken, 'court_maintenance', id);
  });
});
