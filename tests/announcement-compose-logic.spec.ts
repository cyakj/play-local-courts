// Node-only: administrator announcement composer rules + wiring. (Database behaviour is proven by supabase/tests/announcement_*.sql.)
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { BODY_MAX, TITLE_MAX, buildInsert, postErrorMessage, removeErrorMessage, validateDraft } from '../src/lib/announcementCompose';

const read = (p: string) => readFileSync(p, 'utf8');
const ok = { title: 'Pool closed', body: 'Closed Thursday for resurfacing', urgent: false, category: 'general' as const };

test.describe('validation', () => {
  test('a complete draft posts', () => expect(validateDraft(ok)).toBeNull());
  test('title and message are required (whitespace does not count)', () => {
    expect(validateDraft({ ...ok, title: '   ' })).toMatch(/title/i);
    expect(validateDraft({ ...ok, body: '\n ' })).toMatch(/message/i);
  });
  test('length limits', () => {
    expect(validateDraft({ ...ok, title: 'x'.repeat(TITLE_MAX + 1) })).toMatch(/title/i);
    expect(validateDraft({ ...ok, body: 'x'.repeat(BODY_MAX + 1) })).toMatch(/message/i);
  });
});

test.describe('insert payload', () => {
  test('an ordinary notice sends no urgency/category column, so it posts on a server without them', () => {
    expect(buildInsert(ok, 'h1', 'u1')).toEqual({ hoa_id: 'h1', created_by: 'u1', title: 'Pool closed', body: 'Closed Thursday for resurfacing' });
  });
  test('urgent and categorised notices send exactly those columns', () => {
    expect(buildInsert({ ...ok, urgent: true, category: 'maintenance' }, 'h1', 'u1')).toMatchObject({ is_urgent: true, category: 'maintenance' });
    expect(buildInsert({ ...ok, category: 'service' }, 'h1', 'u1')).not.toHaveProperty('is_urgent');
  });
  test('text is trimmed', () => expect(buildInsert({ ...ok, title: '  Hi  ' }, 'h', 'u').title).toBe('Hi'));
});

test.describe('error wording', () => {
  test('missing column + urgent/category -> names the pending database update, never a raw column error', () => {
    const m = postErrorMessage({ code: '42703', message: 'column "is_urgent" of relation "hoa_announcements" does not exist' }, { ...ok, urgent: true });
    expect(m).toMatch(/database update/);
    expect(m).not.toMatch(/relation/);
  });
  test('permission failures are explained', () => {
    expect(postErrorMessage({ message: 'new row violates row-level security policy' }, ok)).toMatch(/permission/);
  });
  test('removal on a server without archive_announcement', () => {
    expect(removeErrorMessage({ code: 'PGRST202', message: 'Could not find the function public.archive_announcement' })).toMatch(/database update/);
    expect(removeErrorMessage({ code: '42501', message: 'Only community administrators can remove announcements' })).toMatch(/administrators/);
  });
});

test.describe('wiring', () => {
  const screen = read('src/app/(admin)/announcements.tsx');
  test('only communities the user administers are offered', () => {
    expect(screen).toContain(".eq('role', 'admin').eq('status', 'approved')");
  });
  test('posting goes to hoa_announcements; removal goes through the archive function (nothing is deleted from the client)', () => {
    expect(screen).toContain("db.from('hoa_announcements').insert(");
    expect(screen).toContain("db.rpc('archive_announcement'");
    expect(screen).not.toMatch(/\.delete\(\)/);
  });
  test('removal asks for confirmation', () => expect(screen).toContain("platformAlert('Remove this announcement?'"));
  test('the community dashboard links to it', () => {
    expect(read('src/app/(cm)/community/[hoaId].tsx')).toContain("pathname: '/(admin)/announcements'");
  });
  test('the archive migration hides archived rows from everyone and adds no UPDATE policy', () => {
    const m = read('supabase/migrations/20261106120000_announcement_archive.sql');
    expect(m).toContain('archived_at IS NULL');
    expect(m).not.toMatch(/CREATE POLICY[^;]*FOR UPDATE/i);
    expect(m).toMatch(/REVOKE ALL ON FUNCTION public\.archive_announcement\(uuid\) FROM PUBLIC, anon/);
  });
});
