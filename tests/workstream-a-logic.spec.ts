/**
 * Workstream A (V1-002/003/013): report/docs routing, report community safety, sign-out.
 * Node only:  npx playwright test -c playwright.logic.config.ts workstream-a-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runSignOut, type SignOutDeps } from '../src/lib/signOutCore';
import { EMPTY_REPORT_CONTEXT, isReportReady, resolveReportContext, toPersistedCategory, describeReport, PERSISTED_REPORT_CATEGORIES } from '../src/lib/reportContext';

const src = (p: string) => readFileSync(join('src', p), 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (/\.tsx?$/.test(e.name)) out.push(f);
  }
  return out;
}

test.describe('routing: Expo Router 58 redirects focused hidden tabs to Home', () => {
  test('report and docs are root Stack routes, not hidden (resident) tabs', () => {
    expect(existsSync('src/app/report.tsx')).toBe(true);
    expect(existsSync('src/app/docs.tsx')).toBe(true);
    expect(existsSync('src/app/(resident)/report.tsx')).toBe(false);
    expect(existsSync('src/app/(resident)/docs.tsx')).toBe(false);
    const layout = src('app/(resident)/_layout.tsx');
    expect(layout).not.toMatch(/name="(report|docs)"/);
    const root = src('app/_layout.tsx');
    expect(root).toMatch(/<Stack\.Screen name="report"/);
    expect(root).toMatch(/<Stack\.Screen name="docs"/);
  });
  test('no caller still targets the old hidden-tab paths', () => {
    for (const f of walk('src/app')) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/\(resident\)\/(report|docs)/);
    }
  });
  test('entry points pass the right context', () => {
    expect(src('app/(resident)/index.tsx')).toMatch(/pathname: '\/report'[^}]*returnTo: '\/\(resident\)'/);
    expect(src('app/(resident)/community.tsx')).toMatch(/pathname: '\/report'[^}]*returnTo: '\/\(resident\)\/community'/);
    expect(src('app/(resident)/community.tsx')).toMatch(/router\.push\('\/docs' as any\)/);
    const courts = src('app/(resident)/courts.tsx');
    expect(courts).toMatch(/pathname: '\/report', params: \{ courtId: court\.id, courtName: court\.name, facilityType: court\.court_type/);
  });
});

test.describe('report community safety (R3)', () => {
  const route = { courtId: 'c1', courtName: 'Court 1', facilityType: 'tennis' };
  test('amenity context kept inside its community, dropped after a switch', () => {
    expect(resolveReportContext(route, 'A', 'A')).toEqual(route);
    expect(resolveReportContext(route, 'A', 'B')).toEqual(EMPTY_REPORT_CONTEXT);
    expect(resolveReportContext(route, null, 'A')).toEqual(route);
  });
  test('no route amenity -> empty context', () => {
    expect(resolveReportContext({ courtId: null, courtName: 'x', facilityType: 'y' }, 'A', 'A')).toEqual(EMPTY_REPORT_CONTEXT);
  });
  test('submit stays blocked until data for the CURRENT community is loaded', () => {
    expect(isReportReady('A', 'A', false)).toBe(true);
    expect(isReportReady('A', 'B', false)).toBe(false); // slow A load, user already on B
    expect(isReportReady('', 'B', false)).toBe(false);
    expect(isReportReady('A', undefined, false)).toBe(false); // store unresolved: never guess a community
    expect(isReportReady('A', null, false)).toBe(false);
    expect(isReportReady('B', 'B', true)).toBe(false);
  });
  test('report.tsx uses the latest-load guard, readiness gate and invalidates on community change', () => {
    const r = src('app/report.tsx');
    expect(r).toMatch(/createLatestGuard/);
    expect((r.match(/isStale\(\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
    expect(r).toMatch(/!ready \|\| submitting\) return/);
    expect((r.match(/!ready \|\|/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

function makeDeps(over: Partial<SignOutDeps> = {}) {
  const calls: string[] = [];
  const deps: SignOutDeps = {
    getUserId: async () => { calls.push('getUserId'); return 'u1'; },
    signOut: async () => { calls.push('signOut'); return null; },
    removeKeys: async (k) => { calls.push('remove:' + k.join(',')); },
    navigateToLogin: () => { calls.push('login'); },
    ...over,
  };
  return { deps, calls };
}

test.describe('sign out', () => {
  test('success: signs out, clears user-scoped keys, then leaves for login (in that order)', async () => {
    const { deps, calls } = makeDeps();
    expect(await runSignOut(deps)).toEqual({ ok: true });
    expect(calls).toEqual(['getUserId', 'signOut', 'remove:tenisx_active_hoa:u1', 'login']);
  });
  test('Supabase error: reported, user stays put, nothing wiped', async () => {
    const { deps, calls } = makeDeps({ signOut: async () => ({ message: 'network down' }) });
    expect(await runSignOut(deps)).toEqual({ ok: false, message: 'network down' });
    expect(calls).not.toContain('login');
    expect(calls.some((c) => c.startsWith('remove'))).toBe(false);
  });
  test('thrown error becomes a visible failure, never an unhandled rejection', async () => {
    const { deps } = makeDeps({ signOut: async () => { throw new Error('boom'); } });
    expect(await runSignOut(deps)).toEqual({ ok: false, message: 'boom' });
  });
  test('storage cleanup failure does not block leaving the protected area', async () => {
    const { deps, calls } = makeDeps({ removeKeys: async () => { throw new Error('disk'); } });
    expect(await runSignOut(deps)).toEqual({ ok: true });
    expect(calls).toContain('login');
  });
  test('account screen uses the shared helper', () => {
    expect(src('app/settings-account.tsx')).toMatch(/confirmAndSignOut/);
    expect(src('lib/authActions.ts')).toMatch(/dismissAll/);
    expect(src('lib/authActions.ts')).toMatch(/router\.replace\('\/\(auth\)\/login'\)/);
  });
});

import { RESIDENT_DOCUMENT_GROUPS, residentGroupFor, residentGroupLabel, DOCUMENT_CATEGORIES } from '../src/lib/communityDocuments';
test.describe('resident document groups (display mapping over persisted keys)', () => {
  test('every persisted category maps to a resident group; unknown goes to Other', () => {
    const keys = new Set(RESIDENT_DOCUMENT_GROUPS.map((g) => g.key));
    for (const c of DOCUMENT_CATEGORIES) expect(keys.has(residentGroupFor(c.key))).toBe(true);
    expect(residentGroupFor('weird_new_key')).toBe('other');
    expect(residentGroupLabel('rules_bylaws')).toBe('Governing Documents & Rules');
    expect(residentGroupLabel('financial_statements')).toBe('Financial Documents');
    expect(residentGroupLabel('forms_applications')).toBe('Other Resources');
    expect(residentGroupLabel('maintenance_records')).toBe('Other Resources');
    expect(residentGroupLabel('meeting_minutes')).toBe('Meeting Minutes');
  });
  test('docs screen is scoped to the active community id and never builds storage URLs itself', () => {
    const d = src('app/docs.tsx');
    expect(d).toMatch(/\.eq\('hoa_id'/);
    expect(d).not.toMatch(/storage\.from\([^)]*\)\.getPublicUrl/);
  });
});

test.describe('inspection round 1 regressions', () => {
  const r = src('app/report.tsx');
  test('R1: amenity is looked up by id INSIDE the active community; name/type come from that record', () => {
    expect(r).toMatch(/\.from\('courts'\)[\s\S]*?\.eq\('id', routeContext\.courtId\)[\s\S]*?\.eq\('hoa_id', hId\)/);
    expect(r).toMatch(/const prefilledCourtName = courtVerified \? verifiedCourt!\.name : null/);
    expect(r).toMatch(/courtCheckPending/);
    expect(r).toMatch(/&& !courtCheckPending/);
  });
  test('R2: load is memoized on the active community and the focus effect depends on it', () => {
    expect(r).toMatch(/const load = useCallback\(async \(\) => \{/);
    expect(r).toMatch(/\[activeCommunity\?\.hoaId, communityStoreLoading, routeContext\.courtId\]\);/);
    expect(r).toMatch(/\[load, prefilledCourtId, prefilledFacilityType\]/);
  });
  test('R3: goBack prefers history; returnTo is only a validated fallback', () => {
    const g = r.slice(r.indexOf('function goBack()'), r.indexOf('function closeForm()'));
    expect(g.indexOf('router.canGoBack()')).toBeLessThan(g.indexOf('returnTo'));
    expect(g).toMatch(/returnTo\.startsWith\('\/\(resident\)'\)/);
  });
  test('R4: report browser spec blocks every hosted write', () => {
    const t = readFileSync('tests/reports.spec.ts', 'utf8');
    expect(t).toMatch(/await blockHostedWrites\(page\)/);
    const g = readFileSync('tests/helpers/hostedWriteGuard.ts', 'utf8');
    expect(g).toMatch(/method === 'GET'/);
    expect(g).not.toMatch(/\/auth\/v1/);
  });
  test('R5: Report and Docs keep the resident header (bell, avatar) with a back arrow', () => {
    expect(r).toMatch(/<Header variant="resident" onBack=\{goBack\}/);
    expect(src('app/docs.tsx')).toMatch(/<Header variant="resident" onBack=/);
    expect(src('components/ui/BackButton.tsx')).toMatch(/testID = 'header-back'/);
    expect(src('components/ui/Header.tsx')).toMatch(/<BackButton onPress=/);
  });
});

test.describe('inspection round 2 regressions', () => {
  const r = src('app/report.tsx');
  test('R1: Reserve screen only lists/acts on the ACTIVE community amenities; mismatch is shown, not silent', () => {
    const c = src('app/(resident)/courts.tsx');
    expect(c).toMatch(/c\.hoa_id === activeCommunity\.hoaId/);
    expect(c).toMatch(/const visibleCourts = isCommunityMode \? scopedCourts/);
    expect(r).toMatch(/testID="amenity-mismatch"/);
  });
  test('R2: a submission that finishes after a community switch cannot touch the new community UI', () => {
    expect(r).toMatch(/generation\.current \+= 1/);
    const h = r.slice(r.indexOf('async function handleSubmit()'), r.indexOf('function resetForm()'));
    expect((h.match(/if \(superseded\(\)\) return;/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(h).toMatch(/await loadRef\.current\(\)/);
    expect(h).not.toMatch(/await load\(\)/);
  });
  test('R3: report spec no longer expects a bottom nav on the root-stack /report', () => {
    const t = readFileSync('tests/reports.spec.ts', 'utf8');
    expect(t).toMatch(/\[data-testid="bottom-nav"\]'\)\)\.toHaveCount\(0\)/);
  });
  test('R4: tennis-mode header logo shrinks when the back arrow is present', () => {
    expect(src('components/ui/Header.tsx')).toMatch(/\{ width: 80, height: 35 \}/);
  });
});

test.describe('inspection round 3 regressions', () => {
  test('R1: Community screen loads the ACTIVE community and discards stale responses', () => {
    const c = src('app/(resident)/community.tsx');
    expect(c).toMatch(/useActiveCommunity/);
    expect(c).not.toMatch(/\.limit\(1\)\s*\.single\(\)/);
    expect(c).toMatch(/if \(cancelled\) return;/);
    expect(c).toMatch(/\[hoaId, communityLoading\]/);
  });
  test('R2: docs invalidates outstanding loads and clears documents on every transition, including to none', () => {
    const d = src('app/docs.tsx');
    const e = d.slice(d.indexOf('Every community/account transition'));
    expect(e.indexOf('loadGuard.invalidate()')).toBeLessThan(e.indexOf('if (!hoaId)'));
    expect(e).toMatch(/setDocs\(\[\]\)/);
  });
  test('R3: photo upload and attachment writes are all guarded by the submission generation', () => {
    const r = src('app/report.tsx');
    const u = r.slice(r.indexOf('async function uploadPhoto'), r.indexOf('// ─── Submit'));
    expect(u).not.toMatch(/\n\s*setSubmitError\(/);
    expect(u).toMatch(/if \(!superseded\(\)\) setUploading\(false\)/);
    expect(r).toMatch(/uploadPhoto\(inserted\.id, superseded\)/);
    const h = r.slice(r.indexOf('const attached = photoUrl'));
    expect(h.indexOf('if (superseded()) return;')).toBeLessThan(h.indexOf('setPhotoWarning'));
  });
});

test.describe('inspection round 4 regressions', () => {
  test('R-001: report has no first-membership fallback and waits for the active-community store', () => {
    const r = src('app/report.tsx');
    expect(r).not.toMatch(/from\('hoa_memberships'\)/);
    expect(r).toMatch(/communityStoreLoading/);
  });
  test('R-002: nothing actionable on Reserve until the active community resolves; sheets bound to the community', () => {
    const c = src('app/(resident)/courts.tsx');
    expect(c).toMatch(/c\.hoa_id === activeCommunity\.hoaId\) : \[\]\)/);
    expect(c).toMatch(/setBookingSheet\(null\);\s*setScheduleSheet\(null\);/);
    expect(c).toMatch(/!scopedCourts\.some\(c => c\.id === bookingSheet\.courtId\)/);
  });
  test('R-003: announcements follows the active community and discards stale responses', () => {
    const a = src('app/announcements.tsx');
    expect(a).toMatch(/useActiveCommunity/);
    expect(a).not.toMatch(/\.limit\(1\)/);
    expect(a).toMatch(/if \(cancelled\) return;/);
    expect(a).toMatch(/\[hoaId, communityLoading\]/);
  });
});

test.describe('inspection round 5 regressions', () => {
  const r = src('app/report.tsx');
  test('R-001: every category the report forms can offer maps to a value the DB CHECK constraint accepts', () => {
    const mig = readFileSync('supabase/migrations/20260529115108_fix_report_category_constraint.sql', 'utf8');
    const allowed = [...mig.slice(mig.indexOf('CHECK (category IN')).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(allowed.sort()).toEqual([...PERSISTED_REPORT_CATEGORIES].sort());
    // every key literal declared in the four facility lists + the general list
    const keys = [...r.matchAll(/\{ key: '([a-z_]+)',\s+label:/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(15);
    for (const k of keys) expect(allowed, k).toContain(toPersistedCategory(k));
  });
  test('R-001: the specific facility issue survives in the description', () => {
    expect(describeReport('net', 'Net', ' torn  ')).toBe('[Net] torn');
    expect(describeReport('plumbing', 'Water & Plumbing', 'leak')).toBe('leak');
    expect(describeReport('unknown_key', undefined, 'x')).toBe('x');
    expect(toPersistedCategory('unknown_key')).toBe('other');
  });
  test('R-001: submit persists the mapped category, never the raw facility key', () => {
    expect(r).toMatch(/category: toPersistedCategory\(category\)/);
    expect(r).toMatch(/describeReport\(category,/);
  });
  test('R-003: generic form offers locations of the ACTIVE community only and persists the choice', () => {
    expect(r).toMatch(/from\('courts'\)\.select\('id, name'\)\.eq\('hoa_id', hId\)/);
    expect(r).toMatch(/testID="location-picker"/);
    expect(r).toMatch(/amenity_id: selectedLocation\.id, location_text: selectedLocation\.name/);
    expect(r).toMatch(/setLocations\(\[\]\);\s*setSelectedLocationId\(null\);/);
  });
  test('R-002: booking/schedule sheet loaders are generation-guarded and invalidated on community change', () => {
    const c = src('app/(resident)/courts.tsx');
    expect(c).toMatch(/const myGen = \+\+sheetGen\.current;/);
    expect((c.match(/const myGen = \+\+sheetGen\.current;/g) ?? []).length).toBe(2);
    expect(c).toMatch(/sheetGen\.current \+= 1;\s*setBookingSheet\(null\)/);
    expect(c).toMatch(/fetchMaintenanceForSheet\(court\.id, isStale\)/);
    expect(c).toMatch(/if \(!isStale\(\)\) setSheetRulesLoading\(false\)/);
  });
});

test.describe('inspection round 6 regressions', () => {
  test('R-001: location picker is hidden when the route fixes the amenity', () => {
    expect(src('app/report.tsx')).toMatch(/locations\.length > 0 && !isCourtReport/);
  });
  test('R-002: confirm is generation-guarded end to end (feedback, timeout, maintenance refresh) and close invalidates', () => {
    const c = src('app/(resident)/courts.tsx');
    const h = c.slice(c.indexOf('async function handleConfirm()'), c.indexOf('// ── Filtered courts by active tab'));
    expect(h).toMatch(/const myGen = sheetGen\.current;/);
    expect(h).toMatch(/if \(isStale\(\)\) return;/);
    expect(h).toMatch(/setTimeout\(\(\) => \{ if \(isStale\(\)\) return; setBookingSheet\(null\)/);
    expect(h).toMatch(/fetchMaintenanceForSheet\(bookingSheet\.courtId, isStale\)/);
    expect(c).toMatch(/onClose=\{\(\) => \{ sheetGen\.current \+= 1; setBookingSheet\(null\)/);
  });
  test('R-003: facility fixture answers the single lookup with an object and the location list with an array', () => {
    const t = readFileSync('tests/reports.spec.ts', 'utf8');
    expect(t).toMatch(/single \? court : \[court\]/);
  });
});
