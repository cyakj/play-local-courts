/**
 * Authorisation boundaries, exercised through the real PostgREST API with real user JWTs (the same path the app uses).
 * These are the integration counterpart of supabase/tests/platform_approval_and_messaging.sql.
 *
 * Run AFTER migration 20261013120000 is applied. Nothing here sends email/SMS/push or touches an edge function.
 * Every attempted write is expected to be REFUSED; the one positive control sends a message to the HOA admin
 * (tagged "e2e-") and is removed after the run.
 */
import { test, expect } from '@playwright/test';
import { ANON_KEY, STATE, SUPABASE_URL, apiHeaders, hasState, runTag, sessionOf } from './helpers';

test.skip(!hasState(STATE.resident) || !SUPABASE_URL || !ANON_KEY, 'needs the resident session file and Supabase env');

const OUTSIDER = '06f2ef86-a885-4878-a6a1-33b883ccd35b'; // no community, no roles, no thread with the resident
const rest = (p: string) => `${SUPABASE_URL}/rest/v1/${p}`;

let resident: { token: string; userId: string };

test.beforeAll(async ({ browser }) => {
  resident = await sessionOf(browser, STATE.resident);
});

test.describe('resident cannot escalate or bypass approval', () => {
  test('cannot create a community directly', async ({ request }) => {
    const r = await request.post(rest('hoas'), {
      headers: apiHeaders(resident.token),
      data: { name: 'e2e-sneaky', admin_id: resident.userId },
    });
    expect(r.status()).toBe(403);
  });

  test('cannot call create_community()', async ({ request }) => {
    const r = await request.post(`${SUPABASE_URL}/rest/v1/rpc/create_community`, {
      headers: apiHeaders(resident.token),
      data: { community_name: 'e2e-sneaky' },
    });
    expect([401, 403]).toContain(r.status());
  });

  test('cannot grant themselves any role, including platform_reviewer', async ({ request }) => {
    for (const role of ['platform_reviewer', 'admin']) {
      const r = await request.post(rest('user_roles'), {
        headers: apiHeaders(resident.token),
        data: { user_id: resident.userId, role },
      });
      expect(r.status(), role).toBe(403);
    }
  });

  test('cannot approve an application or grant admin through the RPCs', async ({ request }) => {
    const approve = await request.post(`${SUPABASE_URL}/rest/v1/rpc/approve_hoa_application`, {
      headers: apiHeaders(resident.token),
      data: { application_id: '00000000-0000-0000-0000-000000000000' },
    });
    expect(approve.status()).toBe(403);
    const grant = await request.post(`${SUPABASE_URL}/rest/v1/rpc/grant_admin_role`, {
      headers: apiHeaders(resident.token),
      data: { target_user_id: resident.userId },
    });
    expect(grant.status()).toBe(403);
  });

  test('cannot see other people\'s applications', async ({ request }) => {
    const r = await request.get(rest('hoa_applications?select=id,applicant_id'), { headers: apiHeaders(resident.token) });
    expect(r.ok()).toBeTruthy();
    const rows = (await r.json()) as { applicant_id: string }[];
    expect(rows.every((a) => a.applicant_id === resident.userId)).toBe(true);
  });
});

test.describe('messaging boundaries', () => {
  test('only ever returns conversations the resident is part of', async ({ request }) => {
    const r = await request.get(rest('messages?select=sender_id,receiver_id&limit=1000'), { headers: apiHeaders(resident.token) });
    expect(r.ok()).toBeTruthy();
    const rows = (await r.json()) as { sender_id: string; receiver_id: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((m) => m.sender_id === resident.userId || m.receiver_id === resident.userId)).toBe(true);
  });

  test('cannot message someone outside their community and without a relationship', async ({ request }) => {
    const r = await request.post(rest('messages'), {
      headers: apiHeaders(resident.token),
      data: { sender_id: resident.userId, receiver_id: OUTSIDER, content: 'e2e-denied cold outreach' },
    });
    expect(r.status()).toBe(403);
  });

  test('cannot send a message as another user', async ({ request }) => {
    const r = await request.post(rest('messages'), {
      headers: apiHeaders(resident.token),
      data: { sender_id: OUTSIDER, receiver_id: resident.userId, content: 'e2e-denied forged sender' },
    });
    expect(r.status()).toBe(403);
  });

  test('cannot edit a sent message or delete history', async ({ request }) => {
    const own = await request.get(rest(`messages?select=id,content&sender_id=eq.${resident.userId}&limit=1`), { headers: apiHeaders(resident.token) });
    const [row] = (await own.json()) as { id: string; content: string }[];
    test.skip(!row, 'resident has no sent message to test against');

    const edit = await request.patch(rest(`messages?id=eq.${row.id}`), {
      headers: apiHeaders(resident.token), data: { content: 'e2e-tampered' },
    });
    expect(edit.status()).toBe(403);

    await request.delete(rest(`messages?id=eq.${row.id}`), { headers: apiHeaders(resident.token, { Prefer: 'return=representation' }) });
    const after = await request.get(rest(`messages?select=id,content&id=eq.${row.id}`), { headers: apiHeaders(resident.token) });
    const [still] = (await after.json()) as { id: string; content: string }[];
    expect(still?.content).toBe(row.content);
  });
});
