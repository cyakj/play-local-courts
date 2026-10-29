/**
 * Static guards for the fixes made after the Codex migration risk review (docs/onboarding/MIGRATION-RISK-REVIEW.md).
 * Nothing is applied anywhere; these only read the files. Node only:
 *   npx playwright test -c playwright.logic.config.ts migration-risk-fixes
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const strip = (sql: string) => sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const read = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const m2 = strip(read('supabase/migrations/20261022120000_resident_join_flow_hardening.sql'));
const m4 = strip(read('supabase/migrations/20261023110000_hoa_application_hardening.sql'));
const m7 = strip(read('supabase/migrations/20261023140000_lock_down_anon_definer_rpcs_and_email_prefs.sql'));

test.describe('M4 hoa_application_hardening', () => {
  test('does not overwrite the verification bucket configuration', () => {
    expect(m4).not.toMatch(/storage\.buckets/i);
    expect(m4).not.toMatch(/allowed_mime_types/i);
  });

  test('a duplicate open application fails the migration instead of silently skipping the index', () => {
    expect(m4).not.toContain('RAISE NOTICE');
    expect(m4).toMatch(/RAISE EXCEPTION[\s\S]*hoa_applications_one_open_per_name/);
    expect(m4).toContain('CREATE UNIQUE INDEX IF NOT EXISTS hoa_applications_one_open_per_name');
  });

  test('the optional MIME change is documented outside the migrations folder and records the current value first', () => {
    const opt = read('docs/onboarding/OPTIONAL-verification-bucket-mime.sql');
    expect(opt).toMatch(/SELECT id, public, file_size_limit, allowed_mime_types/);
    // the UPDATE exists only as a commented template
    expect(opt.split('\n').filter((l) => /^\s*UPDATE storage\.buckets/i.test(l))).toHaveLength(0);
  });
});

test.describe('M2 resident_join_flow_hardening', () => {
  const def = (fn: string) => m2.split(`FUNCTION public.${fn}(`)[1]?.split('\n$$;')[0] ?? '';

  test('invite RPC keeps attribution and enforces auth, verified email, enabled/unexpired invite and approval', () => {
    const d = def('request_hoa_membership_via_invite');
    expect(d).toContain('joined_via_invite, invite_code_used');
    expect(d).toContain("ERRCODE = '42501'");
    expect(d).toContain('user_email_verified()');
    expect(d).toContain('h.invite_enabled IS TRUE');
    expect(d).toContain('h.invite_expires_at > now()');
    expect(d).toContain('hoa_is_approved(target_hoa)');
    expect(d).toContain("'pending'");
    expect(d).toContain('SECURITY DEFINER');
    expect(d).toContain("SET search_path TO 'public'");
    expect(m2).toMatch(/REVOKE ALL ON FUNCTION public\.request_hoa_membership_via_invite\(text, text\) FROM PUBLIC, anon/);
    expect(m2).toMatch(/GRANT EXECUTE ON FUNCTION public\.request_hoa_membership_via_invite\(text, text\) TO authenticated/);
  });

  test('withdraw only removes pending resident rows and never strips a decided member\'s request', () => {
    const d = def('withdraw_membership_request');
    expect(d).toContain("status = 'pending' AND role = 'resident'");
    expect(d).toMatch(/DELETE FROM public\.community_join_requests r[\s\S]*NOT EXISTS[\s\S]*hoa_memberships m/);
    expect(d).toContain('removed + removed_requests');
    expect(d).not.toMatch(/status\s*(<>|!=|IN)/);
  });

  test('resident direct write policies are still dropped (RPC-only lifecycle)', () => {
    for (const p of ['Users can request to join communities', 'hoa_memberships_insert_own_pending_resident_only',
      'hoa_memberships_insert_own', 'Users can cancel their own pending requests', 'Users can create their own join requests']) {
      expect(m2).toContain(`DROP POLICY IF EXISTS "${p}"`);
    }
    // the admin-creator insert policy (AddCommunityModal) is intentionally not dropped
    expect(m2).not.toContain('hoa_memberships_insert_own_admin_creator');
  });
});

test.describe('M7 lock_down_anon_definer_rpcs', () => {
  test('re-grants authenticated only where it already existed', () => {
    expect(m7).toContain("has_function_privilege('authenticated', fn.oid, 'EXECUTE')");
    expect(m7).toMatch(/IF had_authenticated AND fn\.proname <> 'migrate_existing_hoa_memberships'/);
    expect(m7).not.toMatch(/GRANT EXECUTE ON FUNCTION %s TO authenticated, /);
    // the capture must come before the revoke
    expect(m7.indexOf("has_function_privilege('authenticated'")).toBeLessThan(m7.indexOf('FROM PUBLIC, anon'));
  });
});

test.describe('legacy web client paths use the RPCs', () => {
  test('JoinByInvite no longer inserts into hoa_memberships directly', () => {
    const src = read('src/pages/JoinByInvite.tsx');
    expect(src).not.toMatch(/from\('hoa_memberships'\)\s*\.insert/);
    expect(src).toContain('request_hoa_membership_via_invite');
  });

  test('cancelJoinRequest withdraws through the RPC and does not report success on a no-op', () => {
    const src = read('src/contexts/ActiveHOAContext.tsx');
    expect(src).not.toMatch(/\.from\('hoa_memberships'\)\s*\.delete\(\)/);
    expect(src).toContain('withdraw_membership_request');
    expect(src).toContain("withdrawn !== true");
  });
});
