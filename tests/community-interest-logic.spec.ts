/// <reference types="node" />
// Node-only proof: real pure logic and migration/client source contracts. No database is contacted.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  COMMUNITY_TYPES, INTEREST_STATUSES, buildInviteMessage, classifyInterestError, interestStatusDisplay,
  normalizeInterestInput, validateInterestForm, type InterestFormInput,
} from '../src/lib/communityInterestLogic';

const valid: InterestFormInput = {
  communityName: 'Oak Courts', city: 'Miami', region: '', communityType: 'hoa',
  approxUnits: '', contactName: '', contactEmail: '', notes: '',
};
const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');
const migration = source('supabase/migrations/20261023120000_community_interest_requests.sql');
const sql = migration.replace(/--[^\n]*/g, '');

test('required names reject blank, whitespace, short and overlong values; accept boundaries', () => {
  expect(validateInterestForm(valid)).toEqual({});
  for (const [key, max] of [['communityName', 120], ['city', 80]] as const) {
    for (const value of ['', '   ', 'x', 'x'.repeat(max + 1)]) expect(validateInterestForm({ ...valid, [key]: value })[key]).toBeTruthy();
    for (const value of ['xy', 'x'.repeat(max), '  xy  ']) expect(validateInterestForm({ ...valid, [key]: value })[key]).toBeUndefined();
  }
});

test('optional units accept integers within bounds and reject non-integers and invalid numbers', () => {
  for (const approxUnits of ['', '   ', '1', '100000', ' 42 ']) expect(validateInterestForm({ ...valid, approxUnits }).approxUnits).toBeUndefined();
  for (const approxUnits of ['0', '-1', '100001', '1.5', 'NaN', 'Infinity', '1e2', '12oops', '1.0']) expect(validateInterestForm({ ...valid, approxUnits }).approxUnits).toBeTruthy();
});

test('optional field limits, email shape, and community types', () => {
  for (const contactEmail of ['', ' ', ' board@example.org ']) expect(validateInterestForm({ ...valid, contactEmail }).contactEmail).toBeUndefined();
  for (const contactEmail of ['wrong', '@a.com', 'a@', 'a@b', 'a b@c.com', 'a@@b.com', `${'x'.repeat(250)}@a.com`]) expect(validateInterestForm({ ...valid, contactEmail }).contactEmail).toBeTruthy();
  for (const [key, limit] of [['region', 80], ['contactName', 120], ['notes', 1000]] as const) {
    expect(validateInterestForm({ ...valid, [key]: 'x'.repeat(limit) })[key]).toBeUndefined();
    expect(validateInterestForm({ ...valid, [key]: 'x'.repeat(limit + 1) })[key]).toBeTruthy();
  }
  for (const t of COMMUNITY_TYPES) expect(validateInterestForm({ ...valid, communityType: t.value }).communityType).toBeUndefined();
  expect(validateInterestForm({ ...valid, communityType: 'admin' }).communityType).toBeTruthy();
});

test('normalization trims, preserves content, and converts empty optional values to null', () => {
  expect(normalizeInterestInput({ ...valid, communityName: ' Oak Courts ', city: ' Miami ', region: ' FL ', approxUnits: ' 42 ', contactName: ' Ann Lee ', contactEmail: ' board@example.org ', notes: ' hello\nthere ' })).toEqual({
    communityName: 'Oak Courts', city: 'Miami', region: 'FL', communityType: 'hoa', approxUnits: 42,
    contactName: 'Ann Lee', contactEmail: 'board@example.org', notes: 'hello\nthere',
  });
  const empty = normalizeInterestInput({ ...valid, region: ' ', approxUnits: ' ', contactName: ' ', contactEmail: ' ', notes: ' ' });
  for (const key of ['region', 'approxUnits', 'contactName', 'contactEmail', 'notes'] as const) expect(empty[key]).toBeNull();
});

test('all statuses have labels and tones; unknown values use a safe fallback', () => {
  expect(INTEREST_STATUSES).toEqual(['new', 'contacted', 'in_review', 'onboarding', 'declined', 'closed']);
  for (const status of INTEREST_STATUSES) {
    expect(interestStatusDisplay(status).label).not.toBe('Status unavailable');
    expect(['warning', 'info', 'success', 'error', 'neutral']).toContain(interestStatusDisplay(status).tone);
  }
  for (const status of ['approved', '__proto__', 'constructor', '', null, undefined]) expect(interestStatusDisplay(status)).toEqual({ label: 'Status unavailable', tone: 'neutral' });
});

