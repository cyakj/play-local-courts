/**
 * Workstream C (V1-001 header branding, V1-010 account menu, V1-005 profile photos).
 * Node only:  npx playwright test -c playwright.logic.config.ts workstream-c-logic
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  MAX_PROFILE_PHOTO_BYTES, avatarObjectPath, checkProfilePhoto, classifyAvatarValue, initialsFor, isOwnPhotoPath,
} from '../src/lib/profilePhoto';
import { availableShells, currentShell, showSwitchCommunity, showSwitchRole } from '../src/lib/accountMenu';

const src = (p: string) => readFileSync(`src/${p}`, 'utf8');
const UID = '3f1c2b4a-9d6e-4a77-8b0e-1c2d3e4f5a6b';

test.describe('profile photo rules (V1-005)', () => {
  test('only JPEG/PNG/WebP within 5 MB are accepted; the SNIFFED type is what counts', () => {
    expect(checkProfilePhoto('image/jpeg', 1000)).toEqual({ ok: true, mime: 'image/jpeg', ext: 'jpg' });
    expect(checkProfilePhoto('image/png', 1000)).toMatchObject({ ok: true, ext: 'png' });
    expect(checkProfilePhoto('image/webp', 1000)).toMatchObject({ ok: true, ext: 'webp' });
    expect(checkProfilePhoto('image/gif', 1000)).toMatchObject({ ok: false });
    expect(checkProfilePhoto('application/pdf', 1000)).toMatchObject({ ok: false });
    expect(checkProfilePhoto(null, 1000)).toMatchObject({ ok: false });
    expect(checkProfilePhoto('image/jpeg', 0)).toMatchObject({ ok: false });
    expect(checkProfilePhoto('image/jpeg', MAX_PROFILE_PHOTO_BYTES)).toMatchObject({ ok: true });
    const big = checkProfilePhoto('image/jpeg', MAX_PROFILE_PHOTO_BYTES + 1);
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.message).toMatch(/5 MB/);
  });
  test('object paths live in the owners own folder; a new name per upload; only own paths may be deleted', () => {
    const p = avatarObjectPath(UID, 'jpg', 1790000000000);
    expect(p).toBe(`${UID}/avatar-1790000000000.jpg`);
    expect(isOwnPhotoPath(p, UID)).toBe(true);
    expect(isOwnPhotoPath(p, 'someone-else')).toBe(false);
    expect(isOwnPhotoPath(`${UID}/../other/avatar-1.jpg`, UID)).toBe(false);
    expect(isOwnPhotoPath(`${UID}/avatar-1.exe`, UID)).toBe(false);
    expect(isOwnPhotoPath('https://example.com/a.jpg', UID)).toBe(false);
    expect(isOwnPhotoPath(null, UID)).toBe(false);
  });
  test('avatar value classification: none / legacy public URL / storage path', () => {
    expect(classifyAvatarValue(null)).toEqual({ kind: 'none' });
    expect(classifyAvatarValue('  ')).toEqual({ kind: 'none' });
    expect(classifyAvatarValue('https://x.supabase.co/storage/v1/object/public/avatars/a.png')).toMatchObject({ kind: 'legacy-url' });
    expect(classifyAvatarValue(`${UID}/avatar-1.jpg`)).toEqual({ kind: 'storage-path', path: `${UID}/avatar-1.jpg` });
  });
  test('fallback initials', () => {
    expect(initialsFor('Cyrus Josephs')).toBe('CJ');
    expect(initialsFor('  madonna ')).toBe('M');
    expect(initialsFor('Ana Maria de la Cruz')).toBe('AM');
    expect(initialsFor(null)).toBe('');
    expect(initialsFor('')).toBe('');
  });
  test('migration: private bucket, 5 MB, image types, owner-only policies, loud conflict, NOT public', () => {
    const m = readFileSync('supabase/migrations/20261030120000_profile_photos_private_bucket.sql', 'utf8');
    expect(m).toMatch(/'profile-photos', 'profile-photos', false, 5242880/);
    expect(m).toMatch(/ARRAY\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
    expect(m).toMatch(/RAISE EXCEPTION 'storage bucket profile-photos already exists with different settings/);
    for (const verb of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) expect(m).toMatch(new RegExp(`FOR ${verb} TO authenticated`));
    const policies = m.split('CREATE POLICY').slice(1);
    expect(policies).toHaveLength(4);
    for (const p of policies) expect(p).toMatch(/\(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
    expect(m).not.toMatch(/USING \(bucket_id = 'profile-photos'\);/); // never an unconditional (public) read
    // C-003: the private path has its own column; profiles.avatar_url (read as a URL by Stage 2) is never overwritten
    expect(m).toMatch(/ADD COLUMN IF NOT EXISTS avatar_path text/);
    expect(m).toMatch(/split_part\(avatar_path, '\/', 1\) = id::text/);
  });
  test('the app only ever reads photos through signed URLs from that bucket and never calls getPublicUrl for it', () => {
    const id = src('hooks/useProfileIdentity.ts');
    expect(id).toMatch(/createSignedUrl\(storagePath, SIGNED_URL_TTL_SECONDS\)/);
    expect(id).not.toMatch(/getPublicUrl/);
    const act = src('lib/profilePhotoActions.ts');
    expect(act).not.toMatch(/getPublicUrl/);
    expect(act).toMatch(/upsert: false/);
    expect(act).toMatch(/update\(\{ avatar_path: path \}\)/);
    expect(act).not.toMatch(/update\(\{ avatar_url: path/);
    expect(act).toMatch(/checkProfilePhoto\(sniffDocumentMime\(bytes\), bytes\.length\)/);
    expect(act).toMatch(/isOwnPhotoPath\(previous, userId\)/);
  });
  test('upload cleanup: a failed profile update removes the uploaded object; success removes the old one', () => {
    const act = src('lib/profilePhotoActions.ts');
    const i = act.indexOf('if (upd.error)');
    expect(act.slice(i, i + 260)).toMatch(/remove\(\[path\]\)/);
    expect(act).toMatch(/await deleteOldObject\(userId, previous, path\)/);
  });
  test('Edit Profile offers add / replace / remove and no longer says "coming soon"', () => {
    const e = src('app/edit-profile.tsx');
    expect(e).not.toMatch(/coming soon/i);
    for (const id of ['profile-photo-change', 'profile-photo-remove', 'profile-photo-message']) expect(e).toContain(`testID="${id}"`);
    expect(e).toMatch(/chooseAndUploadProfilePhoto\(identity\.userId\)/);
    expect(e).toMatch(/removeProfilePhoto\(identity\.userId\)/);
  });
  test('the header avatar, Me screen and account menu all render the shared profile identity', () => {
    expect(src('components/ui/Header.tsx')).toMatch(/<ProfileAvatar photoUrl=\{profile\.photoUrl\} initials=\{profile\.initials\}/);
    expect(src('app/(resident)/me.tsx')).toMatch(/<ProfileAvatar photoUrl=\{identity\.photoUrl\}/);
    expect(src('components/ui/AccountMenu.tsx')).toMatch(/<ProfileAvatar photoUrl=\{identity\.photoUrl\}/);
  });
  test('account changes never leak the previous identity (store resets on auth change with a stale guard)', () => {
    const id = src('hooks/useProfileIdentity.ts');
    expect(id).toMatch(/supabase\.auth\.onAuthStateChange/);
    expect(id).toMatch(/loadGuard\.invalidate\(\);\s*emit\(EMPTY\);/);
    expect((id.match(/isStale\(\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

test.describe('account menu decisions (V1-010)', () => {
  test('resident-only account: no Switch Role; single community: no Switch Community', () => {
    expect(showSwitchRole(availableShells([], true))).toBe(false);
    expect(showSwitchCommunity(1)).toBe(false);
    expect(showSwitchCommunity(0)).toBe(false);
    expect(showSwitchCommunity(2)).toBe(true);
  });
  test('shells come only from backend roles through the same predicates as sign-in routing', () => {
    expect(availableShells(['hoa_manager'], true).map((s) => s.key)).toEqual(['cm', 'resident']);
    expect(availableShells(['hoa_manager'], false).map((s) => s.key)).toEqual(['cm']); // a manager with no home is not a resident
    expect(availableShells(['platform_reviewer', 'condo_manager'], true).map((s) => s.key)).toEqual(['platform', 'cm', 'resident']);
    expect(availableShells(['resident'], true).map((s) => s.key)).toEqual(['resident']);
    expect(availableShells(['made_up_role'], false)).toEqual([]);
  });
  test('coach shell follows the sign-in rule: only outside Community mode', async () => {
    const { isCommunityMode } = await import('../src/config/productMode');
    const keys = availableShells(['coach'], true).map((s) => s.key);
    expect(keys.includes('coach')).toBe(!isCommunityMode);
  });
  test('current shell detection', () => {
    expect(currentShell('(resident)')).toBe('resident');
    expect(currentShell('(cm)')).toBe('cm');
    expect(currentShell('(admin)')).toBe('cm');
    expect(currentShell('report')).toBeNull();
    expect(currentShell(undefined)).toBeNull();
  });
  test('menu wiring: roles read from user_roles on open, community switch uses the backend-approved list, sign out shared', () => {
    const m = src('components/ui/AccountMenu.tsx');
    expect(m).toMatch(/from\('user_roles'\)\.select\('role'\)/);
    expect(m).toMatch(/const ok = await setActive\(hoaId\)/);
    expect(m).toMatch(/confirmAndSignOut\(/);
    expect(m).toMatch(/router\.push\('\/settings-account'/);
    expect(m).toMatch(/canSwitchCommunity && \(/);
    expect(m).toMatch(/canSwitchRole && \(/);
    expect(m).toMatch(/testID="account-menu-name"/);
  });
  test('the active-community store only accepts communities from the approved-membership list', () => {
    const a = src('hooks/useActiveCommunity.ts');
    expect(a).toMatch(/const next = snapshot\.communities\.find\(\(c\) => c\.hoaId === hoaId\);\s*if \(!next\) return false;/);
    expect(a).toMatch(/\.eq\('status', 'approved'\)/);
  });
  test('the top-right avatar opens the menu (resident); Me tab remains the profile destination', () => {
    const h = src('components/ui/Header.tsx');
    expect(h).toMatch(/\?\? \(\(\) => setMenuOpen\(true\)\)/);
    expect(h).toMatch(/<AccountMenu visible=\{menuOpen\}/);
    expect(src('app/(resident)/_layout.tsx')).toMatch(/name="me"/);
  });
});

test.describe('community switching refreshes community-scoped screens (V1-010)', () => {
  test('Home, Me, My Reports, Community, Docs, Announcements, Reserve, Reservations and Report all key off the active community', () => {
    for (const f of ['app/(resident)/index.tsx', 'app/(resident)/me.tsx', 'app/my-reports.tsx', 'app/(resident)/community.tsx', 'app/docs.tsx', 'app/announcements.tsx', 'app/(resident)/courts.tsx', 'app/my-reservations.tsx', 'app/report.tsx']) {
      expect(src(f), f).toMatch(/useActiveCommunity\(\)/);
    }
  });
  test('Home and Me no longer pick an arbitrary first membership', () => {
    expect(src('app/(resident)/index.tsx')).not.toMatch(/from\('hoa_memberships'\)/);
    expect(src('app/(resident)/me.tsx')).not.toMatch(/from\('hoa_memberships'\)/);
  });
  test('Home discards stale loads and reloads on community change; focus reloads use the latest closure', () => {
    const h = src('app/(resident)/index.tsx');
    expect(h).toMatch(/const isStale = loadGuard\.begin\(\)/);
    expect(h).toMatch(/\[activeHoaId, communityLoading\]/);
    expect(h).toMatch(/useFocusEffect\(useCallback\(\(\) => \{ loadRef\.current\(\); \}, \[\]\)\)/);
  });
  test('My Reports only lists reports of the active community', () => {
    const r = src('app/my-reports.tsx');
    expect(r).toMatch(/\.eq\('hoa_id', activeHoa\)/);
    expect(r).toMatch(/isCancelled\(\)/);
  });
});

test.describe('header branding (V1-001)', () => {
  const h = src('components/ui/Header.tsx');
  test('TenisX logo is larger and the community identity row keeps a stable minimum height (no layout shift)', () => {
    expect(h).toMatch(/<TenisXLogo height=\{38\} testID="tenisx-logo" \/>/);
    expect(h).toMatch(/height=\{40\}\s*maxWidth=\{260\}/);
    expect(h).toMatch(/minHeight: 40,/);
  });
  test('community logo keeps its aspect ratio, is width-capped, and falls back to the name', () => {
    const b = src('components/branding/BrandLogos.tsx');
    expect(b).toMatch(/resizeMode="contain"/);
    expect(b).toMatch(/Math\.min\(maxWidth, height \* aspect\)/);
    expect(b).toMatch(/onError=\{\(\) => \{ if \(logoUrl\) setFailedUri\(logoUrl\); \}\}/);
    expect(b).toMatch(/never to another community's artwork|never to another/);
  });
  test('parent-brand stop-gap is keyed by community id and documents the future schema requirement', () => {
    const c = src('config/communityBranding.ts');
    expect(c).toMatch(/cb6a0752-dee0-4a01-b74a-6fb25f47de98/);
    expect(c).toMatch(/FUTURE SCHEMA[\s\S]{0,12}REQUIREMENT: hoas\.parent_brand_id/);
    expect(c).toMatch(/A community's own hoas\.logo_url always wins/);
  });
  test('the header only reuses the active community logo when the passed name is the active community', () => {
    expect(h).toMatch(/const identityMatches = !passedName \|\| passedName === community\?\.name;/);
  });
});

test.describe('inspection round 1 regressions (C-001..C-006)', () => {
  const home = src('app/(resident)/index.tsx');
  test('C-001: every publication after an await in Home/Me/My Reports/My Reservations is stale-guarded', () => {
    expect((home.match(/if \(isStale\(\)\) return;/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect(home).toMatch(/finally \{\s*if \(!isStale\(\)\) setLoading\(false\);/);
    const me = src('app/(resident)/me.tsx');
    expect(me).toMatch(/const isStale = loadGuard\.begin\(\)/);
    expect((me.match(/if \(isStale\(\)\) return;/g) ?? []).length).toBeGreaterThanOrEqual(3);
    const mr = src('app/my-reservations.tsx');
    expect(mr).toMatch(/createLatestGuard/);
    expect((mr.match(/if \(isStale\(\)\) return;/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(src('app/my-reports.tsx').match(/if \(isCancelled\(\)\) return;/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
  });
  test('C-002: bookings on Home and Me are scoped to the active community through the court HOA', () => {
    expect(home).toMatch(/courts!inner\(name, hoa_id\)/);
    expect((home.match(/\.eq\('courts\.hoa_id', hId\)/g) ?? []).length).toBe(2);
    expect(src('app/(resident)/me.tsx')).toMatch(/\.eq\('courts\.hoa_id', activeHoaId\)/);
  });
  test('C-004: signed photo URL expiry is tracked and refreshed; a load error triggers a refresh', () => {
    const id = src('hooks/useProfileIdentity.ts');
    expect(id).toMatch(/expiresAt = photoUrl \? Date\.now\(\) \+ SIGNED_URL_TTL_SECONDS \* 1000 : 0/);
    expect(id).toMatch(/snapshot\.expiresAt - EXPIRY_MARGIN_MS < Date\.now\(\)/);
    expect(src('components/ui/ProfileAvatar.tsx')).toMatch(/onLoadError\?\.\(\)/);
    expect(src('components/ui/Header.tsx')).toMatch(/onLoadError=\{profile\.refresh\}/);
  });
  test('C-005: saving the profile refreshes the shared identity', () => {
    expect(src('app/edit-profile.tsx')).toMatch(/void refreshProfileIdentity\(\);/);
  });
  test('C-006: the account menu is height-bounded and scrolls so every action stays reachable', () => {
    const m = src('components/ui/AccountMenu.tsx');
    expect(m).toMatch(/maxHeight: Math\.max\(220, winH - /);
    expect(m).toMatch(/<ScrollView bounces=\{false\}/);
    expect(m.indexOf('testID="menu-sign-out"')).toBeGreaterThan(m.indexOf('<ScrollView bounces'));
  });
});

test.describe('inspection round 2 regressions (C-R201..C-R204)', () => {
  test('C-R201: Me guards every later await (coach/opponent lookups) and the final loading flag; clears the stale reservation', () => {
    const me = src('app/(resident)/me.tsx');
    expect((me.match(/if \(isStale\(\)\) return;/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(me).toMatch(/if \(!isStale\(\)\) setLoading\(false\);\s*\}/);
    expect(me).toMatch(/setNextReservation\(null\); loadRef\.current\(\);/);
  });
  test('C-R202: a superseded My Reports request returns without touching any state', () => {
    const r = src('app/my-reports.tsx');
    expect(r).toMatch(/if \(isCancelled\(\)\) return; \/\/ superseded/);
    expect(r).not.toMatch(/isCancelled\(\)\) \{ setLoading\(false\)/);
  });
  test('C-R203: My Reservations waits for the community, requires an HOA filter, and shows an empty state with none', () => {
    const r = src('app/my-reservations.tsx');
    expect(r).toMatch(/if \(communityLoading\) return;/);
    expect(r).toMatch(/if \(!hoaId\) \{ loadGuard\.invalidate\(\); setBookings\(\[\]\); setLoading\(false\); return; \}/);
    expect(r).toMatch(/\.eq\('courts\.hoa_id', hoaId\)/);
    expect(r).not.toMatch(/if \(hoaId\) query = query/);
  });
  test('C-R204: the account/role menu is available in the management shells too, so a role switch always has a way back', () => {
    const kit = src('components/admin/kit.tsx');
    expect(kit).toMatch(/<AccountMenu visible=\{menuOpen\}/);
    expect(kit).not.toMatch(/router\.push\('\/settings'\)\} Icon=\{Menu\}/);
    expect(src('app/(cm)/index.tsx')).toMatch(/showMenu/);
    expect(src('app/(platform)/index.tsx')).toMatch(/showMenu/);
  });
});

test.describe('fresh-inspection follow-ups (C)', () => {
  test('C-R301: the Schedule chip row starts on and follows the shared active community', () => {
    const c = src('app/(resident)/calendar.tsx');
    expect(c).toMatch(/useActiveCommunity\(\)/);
    expect(c).toMatch(/if \(isCommunityMode && sharedCommunity\?\.hoaId\) setActiveCommunity\(sharedCommunity\.hoaId\)/);
  });
  test('C-R302: Home clears community-bound previews (including cancellation banners) on community change', () => {
    const h = src('app/(resident)/index.tsx');
    expect(h).toMatch(/setNextBooking\(null\); setCancelledBookings\(\[\]\); setAnnouncements\(\[\]\); setUpcomingEvents\(\[\]\); setUpcomingMaintenance\(\[\]\);/);
  });
  test('C-R303: the signed photo URL is refreshed on a timer shortly before it expires', () => {
    const id = src('hooks/useProfileIdentity.ts');
    expect(id).toMatch(/refreshTimer = setTimeout\(\(\) => \{ refreshProfileIdentity\(\); \}, wait\)/);
    expect(id).toMatch(/next\.expiresAt - Date\.now\(\) - EXPIRY_MARGIN_MS/);
    expect(id).toMatch(/if \(refreshTimer\) \{ clearTimeout\(refreshTimer\); refreshTimer = null; \}/);
  });
  test('the report list is cleared when the community changes (A follow-up R-003)', () => {
    expect(src('app/report.tsx')).toMatch(/setReports\(\[\]\); \/\/ the previous community's reports/);
  });
});
