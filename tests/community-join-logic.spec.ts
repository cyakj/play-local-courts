/**
 * Resident signup -> community search -> membership request rules, plus static checks on the hardening migration.
 * Node-only (no browser/network/DB):  npx playwright test -c playwright.logic.config.ts community-join-logic
 * Server-side behavior itself is verified by the migration-text assertions below and, after the migration is
 * applied to a NON-PROD project, by a two-session e2e (not run in this sprint).
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildJoinRpcArgs, buildSignupOptions, canRequestToJoin, classifyJoinError, joinErrorMessage,
  membershipDisplay, sanitizeSearchTerm, toCommunityResults, validateSignup,
} from '../src/lib/communityJoinLogic';

test.describe('search term sanitizing', () => {
  test('requires 2+ real characters (whitespace does not count)', () => {
    expect(sanitizeSearchTerm('a').valid).toBe(false);
    expect(sanitizeSearchTerm('   a   ').valid).toBe(false);
    expect(sanitizeSearchTerm('').valid).toBe(false);
    expect(sanitizeSearchTerm('Gr').valid).toBe(true);
  });
  test('LIKE wildcards are escaped so they cannot widen the match', () => {
    expect(sanitizeSearchTerm('%%').term).toBe('\\%\\%');
    expect(sanitizeSearchTerm('a_b').term).toBe('a\\_b');
    expect(sanitizeSearchTerm('a\\b').term).toBe('a\\\\b');
  });
  test('length is capped', () => {
    expect(sanitizeSearchTerm('x'.repeat(500)).term.length).toBe(60);
  });
});

test.describe('resident signup', () => {
  test('validation', () => {
    expect(validateSignup({ fullName: 'A', email: 'a@b.co', password: 'password1' })).toMatch(/full name/i);
    expect(validateSignup({ fullName: 'Ann Lee', email: 'nope', password: 'password1' })).toMatch(/email/i);
    expect(validateSignup({ fullName: 'Ann Lee', email: 'a@b.co', password: 'short' })).toMatch(/8 characters/);
    expect(validateSignup({ fullName: 'Ann Lee', email: ' a@b.co ', password: 'password1' })).toBeNull();
  });
  test('auth metadata carries ONLY full_name: never role / hoa / status', () => {
    const o = buildSignupOptions('  Ann Lee ', 'tenisxnative://');
    expect(Object.keys(o.data)).toEqual(['full_name']);
    expect(o.data.full_name).toBe('Ann Lee');
    expect(JSON.stringify(o)).not.toMatch(/role|hoa|status|admin|platform/i);
  });
});

test.describe('join request', () => {
  test('rpc args never contain role, status or a user id', () => {
    const args = buildJoinRpcArgs('hoa-1', '  hi  ');
    expect(Object.keys(args).sort()).toEqual(['join_message', 'target_hoa_id']);
    expect(args).toEqual({ target_hoa_id: 'hoa-1', join_message: 'hi' });
    expect(buildJoinRpcArgs('hoa-1').join_message).toBeUndefined();
    expect(buildJoinRpcArgs('hoa-1', 'x'.repeat(900)).join_message!.length).toBe(500);
  });
  test('duplicate prevention: a request is only allowed when no row exists', () => {
    expect(canRequestToJoin(null)).toBe(true);
    for (const s of ['pending', 'approved', 'rejected']) expect(canRequestToJoin(s)).toBe(false);
  });
  test('results are annotated with my status and malformed rows dropped', () => {
    const res = toCommunityResults(
      [
        { id: 'a', name: 'Alpha', community_type: 'hoa' },
        { id: 'b', name: 'Beta', community_type: null },
        { id: null, name: 'Ghost', community_type: null },
        { id: 'c', name: null, community_type: null },
      ],
      [{ hoaId: 'a', status: 'pending' }],
    );
    expect(res.map((r) => [r.id, r.myStatus])).toEqual([['a', 'pending'], ['b', null]]);
  });
  test('error classification', () => {
    expect(classifyJoinError({ message: 'Membership already exists for this HOA' })).toBe('already_requested');
    expect(classifyJoinError({ message: 'duplicate key value violates unique constraint' })).toBe('already_requested');
    expect(classifyJoinError({ message: 'Verify your email before requesting to join a community' })).toBe('unverified');
    expect(classifyJoinError({ message: 'Community not found' })).toBe('not_available');
    expect(classifyJoinError(new Error('Failed to fetch'))).toBe('network');
    expect(classifyJoinError(undefined)).toBe('other');
    expect(joinErrorMessage('other')).toMatch(/try again/i);
  });
});

test.describe('status display', () => {
  test('pending / approved / rejected have distinct labels; unknown is safe', () => {
    expect(membershipDisplay('pending').label).toBe('Pending approval');
    expect(membershipDisplay('approved').tone).toBe('approved');
    expect(membershipDisplay('rejected').label).toBe('Not approved');
    expect(membershipDisplay('withdrawn').tone).toBe('unknown');
    expect(membershipDisplay(null).tone).toBe('unknown');
    // Only an approved membership may claim access.
    expect(membershipDisplay('pending').description).not.toMatch(/you are a member/i);
  });
});

test.describe('hardening migration (static)', () => {
  const sql = readFileSync(join(__dirname, '../supabase/migrations/20261022120000_resident_join_flow_hardening.sql'), 'utf8');
  const fn = (name: string) => {
    const start = sql.indexOf(`FUNCTION public.${name}`);
    expect(start, `${name} defined`).toBeGreaterThan(-1);
    const end = sql.indexOf('GRANT EXECUTE', start);
    return sql.slice(start, end);
  };

  test('directory view only lists approved communities', () => {
    const v = sql.slice(sql.indexOf('VIEW public.public_hoa_directory'), sql.indexOf('GRANT SELECT'));
    expect(v).toMatch(/WHERE approval_status = 'approved'/);
    expect(v).not.toMatch(/invite_code|address|email|phone/i);
  });
  for (const name of ['request_hoa_membership', 'request_join_community']) {
    test(`${name} checks auth, verified email and approval BEFORE any insert`, () => {
      const body = fn(name);
      const insertAt = body.indexOf('INSERT INTO');
      for (const guard of ['auth.uid() IS NULL', 'user_email_verified()', 'hoa_is_approved(target_hoa_id)']) {
        const at = body.indexOf(guard);
        expect(at, `${name}: ${guard}`).toBeGreaterThan(-1);
        expect(at, `${name}: ${guard} precedes first insert`).toBeLessThan(insertAt);
      }
      expect(body).toMatch(/'resident', 'pending'/); // role/status are fixed server-side
      expect(body).toMatch(/INSERT INTO public\.hoa_memberships/);
      expect(body).toMatch(/INSERT INTO public\.community_join_requests/); // the admin queue reads this table
    });
  }
  test('every join/withdraw function is closed to anon and open to authenticated only', () => {
    for (const sig of ['request_hoa_membership(uuid, text)', 'request_join_community(uuid, text)', 'withdraw_membership_request(uuid)', 'user_email_verified()']) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${sig} FROM PUBLIC, anon;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${sig} TO authenticated;`);
    }
  });
  test('withdraw only touches own pending rows, in both tables', () => {
    const body = fn('withdraw_membership_request');
    expect(body.match(/user_id = auth\.uid\(\)/g)?.length).toBe(2);
    expect(body).toMatch(/status = 'pending'/);
    expect(body).toMatch(/DELETE FROM public\.hoa_memberships/);
    expect(body).toMatch(/DELETE FROM public\.community_join_requests/);
  });
  test('legacy pending requests are reconciled (RPC repair + backfill) and the unguarded migration writer is revoked', () => {
    const body = fn('request_join_community');
    const early = body.slice(body.indexOf('IF request_id IS NOT NULL'), body.indexOf('RETURN request_id;'));
    expect(early).toMatch(/INSERT INTO public\.hoa_memberships/); // repaired before the idempotent early return
    expect(sql).toMatch(/Backfill[\s\S]*approval_status = 'approved'[\s\S]*NOT EXISTS/);
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.migrate_existing_hoa_memberships() FROM PUBLIC, anon, authenticated;');
  });
  for (const name of ['request_hoa_membership', 'request_join_community']) {
    test(`${name} refuses to re-open an already-reviewed legacy request`, () => {
      const body = fn(name);
      const at = body.indexOf("status <> 'pending'");
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(body.indexOf('INSERT INTO'));
    });
  }
  test('legacy rejected requests are backfilled as rejected memberships, never as access', () => {
    const b = sql.slice(sql.indexOf('-- 7b.'), sql.indexOf('-- 8.'));
    expect(b).toMatch(/'resident', 'rejected'/);
    expect(b).toMatch(/r\.status = 'rejected'/);
    expect(b).not.toContain("'resident', 'approved'"); // never grants access
  });
  test('resident direct write paths are dropped; admin policies are not touched', () => {
    for (const p of [
      'Users can request to join communities', 'hoa_memberships_insert_own_pending_resident_only',
      'Users can cancel their own pending requests', 'Users can create their own join requests',
    ]) expect(sql).toContain(`DROP POLICY IF EXISTS "${p}"`);
    expect(sql).not.toMatch(/admin_creator|_admin"|check_hoa_admin/);
  });
});

test.describe('legacy request_join_community guards decided memberships (review R10)', () => {
  const sql = readFileSync(join(__dirname, '../supabase/migrations/20261022120000_resident_join_flow_hardening.sql'), 'utf8');
  const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.request_join_community'), sql.indexOf('CREATE OR REPLACE FUNCTION public.withdraw_membership_request'));
  test('rejects an existing non-pending membership before creating any join request row', () => {
    const guard = fn.search(/FROM public\.hoa_memberships\s+WHERE user_id = auth\.uid\(\) AND hoa_id = target_hoa_id AND status <> 'pending'/);
    const insertRequest = fn.indexOf('INSERT INTO public.community_join_requests');
    expect(guard).toBeGreaterThan(-1);
    expect(insertRequest).toBeGreaterThan(guard);
  });
  test('native request_hoa_membership still rejects ANY existing membership', () => {
    const native = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.request_hoa_membership'), sql.indexOf('CREATE OR REPLACE FUNCTION public.request_join_community'));
    expect(native).toMatch(/FROM public\.hoa_memberships\s+WHERE user_id = auth\.uid\(\) AND hoa_id = target_hoa_id\s+\) THEN\s+RAISE EXCEPTION 'Membership already exists/);
  });
});