test('database errors have helpful messages, including unapplied migration errors', () => {
  expect(classifyInterestError({ code: '22023', message: 'City must be 2 to 80 characters' })).toContain('City');
  expect(classifyInterestError({ code: '22023' })).toContain('Check the community details');
  expect(classifyInterestError({ code: '42501' })).toMatch(/permission.*verified email/);
  for (const e of [{ code: '23505' }, new Error('You have already told us about this community'), { message: 'duplicate key' }, 'already exists']) expect(classifyInterestError(e)).toBe('You have already told us about this community.');
  for (const code of ['42883', 'PGRST202', '42P01', 'PGRST205']) expect(classifyInterestError({ code })).toContain('not available yet - the latest database update has not been applied');
  for (const e of [null, undefined, {}, new Error('secret database detail')]) expect(classifyInterestError(e)).toContain('Check your connection');
});

test('invitation explains TenisX, requests registration, and ignores private fields', () => {
  const input = { communityName: 'Oak Courts', requesterFirstName: ' Ann Lee ', email: 'private@example.org', phone: '555-123-4567', requesterId: '12345678-1234-1234-1234-123456789abc', contactName: 'Private Manager' };
  const message = buildInviteMessage(input);
  expect(message).toContain('Ann');
  expect(message).not.toContain('Lee');
  expect(message).toContain('tenisx.ai');
  expect(message).toMatch(/TenisX.*court bookings/);
  expect(message).toContain('Please register Oak Courts');
  for (const privateValue of [input.email, input.phone, input.requesterId, input.contactName]) expect(message).not.toContain(privateValue);
  expect(message).not.toMatch(/https?:|@/);
  expect(buildInviteMessage({ communityName: 'Oak Courts' })).toMatch(/^Hello!/);
});

test('migration is unapplied, dependency documented, both tables are RLS read-only to clients', () => {
  expect(migration).toContain('NOT APPLIED');
  expect(migration).toContain('20261022120000');
  for (const table of ['community_interest_requests', 'community_interest_notes']) {
    expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
    expect(sql).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, 'i'));
  }
  const policies = sql.match(/CREATE POLICY[\s\S]*?;/gi) ?? [];
  expect(policies).toHaveLength(3);
  for (const policy of policies) {
    expect(policy).toMatch(/FOR SELECT TO authenticated/i);
    expect(policy).not.toMatch(/FOR (INSERT|UPDATE|DELETE|ALL)/i);
  }
  expect(sql).toMatch(/USING \(requester_id = auth.uid\(\)\)/);
  expect(sql).toMatch(/REVOKE ALL ON TABLE[\s\S]*?FROM PUBLIC, anon, authenticated/i);
  expect(sql).toMatch(/GRANT SELECT ON TABLE[\s\S]*?TO authenticated/i);
});

