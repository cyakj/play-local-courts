/**
 * Static checks (Node only) for Stage G (resident profile read gap, 20261031120000) and the private profile-photo migration
 * (20261030120000). These read the SQL/source files; the database behaviour itself is proven by supabase/tests/profiles_read_gap.sql
 * on a scratch restore (NOT run in this environment yet).
 *   npx playwright test -c playwright.logic.config.ts profile-privacy-photos
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');
const G = read('supabase/migrations/20261031120000_profiles_member_read_gap.sql');
const D = read('supabase/migrations/20261030120000_profile_photos_private_bucket.sql');
const executable = (sql: string) => sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');

test.describe('Stage G: profile read gap', () => {
  test('the broad same-HOA read is dropped and not recreated; only own row + community administrators', () => {
    const sql = executable(G);
    expect(sql).toContain('DROP POLICY IF EXISTS "Members can view profiles in same HOA" ON public.profiles');
    const created = [...sql.matchAll(/CREATE POLICY "([^"]+)"\s+ON public\.profiles[\s\S]*?;/g)];
    expect(created).toHaveLength(1);
    expect(created[0][0]).toContain('is_admin_in_same_hoa');
    expect(created[0][0]).not.toContain('is_in_same_hoa(');
    expect(created[0][0]).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    expect(created[0][0]).not.toContain("auth.role()");
  });

  test('pre-flight aborts (changing nothing) when another permissive SELECT policy would defeat the fix', () => {
    expect(G).toContain("unexpected permissive SELECT policy");
    expect(G).toContain('nothing was changed');
    // the pre-flight DO block comes before any DDL that changes policies
    expect(G.indexOf('unexpected permissive SELECT policy')).toBeLessThan(G.indexOf('DROP POLICY IF EXISTS "Members can view profiles in same HOA"'));
  });

  test('the directory function returns only id + full_name, to signed-in members of a shared community, capped at 200 ids', () => {
    const fn = G.slice(G.indexOf('CREATE OR REPLACE FUNCTION public.community_member_names'), G.indexOf('REVOKE ALL ON FUNCTION public.community_member_names'));
    expect(fn).toContain('RETURNS TABLE (id uuid, full_name text)');
    expect(fn).toContain('SECURITY DEFINER');
    expect(fn).toContain("SET search_path TO 'public'");
    expect(fn).toContain('auth.uid() IS NOT NULL');
    expect(fn).toContain('<= 200');
    expect(fn).toContain("status = 'approved'");
    for (const col of ['phone_number', 'date_of_birth', 'unit_number', 'latitude', 'longitude', 'zip_code', 'notification_preferences', 'avatar']) {
      expect(fn, col).not.toContain(col);
    }
    expect(G).toContain('REVOKE ALL ON FUNCTION public.community_member_names(uuid[]) FROM PUBLIC, anon');
    expect(G).toContain('GRANT EXECUTE ON FUNCTION public.community_member_names(uuid[]) TO authenticated');
  });

  test('Stage G does not depend on the photo, time zone or reservation migrations', () => {
    for (const dep of ['avatar_path', 'timezone', 'exclusive', 'profile-photos']) expect(executable(G), dep).not.toContain(dep);
  });

  test('a rollback exists and restores the previous policy and removes the function', () => {
    const r = read('supabase/rollbacks/20261031120000_rollback_profiles_member_read_gap.sql');
    expect(r).toContain('CREATE POLICY "Members can view profiles in same HOA"');
    expect(r).toContain('DROP FUNCTION IF EXISTS public.community_member_names(uuid[])');
  });

  test('resident-facing name lookups use the directory, and the helper only ever selects id + full_name', () => {
    expect(read('src/components/messaging/CommunityMessages.tsx')).not.toMatch(/from\('profiles'\)/);
    expect(read('src/app/report-detail/[id].tsx')).not.toMatch(/from\('profiles'\)/);
    const helper = read('src/lib/memberNames.ts');
    expect(helper).toContain("rpc('community_member_names'");
    const selects = [...helper.matchAll(/\.select\('([^']*)'\)/g)].map((m) => m[1]);
    expect(selects).toEqual(['id, full_name']);
  });
});

test.describe('Profile photos: private bucket and owner-only policies', () => {
  const sql = executable(D);
  test('bucket is private, 5 MB, JPEG/PNG/WebP only, and a mismatching existing bucket stops the migration', () => {
    expect(sql).toContain("VALUES ('profile-photos', 'profile-photos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])");
    expect(sql).toContain('RAISE EXCEPTION');
  });
  test('all four storage policies are owner-only (first folder = auth.uid()), authenticated only, none public', () => {
    const policies = [...sql.matchAll(/CREATE POLICY "([^"]+)"[\s\S]*?;/g)];
    expect(policies).toHaveLength(4);
    for (const p of policies) {
      expect(p[0], p[1]).toContain('TO authenticated');
      expect(p[0], p[1]).toContain("bucket_id = 'profile-photos'");
      expect(p[0], p[1]).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    }
  });
  test('avatar_path CHECK pins the path to the row owner and to the three extensions', () => {
    expect(sql).toContain('split_part(avatar_path, \'/\', 1) = id::text');
    expect(sql).toContain('(jpg|png|webp)');
  });
  test('the public avatars bucket and avatar_url are not touched', () => {
    expect(sql).not.toMatch(/'avatars'/);
    expect(sql).not.toContain('avatar_url');
  });
});
