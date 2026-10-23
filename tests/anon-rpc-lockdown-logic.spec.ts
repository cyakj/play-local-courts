/**
 * Static guard for 20261023140000_lock_down_anon_definer_rpcs_and_email_prefs.sql (the migration is not applied anywhere
 * yet; this only checks the file). Node only:  npx playwright test -c playwright.logic.config.ts anon-rpc-lockdown
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const sql = readFileSync('supabase/migrations/20261023140000_lock_down_anon_definer_rpcs_and_email_prefs.sql', 'utf8');
const body = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
const names = [...(body.match(/names text\[\] := ARRAY\[([\s\S]*?)\];/)?.[1].matchAll(/'([a-z_]+)'/g) ?? [])].map((m) => m[1]);

test.describe('anon RPC lockdown migration', () => {
  test('email preference RPCs refuse a signed-in caller asking about someone else', () => {
    for (const fn of ['get_email_preferences', 'create_default_email_preferences']) {
      const def = body.split(`FUNCTION public.${fn}(`)[1]?.split('$$;')[0] ?? '';
      expect(def, fn).toContain('auth.uid() IS NOT NULL AND auth.uid() <> target_user_id');
      expect(def, fn).toContain("ERRCODE = '42501'");
      expect(def, fn).toContain('SET search_path = public');
    }
  });

  test('revokes anon and PUBLIC, and re-grants authenticated so signed-in users keep access', () => {
    expect(body).toContain('FROM PUBLIC, anon');
    expect(body).toMatch(/GRANT EXECUTE ON FUNCTION %s TO authenticated/);
  });

  test('covers the audited anon-callable RPCs', () => {
    for (const n of ['get_email_preferences', 'update_email_preference', 'request_join_community', 'set_active_hoa',
      'approve_hoa_membership', 'create_maintenance_report', 'migrate_existing_hoa_memberships', 'regenerate_invite_code']) {
      expect(names, n).toContain(n);
    }
  });

  test('leaves RLS helpers, public lookups and the signup trigger alone', () => {
    for (const n of ['has_role', 'is_in_same_hoa', 'is_admin_in_same_hoa', 'check_hoa_admin', 'is_hoa_affiliated',
      'get_public_hoa_invite_by_code', 'get_public_survey_results', 'get_survey_member_count', 'handle_new_user']) {
      expect(names, n).not.toContain(n);
    }
  });

  test('backfill function is closed to signed-in users too', () => {
    // Must live inside the catalog loop so a database without the function skips it instead of failing the migration.
    expect(body).toContain("IF fn.proname = 'migrate_existing_hoa_memberships' THEN");
    expect(body).toContain("REVOKE EXECUTE ON FUNCTION %s FROM authenticated");
    expect(body).not.toMatch(/^REVOKE EXECUTE ON FUNCTION public\./m);
  });
});