test('both RPCs have fixed definer paths, guards, explicit anon revokes and authenticated grants', () => {
  for (const name of ['submit_community_interest', 'update_community_interest']) {
    const fn = sql.slice(sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`)).split('$$;')[0];
    expect(fn).toMatch(/SECURITY DEFINER\s+SET search_path TO 'public'/);
    expect(fn).toMatch(/auth.uid\(\) IS NULL/);
    expect(sql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^;]+\\) FROM PUBLIC, anon;`));
    expect(sql).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]+\\) TO authenticated;`));
  }
  expect(sql).toMatch(/public.user_email_verified\(\)/);
  expect(sql).toMatch(/has_role\(auth.uid\(\), 'platform_reviewer'\)/);
  expect(sql).toContain("ERRCODE = '42501'");
  expect(sql).toContain("ERRCODE = '22023'");
  expect(sql).toContain('pg_advisory_xact_lock');
  expect(sql).toMatch(/count\(\*\)[\s\S]+>= 5/);
  expect(sql).toContain('lower(btrim(community_name)) = lower(p_community_name)');
  expect(sql).toContain('lower(btrim(city)) = lower(p_city)');
  expect(sql).toContain("status IN ('new', 'contacted', 'in_review', 'onboarding')");
});

test('migration writes only the new tables and constrains all requested fields', () => {
  expect(sql).not.toMatch(/\b(hoas|hoa_memberships|user_roles|profiles)\b/i);
  const writes = [...sql.matchAll(/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+public\.(\w+)/gi)].map((m) => m[1]);
  expect(writes).toEqual(['community_interest_requests', 'community_interest_requests', 'community_interest_notes']);
  for (const constraint of [
    'char_length(btrim(community_name)) BETWEEN 2 AND 120', 'char_length(btrim(city)) BETWEEN 2 AND 80',
    'char_length(region) <= 80', 'approx_units IS NULL OR approx_units BETWEEN 1 AND 100000',
    'char_length(contact_name) <= 120', "char_length(contact_email) <= 254 AND position('@' IN contact_email) > 0",
    'char_length(notes) <= 1000', 'char_length(status_message) <= 500',
    "community_type IN ('hoa', 'condo', 'coop', 'townhome', 'other')",
    "status IN ('new', 'contacted', 'in_review', 'onboarding', 'declined', 'closed')",
  ]) expect(sql).toContain(`CHECK (${constraint}`);
  expect(sql).toMatch(/linked_application_id uuid REFERENCES public.hoa_applications\(id\) ON DELETE SET NULL/);
  expect(sql).toMatch(/SELECT 1 FROM public.hoa_applications WHERE id = p_linked_application_id/);
  expect(sql).toContain('updated_at = now()');
});

test('screens use the RPC data layer, offer sharing and retry, and entry links are additive', () => {
  const layer = source('src/lib/communityInterest.ts');
  expect(layer).toContain(".rpc('submit_community_interest'");
  expect(layer).toContain(".rpc('update_community_interest'");
  for (const path of ['src/lib/communityInterest.ts', 'src/app/community-interest.tsx', 'src/app/(platform)/interest.tsx']) expect(source(path)).not.toMatch(/\.(insert|update|delete)\s*\(/);
  const resident = source('src/app/community-interest.tsx');
  const platform = source('src/app/(platform)/interest.tsx');
  expect(resident).toContain('await submitCommunityInterest(form)');
  expect(platform).toContain('await updateCommunityInterest(');
  expect(resident).toContain('Share.share({ message: buildInviteMessage(');
  for (const screen of [resident, platform]) {
    expect(screen).toContain('useFocusEffect');
    expect(screen).toContain('classifyInterestError');
  }
  expect(source('src/app/join-community.tsx').match(/router.push\('\/community-interest'/g)).toHaveLength(2);
  expect(source('src/app/(platform)/index.tsx')).toContain("router.push('/(platform)/interest'");
});

test('F1: open-request uniqueness covers status changes and the index error is friendly', () => {
  expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS community_interest_one_open_per_community\s+ON public\.community_interest_requests \(requester_id, lower\(btrim\(community_name\)\), lower\(btrim\(city\)\)\)\s+WHERE status IN \('new', 'contacted', 'in_review', 'onboarding'\);/);
  const update = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.update_community_interest'));
  expect(update).toMatch(/SELECT requester_id INTO request_owner FROM public\.community_interest_requests WHERE id = p_request_id/);
  const lock = update.indexOf('pg_advisory_xact_lock(hashtextextended(request_owner::text, 0))');
  const readStatus = update.indexOf('SELECT status INTO previous_status');
  const transition = update.indexOf("IF previous_status IN ('declined', 'closed') AND p_status IN ('new', 'contacted', 'in_review', 'onboarding')");
  const quota = update.indexOf('WHERE requester_id = request_owner AND status IN');
  const write = update.indexOf('UPDATE public.community_interest_requests');
  expect(lock).toBeGreaterThan(0);
  expect(readStatus).toBeGreaterThan(lock);
  expect(transition).toBeGreaterThan(readStatus);
  expect(quota).toBeGreaterThan(transition);
  expect(write).toBeGreaterThan(quota);
  expect(update).toMatch(/SELECT status INTO previous_status[^;]+FOR UPDATE;/);
  expect(update).toMatch(/WHERE requester_id = request_owner AND status IN \('new', 'contacted', 'in_review', 'onboarding'\)\) >= 5 THEN\s+RAISE EXCEPTION 'This requester already has five open community requests' USING ERRCODE = '22023'/);
  for (const field of ['message', 'details', 'constraint']) {
    expect(classifyInterestError({ code: '23505', [field]: 'community_interest_one_open_per_community' })).toBe('This requester already has an open request for that community');
  }
  // The resident submission's existing explicit duplicate error retains its wording.
  expect(classifyInterestError({ code: '23505', message: 'You have already told us about this community' })).toBe('You have already told us about this community.');
});

test('F2: refreshes retain the list and editor, including saved statuses outside the filter', () => {
  const screen = source('src/app/(platform)/interest.tsx');
  expect(screen).toContain('loading && rows.length === 0 ? <LoadingBlock />');
  expect(screen).toContain('error && rows.length === 0 ? <ErrorBlock');
  expect(screen).not.toContain('key={row.updated_at}');
  expect(screen).toContain('<View key={row.id}');
  expect(screen).toContain('<InterestEditor request={row} onSaved={() => load(true)} />');
  expect(screen).toContain('r.status === filter || r.id === expanded');
  expect(screen).toContain("if (afterSave) setRefreshNotice('Saved, but the list could not be refreshed - pull to retry')");
  expect(screen).toContain('!!refreshNotice && <Text');
  expect(screen).toContain('{saved && <Text style={s.body}>Changes saved.</Text>}');
  const save = screen.slice(screen.indexOf('async function save()'), screen.indexOf('return <View style={s.editor}>'));
  expect(save.indexOf('setSaved(true)')).toBeGreaterThan(save.indexOf('await updateCommunityInterest('));
  expect(save.indexOf('await onSaved()')).toBeGreaterThan(save.indexOf('setSaved(true)'));
  expect(screen).not.toMatch(/setRows\(\[\]\)|setExpanded\(null\)/);
});

test('F3: null preserves links, clearing is explicit across RPC and client, and old overload is removed', () => {
  expect(sql).toContain('p_linked_application_id uuid DEFAULT NULL,');
  expect(sql).toContain('p_clear_link boolean DEFAULT false');
  expect(sql).toMatch(/linked_application_id = CASE WHEN p_clear_link THEN NULL\s+ELSE COALESCE\(p_linked_application_id, linked_application_id\) END/);
  expect(sql).toContain('DROP FUNCTION IF EXISTS public.update_community_interest(uuid, text, text, text, uuid);');
  for (const statement of [
    'REVOKE ALL ON FUNCTION public.update_community_interest(uuid, text, text, text, uuid, boolean) FROM PUBLIC, anon;',
    'GRANT EXECUTE ON FUNCTION public.update_community_interest(uuid, text, text, text, uuid, boolean) TO authenticated;',
  ]) expect(sql).toContain(statement);
  const layer = source('src/lib/communityInterest.ts');
  expect(layer).toContain('clearLink?: boolean');
  expect(layer).toContain('p_clear_link: input.clearLink ?? false');
  expect(layer).toContain('p_linked_application_id: input.linkedApplicationId ?? null');
  const screen = source('src/app/(platform)/interest.tsx');
  expect(screen).toContain('label="Remove link"');
  expect(screen).toContain('setLinked(null); setClearLink(true); setSaved(false)');
  expect(screen).toContain('setLinked(app.id); setClearLink(false); setSaved(false)');
  expect(screen).toContain('linkedApplicationId: linked, clearLink');
  expect(screen).not.toContain('label="No linked application"');
});

test('F4: dashboard interest chip uses ChipRow and a single new-request count query', () => {
  const screen = source('src/app/(platform)/index.tsx');
  expect(screen).toMatch(/<ChipRow>\s*<Chip label="Community interest" count=\{interestCount\}[^\n]+\/>\s*<\/ChipRow>/);
  expect(screen.match(/\.from\('community_interest_requests'\)/g)).toHaveLength(1);
  expect(screen).toContain(".select('id', { count: 'exact', head: true }).eq('status', 'new')");
  expect(screen).toContain('setInterestCount(countError ? undefined : count ?? undefined)');
  expect(screen).toContain('catch { if (!cancelled) setInterestCount(undefined); }');
});

test('F5: header documents the accepted UUID exposure with independent application RLS', () => {
  const header = migration.split('CREATE TABLE')[0];
  expect(header).toContain('Requesters can read their linked_application_id');
  expect(header).toContain('hoa_applications independently enforces RLS');
  expect(sql).not.toMatch(/GRANT SELECT\s*\(/);
});
