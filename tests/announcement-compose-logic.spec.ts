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

import { canCancelEvent } from '../src/lib/adminCalendar';
test.describe('event cancellation (admin calendar)', () => {
  const base = { id: 'x', hoaId: 'h', community: 'C', title: 'T', date: '2026-11-10', startTime: '10:00', endTime: null, location: '' };
  test('only real community events can be cancelled from the calendar', () => {
    expect(canCancelEvent({ ...base, type: 'community_event', hoaEventId: 'x' })).toBe(true);
    expect(canCancelEvent({ ...base, type: 'board_meeting', hoaEventId: 'x' })).toBe(true);
    expect(canCancelEvent({ ...base, type: 'blockout' })).toBe(false);
    expect(canCancelEvent({ ...base, type: 'reservation' })).toBe(false);
    expect(canCancelEvent({ ...base, type: 'community_event' })).toBe(false);
  });
  test('cancel is a status update guarded by the active status and confirmed first', () => {
    const c = readFileSync('src/app/(cm)/calendar.tsx', 'utf8');
    expect(c).toContain(".update({ status: 'cancelled' }).eq('id', e.hoaEventId).eq('status', 'active')");
    expect(c).toContain("platformAlert('Cancel this event?'");
    expect(c).not.toMatch(/from\('hoa_events'\)\.delete/);
  });
});

test.describe('amenity rules integrity migration (20261106130000)', () => {
  const m = readFileSync('supabase/migrations/20261106130000_amenity_rules_hoa_integrity.sql', 'utf8');
  test('policy requires the amenity to belong to the rules community, in USING and WITH CHECK', () => {
    const using = m.slice(m.indexOf('USING ('), m.indexOf('WITH CHECK ('));
    const check = m.slice(m.indexOf('WITH CHECK ('));
    for (const part of [using, check]) expect(part).toContain('c.id = amenity_rules.amenity_id AND c.hoa_id = amenity_rules.hoa_id');
  });
  test('composite foreign key + preflight that aborts without changing data', () => {
    expect(m).toContain('FOREIGN KEY (amenity_id, hoa_id) REFERENCES public.courts (id, hoa_id)');
    expect(m).toMatch(/IF bad > 0 THEN\s+RAISE EXCEPTION/);
    // never rewrites or removes data (the CASCADE clause and comments are not statements)
    expect(m.replace(/ON DELETE CASCADE/g, '').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')).not.toMatch(/\b(DELETE|UPDATE|INSERT)\b/);
  });
  test('re-runnable: the dependent key is dropped before the unique constraint', () => {
    expect(m.indexOf('DROP CONSTRAINT IF EXISTS amenity_rules_amenity_hoa_fkey')).toBeLessThan(m.indexOf('DROP CONSTRAINT IF EXISTS courts_id_hoa_id_key'));
  });
});

test.describe('Codex round 3: announcements screen cannot act on a stale community', () => {
  const screen = readFileSync('src/app/(admin)/announcements.tsx', 'utf8');
  test('a newer list request supersedes an older one and rows are cleared on switch', () => {
    expect(screen).toContain('const gen = ++listGen.current;');
    expect(screen).toContain('if (gen !== listGen.current) return;');
    expect(screen).toContain('setRows([]);');
  });
  test('removal only acts on a row of the community currently displayed', () => {
    expect(screen).toContain('if (!rows.some((r) => r.id === row.id)) return;');
  });
});
