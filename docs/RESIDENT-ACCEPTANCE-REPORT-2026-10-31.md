# Resident acceptance corrections - report (2026-10-31)

Branch `v1/overnight-integration`. Nothing pushed, nothing applied to TENISX REAL, no hosted writes, no backups touched.
The new-issue numbers V1-014..V1-024 are ASSUMED to be items 1-11 of your corrections list, in order (the numbering was not in the repo).

## Verdict on the database
**No new migration is needed.** The migration plan is unchanged; its addendum (appended to `docs/MIGRATION-PLAN-2026-10-30.md`) lists every
object the final Resident code depends on. Everything exists on hosted except the four already-planned pending objects (profile photos,
report photos). Profile-photo dependency, precisely: bucket `profile-photos` + column `profiles.avatar_path`, both supplied only by
`20261030120000`. Storage answers "Bucket not found", which the app shows as "Profile photos are not enabled on this server yet".

## Final test gate
- Logic suite: **496 passed, 0 failed.**
- Browser suites (real Chromium): **175 passed, 0 failed, 1 skipped by design** (a test that would need a real report write).
  - MOCKED backend (UI proven, live database not): reservation ownership / date errors / schedule rows, notifications, report detail, default
    severity, compact reservation cards, tab scroll, documents + PDF, administrator messaging, reserve (double tap, conflict, pending),
    cancel, responsive audit (9 screens x 5 sizes, 320-768 px wide).
  - GUARDED hosted READS (hosted writes blocked): sign out + account switch, settings, privacy, notifications preferences, reports flow.
- `expo install --check` clean, `expo-doctor` 20/20, iOS export succeeded. TypeScript: no errors in files touched; remaining errors are the
  pre-existing set (the one differing line is an untouched file whose message text follows the generated route list).
- Mutation checks (fix removed, test must fail): tab-scroll reset and the report-form race were both caught.
- NOT done: any physical device, Expo Go, push notifications, anything against the live database.

## Codex
Two fresh inspections (budget used). Round 1: 6 findings, round 2: 6 findings; all fixed. **Not re-inspected by Codex** (made after round 2):
the report-form early-open race fix, the later mocked specs (documents, messaging, booking), and the final test-hardening edits.

## The 13 original issues
1. **Fixed and browser-verified** - V1-002 report navigation + form (52 report tests); V1-003 documents/PDF (mocked); V1-006 messaging to
   administrators incl. community isolation (mocked); V1-007 privacy screen; V1-008 notification preference screen (saving verified on the
   database copy, not in the browser); V1-012 unavailable slots; V1-013 sign out (repeated passes on hosted).
2. **Fixed in code, awaiting your browser testing** - V1-001 header branding (community logo and switching not exercised); V1-004 Schedule
   scrolling; V1-009 account screens (load/navigate only); V1-010 avatar menu (name and sign-out exercised, community/role switch not);
   V1-011 reservation sheet layout (single-scroller wheel not asserted).
3. **Blocked by unapplied migrations** - V1-005 profile photos (`20261030120000`); report photo attachment (part of V1-002:
   `20261023130000` + `20261030140000`).
4. **Still incomplete** - V1-009 account deletion (support request only, release blocker) and legal URLs unpublished; HOA-message emails not
   wired (V1-006/V1-008); privacy read-gap (see `RESIDENT-PRIVACY-RECOMMENDATIONS.md`, recommended before launch).

## The new corrections
1. **Fixed and browser-verified (mocked backend)** - 014 reservation ownership (root cause: "Yours" was computed per candidate window, so a 90-minute
   booking marked 6 half-hour rows; now only starts inside your booking, exactly 3 rows); 015 dates (root cause: an unloaded or failed date
   was drawn as all free; now loading / error+retry / "may be out of date", with stale-response and previous-account guards); 016 View Schedule
   (30-minute rows merged per booking, My Reservation colour + legend); 017 Report Detail (root cause: legacy dark canvas with white cards;
   now theme-based, contrast measured >= 4.5); 018 Notifications (the "duplicates" were mostly DIFFERENT events with generic text; only true
   double-writes are folded; each row is described by its report/booking; taps open the exact detail from the ids, no migration needed);
   019 compact Upcoming cards (relative day, true length, inline cancel, full date beyond 6 days); 021 back button (48pt chip, measured >= 44);
   022 default severity Low; 023 tab scroll returns to top.
2. **Awaiting your browser testing** - 020 header consistency (shared logo sizes in code; please look at it).
3. **Blocked** - 024 profile photo upload (answer above).

## Regressions and incidents found along the way
- **Real bug found by the browser tests, now fixed:** tapping "+ New report" right after the screen appears closed the form again when the
  community finished loading. Latent before today; fixed with a rule and a regression test (mutation-verified).
- **My own mistakes, both caught and repaired before anything was committed or lost:** (a) a bad edit deleted ~300 lines of `courts.tsx`; the
  tests failed at once and it was restored from git; (b) removing a temporary comparison worktree deleted some `node_modules/.bin`
  launcher files (`expo`, `acorn`, `browserslist`, ...) through a folder link. Package contents were intact; the launchers were re-linked
  (`npm rebuild --ignore-scripts`, `package-lock.json` unchanged) and `expo` works again. A few bun-only `.exe` variants for small tools
  (e.g. `acorn`) were not recreated; their npm launchers work. If anything in `node_modules` behaves oddly, `npm install` is safe.
- Three older source-pattern tests broke because code moved into shared helpers; their intent was kept and they were updated.

## Screens to review in your browser (about 25 minutes)
1. Reserve: open a court, Tomorrow - a booking of yours shows "Yours" on exactly its own rows, "Overlaps" next to it, legend present.
   Switch dates quickly; then View Schedule: your reservation is one coloured row.
2. My Reservations: compact Upcoming cards, "Today / Tomorrow / In N days", inline Cancel.
3. Report: "+" opens the form with Low selected; submit one only in a TEST community; open its Report Detail (light card layout).
4. Notifications: grouped by day, each row says which report/reservation; tap one - the right detail opens.
5. Back button on Notifications / Report Detail / My Reservations: visible and easy to tap. Header logos look the same size on every screen.
6. Switch bottom tabs, scroll, leave and return: each tab is back at the top.
7. Documents: open a PDF. Messages: write to the administrator.
8. (After migrations only) profile photo add / replace / remove; report with a photo.

## Next-morning decisions
Unchanged from `docs/GO-NO-GO-2026-10-30.md`: the fresh backup still needs the database password typed by you, the staged migration
needs your approval, and the scratch Postgres data dir (restored account data) and `C:\Users\info\tenisx-base` are awaiting your OK to delete.
Recommended before launch: the profile read-gap fix (new, separate migration, needs its own rehearsal).
