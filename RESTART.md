# Session Restart Handoff

**Last commit:** `bdc8b95` — fix: docs screen — Supabase documents, categories, search, layout  
**Branch:** main  
**Date paused:** 2026-05-25

---

## Current Active Prompt (in progress when paused)

### PROMPT: Resident Home Screen Tests

**Stop hook condition:**
> Playwright tests for the Resident Home screen all pass

**Steps:**
1. ✅ Write tests in `tests/home.spec.ts` — DONE
2. ✅ Confirm tests FAIL first (RED phase) — DONE (all 11 fail)
3. ⬜ Fix any issues in `src/app/(resident)/index.tsx`
4. ⬜ Run tests until all pass (GREEN phase)
5. ⬜ Commit: `"fix: home screen — Supabase connection, announcements, layout"`

**Where you left off:**  
Tests were written and confirmed failing. The beforeEach timeout was being exceeded (60s) because auth + page load + data wait all chain together. The fix was to bump `playwright.config.ts` timeout from `60000` → `90000`. That edit was in progress when the session was interrupted.

**Immediate next step:**
1. Edit `playwright.config.ts` — change `timeout: 60000` to `timeout: 90000`
2. Run: `npx playwright test tests/home.spec.ts --project=chromium --workers=2 --reporter=list`
3. Diagnose which tests fail and fix `src/app/(resident)/index.tsx` as needed
4. Re-run until all 11 pass
5. Commit

---

## What the tests check (`tests/home.spec.ts` — already written)

| # | Test | Expected to pass? |
|---|------|------------------|
| 1 | TenisX logo visible in header | ✅ logo already in index.tsx |
| 2 | Bell icon visible (`data-testid="bell-icon"`) | ✅ testID already added |
| 3 | Hamburger menu visible (`data-testid="menu-icon"`) | ✅ testID already added |
| 4 | Greeting text (Good morning/afternoon/evening) | ✅ rendered synchronously |
| 5 | HOA community name visible in hero | ✅ fetched from Supabase hoas table |
| 6 | "Community Announcements" section header visible | ✅ always rendered |
| 7 | At least one announcement shown (not empty) | ✅ HOA has 1 announcement in DB |
| 8 | "Upcoming Reservations" section header visible | ✅ always rendered |
| 9 | Upcoming Reservations shows content or empty state | ✅ empty state: "No upcoming reservations" |
| 10 | Bottom tab bar visible (HOME label) | ✅ BottomNav renders labels uppercase |
| 11 | All 5 tabs: HOME, BOOK, REPORTS, CALENDAR, DOCS | ✅ from resident layout |

**Assessment:** The native `index.tsx` already has all required functionality. The tests should pass once the timeout issue is fixed. No code changes to index.tsx are expected.

---

## Known State

### Supabase data for test user (`28-027@sanignacio.pr`)
- HOA: `cb6a0752-dee0-4a01-b74a-6fb25f47de98`
- Membership status: `approved`
- Announcements: 1 — "Tennis Courts being Refurbished soon!"
- Upcoming bookings: 0 (empty state expected)
- Documents: 2 (Meeting #1, Rules4)

### Test credentials (also in `.env`)
- Resident: `28-027@sanignacio.pr` / `Karram1@`
- Admin: `thegreens.tennis@gmail.com` / `Greensadmin`

### Login URL
The app does NOT auto-redirect to `/login` when unauthenticated.  
Tests must navigate directly to `/login` to authenticate.

---

## Playwright Setup Notes

- Config: `playwright.config.ts` — baseURL `http://localhost:8081`, global `timeout: 60000` (needs bump to 90000)
- `.env` is loaded via `dotenv.config()` at top of `playwright.config.ts`
- Dev server must be running: `npx expo start --web --port 8081`
- Auth helper in each spec file navigates to `/login` directly
- `getByText('Sign in', { exact: true })` — must be exact to avoid matching subtitle text

---

## Completed Work This Session

| Task | Status |
|------|--------|
| Prompt 3: font sizes (uiLabel 15, cardTitle 17, sectionTitle 20) | ✅ Done |
| Prompt 3: Header.tsx `resident` variant (logo + bell + menu) | ✅ Done |
| Prompt 3: BottomNav 70px height, 26px icons, 12px labels | ✅ Done |
| Prompt 3: Apply header to report.tsx, calendar.tsx, docs.tsx | ✅ Done |
| Docs screen: hoa_memberships + status='approved' | ✅ Done |
| Book screen: hoa_memberships + status='approved' | ✅ Done |
| Index screen: hoa_memberships + status='approved' | ✅ Done |
| Playwright install + playwright.config.ts | ✅ Done |
| tests/docs.spec.ts — 12 tests all passing | ✅ Done |
| tests/home.spec.ts — written, RED confirmed | ✅ Written, not yet passing |

---

## Queued Prompts After This One

RESTART.md only had Prompt 4 (My Reservations) as placeholder — user said "many pending prompts." Ask user to paste the next prompts after this one is committed.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/(resident)/index.tsx` | Resident Home screen |
| `tests/home.spec.ts` | Home screen Playwright tests (written, failing) |
| `playwright.config.ts` | Playwright config — bump timeout to 90000 |
| `src/constants/design.ts` | Design tokens |
| `src/components/ui/Header.tsx` | Shared header component |
| `src/components/ui/BottomNav.tsx` | Bottom tab bar |
