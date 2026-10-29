# Expo Go manual QA checklist (prioritized)

Status 2026-10-28: **nothing below has been run on a phone.** Every box is a to-verify. Written for a quick Expo Go pass; the longer dev-client list is `IPHONE-QA-CHECKLIST.md`.

## 0. Gates - read before scanning the QR code
- [ ] **Which database?** `.env` currently has `EXPO_PUBLIC_SUPABASE_URL` = project `hqqlrliakttqsbalvuyz` - this is TENISX REAL (older docs call it "test-only"; treat it as real). Anything you create in Expo Go is written there. Use ONLY your test accounts, create no real residents, and do not press destructive actions on real data. Prefer a separate non-production project: put its URL/anon key in a local `.env` override.
- [ ] **Migrations are NOT applied** (7 pending; backup not taken). So these features are expected to misbehave on the current hosted DB - do not log them as regressions:
  - Resident **Withdraw request** (needs `withdraw_membership_request`, migration 2) -> error toast.
  - Email-verification gate on joining, approved-only community search (migration 2).
  - **Report photo** attach after submit (migration 6) -> report saves, photo not attached.
  - **Community interest** screen (migration 5) -> errors/empty.
  - Admin "reservation needs approval" notification (migration 3).
  - Applicant document guard / duplicate-application block (migration 4).
- [ ] Expo Go version matches the project SDK (`package.json` has `expo ^57`). If Expo Go refuses to open the project, you need a dev client instead; that is a build/enrolment step, not done here.
- [ ] Expo Go supplies its own camera/photo permission text, so it can NOT confirm the real-build permission strings in `app.json` (dev client / TestFlight needed).
- [ ] `EXPO_PUBLIC_TENNIS_FEATURES_ENABLED=false` - tennis/Stage 2 screens must not appear.
- Start: `npm run dev`, scan with the Camera app.

## P0 - must pass (about 15 min)
1. [ ] App opens, no red screen, splash -> sign-in. Wrong password shows an error, no crash.
2. [ ] **Account isolation:** sign in as Resident A, note the community; sign out; sign in as Resident B (different community). B must never see A's community, reservations or notifications, even briefly. Repeat A -> B quickly (slow network) to try the stale-data race.
3. [ ] **Resident booking:** open amenity, pick a free slot, book. It appears in My Reservations; the same slot cannot be double-booked from a second account; cancel works (and respects the cancellation window message).
4. [ ] **HOA admin approval:** as Admin, Pending Requests lists a resident's join request; Approve -> resident gets access after re-opening the app; Reject -> resident sees "Not approved".
5. [ ] Airplane-mode a screen mid-load: you see a clear error/retry, not an endless spinner.

## P1 - core workflows
**Resident:** sign up (email verification link opens the app via `tenisxnative://`); search a community; request to join -> status "Pending"; duplicate request blocked in the UI; Report an issue with and without a photo; My Reports shows status; Notifications list and tap-through; Settings -> Sign out / change password.
**HOA Admin:** Dashboard counts; Manage Amenities -> open amenity -> **Open Schedule** and **Add Blockout** actually open (previously dead on iPhone); blockout with conflicting reservations shows the conflict preview; Manage Courts edit; Pending Requests; Maintenance reports (change status, add public vs internal note - internal note must NOT be visible to the resident); announcements.
**TenisX Platform:** sign in as platform reviewer; HOA applications list -> open -> documents load via signed URL -> Approve/Request info/Reject; approving creates the community and the applicant becomes its admin.
**Applicant:** HOA admin application: fill form, attach a JPG; PDF is not selectable in the picker (known); resubmit keeps earlier documents.

## P2 - polish
- [ ] Dark canvas everywhere (no white flashes), text readable, tap targets >= 44 px, keyboard does not hide inputs (forms, join message, report description).
- [ ] Pull-to-refresh on lists; empty states have copy; back button / swipe-back never lands on a blank screen.
- [ ] Notification badges clear after reading; deep link from an admin notification opens the right list.
- [ ] Rotating the phone or switching apps and returning does not log you out or lose a half-typed form.

## What Expo Go cannot tell you
- **Needs a native build (dev client / TestFlight; EAS enrolment not started):** real iOS permission prompts/strings, push notifications, universal links, release-build performance, App Store review behaviour.
- **Needs the backend first, then CAN be checked in Expo Go:** everything marked "needs migration" in section 0 (withdraw, interest requests, photo attach, applicant guard, admin review notifications). These are database prerequisites, not native-build ones.

## Log findings as
`screen | account | steps | expected | actual | screenshot` - and note whether the migration gate (section 0) explains it.
