# TenisX V1: iPhone QA checklist (three account experiences)

Nothing in this list was run on a real iPhone overnight. Every item is a **to-verify**. Items marked **(needs migration)** only work after the matching unapplied migration is applied to a NON-PRODUCTION Supabase project first.

## 0. Before you start

### Build
- [ ] Use a **development build** (or TestFlight preview), not only Expo Go. Expo Go supplies its own photo/camera permission strings and hides the crash that happens in a real build when they are missing. `app.json` now declares them via the `expo-image-picker` config plugin; a fresh native build is required for them to take effect. **Careful:** the `development` profile in `eas.json` has `ios.simulator: true`, i.e. it builds for the iOS *Simulator* and cannot be installed on a physical iPhone. For a real device use a profile with `developmentClient: true`, `distribution: internal` and `ios.simulator: false` (not present today; `preview` is `simulator: false` but has no dev client), and make sure the Apple team / device provisioning in `eas.json` / EAS credentials is set up (`appleTeamId` is still a placeholder). I did not change `eas.json` or any signing configuration.
- [ ] Confirm the build points at the intended Supabase project (`EXPO_PUBLIC_SUPABASE_URL` in `eas.json`; the `development` profile points at project `hqqlrliakttqsbalvuyz`, the hosted project). **Do not run destructive test steps against it.** Prefer a Supabase branch or a staging project.
- [ ] `EXPO_PUBLIC_TENNIS_FEATURES_ENABLED=false` (Community mode). Stage 2 / tennis screens must stay hidden.

### Database (apply in THIS order, to a non-production project first)
Already applied to hosted (per earlier sessions): `20261012190000`, `20261013100000`, `20261013110000`, `20261013120000`.
Not applied:
1. `20261013130000_revoke_anon_execute_on_admin_rpcs.sql`
2. `20261022120000_resident_join_flow_hardening.sql` (Phase 1 resident join; now also guards decided memberships)
3. `20261023100000_admin_booking_review_notifications.sql`
4. `20261023110000_hoa_application_hardening.sql`
5. `20261023120000_community_interest_requests.sql` (needs #2 for `user_email_verified()`)
6. `20261023130000_report_photo_attach.sql`
After applying, regenerate `src/lib/types.ts` and switch `untypedDb` call sites back where noted in that file.

### Hosted settings to check (not inspectable from the repo)
- [ ] Email confirmation is ON and the redirect allow-list contains `tenisxnative://` (signup verification link).
- [ ] Run the read-only verification queries in `docs/onboarding/RLS-AUDIT.md` ("How to use this report"), especially for `profiles` (see section "Security").
- [ ] Storage buckets `report-photos` (public) and `hoa-verification-documents` (private) exist.

### Test accounts (create in the staging project; never real residents)
| Role | Needs |
|---|---|
| Resident A | verified email, approved member of Community 1 |
| Resident B | verified email, approved member of Community 2 (isolation checks) |
| New resident | brand-new email you can read (signup + verification) |
| HOA admin | `user_roles.admin` + approved `hoa_memberships.role='admin'` for Community 1 only |
| Platform reviewer | `user_roles.platform_reviewer` (grant in SQL editor; cannot be granted from the app) |
| HOA applicant | verified email, no community yet |

## 1. Resident

### Signup and join (Phase 1) (needs migration #2)
- [ ] Login screen "Sign up" opens Resident signup (not the HOA application).
- [ ] Sign up with the new-resident email; "Verify your email" state shows; no auto-login; resend has a cooldown.
- [ ] Open the verification link on the phone: lands back in the app (deep link) and signs in.
- [ ] Join screen: search needs 2+ characters; only APPROVED communities appear; `%` / `_` do not widen the search.
- [ ] Request to join Community 1: shows Pending. Tapping again does not create a duplicate.
- [ ] Withdraw the pending request: it disappears for the resident AND from the admin queue.
- [ ] After an admin approves: status shows Approved; "Open community" lands on the resident home with that community active.
- [ ] A rejected request shows "not approved" and cannot be re-requested (deferred policy; confirm the message is clear).

### Community not listed (needs migration #5)
- [ ] "Can't find your community?" opens the interest form; validation errors are inline; submit works.
- [ ] A second identical submission is refused with a friendly message.
- [ ] "Your requests" shows the status; Share opens the iOS share sheet with the invitation text (no personal data besides first name).
- [ ] Without the migration applied: a friendly "not available yet" state, no crash.

### Reservations, issues, notifications
- [ ] Book an amenity (confirmed). Resident receives "Booking confirmed".
- [ ] Book an amenity that requires approval: resident sees "awaiting approval" and later approved/declined.
- [ ] Cancel a booking; blocked slots cannot be booked.
- [ ] Report an issue WITH a photo from the library and from the camera (**permission prompts must show the new TenisX wording**). (needs migration #6) The photo appears on the report detail. Without migration #6: the success screen shows "submitted, but the photo could not be attached".
- [ ] Notifications screen: taps open the right reservation/report; unread clears.
- [ ] Messages: unread badge, send/receive with the community admin.
- [ ] Sign out returns to login; signing in as a different account shows none of the previous account's data (community name, notifications, messages).

## 2. HOA admin / community manager

### Calendar vs amenity schedule (the reported defects)
- [ ] **Calendar tab** shows community events, board meetings, scheduled maintenance and blockouts. It does **not** list routine resident reservations and has no "Reservation" filter.
- [ ] Add an event from the calendar (+); it appears on the chosen day.
- [ ] Portfolio / community "Upcoming reservations" and "Today's bookings" open **Manage Amenities**, not the calendar.
- [ ] Manage Amenities -> tap an amenity -> **"Open schedule & add blockout"**: the schedule sheet opens ON TOP of the settings sheet (this was the iOS nested-modal bug). Date arrows move days; slots show available / reserved / pending / blocked.
- [ ] Select slots -> add a blockout: form validates; conflicts list existing reservations; confirm creates it; schedule refreshes with a success banner; residents with cancelled bookings are notified.
- [ ] Tap an existing blockout: edit reason/message and remove it; tap a reservation: details and "Cancel reservation & block slot".
- [ ] Close the amenity detail while the schedule is open; reopen: the schedule starts closed.
- [ ] No "My Reservations", "Reserve an amenity" or resident booking CTAs anywhere in the manager app.

### Approvals and notifications
- [ ] A resident submits a join request: it is in Approvals -> Members. Approve: resident gains access. Decline: resident sees not approved.
- [ ] A join request with no membership behind it (legacy) cannot be approved; the message explains why.
- [ ] A resident books an approval-required amenity: Approvals -> Reservations shows it; approve/decline works; a conflicting confirmed booking blocks approval with a clear message. (needs migration #3) the admin also gets a "Reservation needs approval" notification; routine confirmed bookings do NOT notify admins.
- [ ] Alerts, Issues (maintenance reports), Messages work; the notification bell opens the shared Notifications screen.
- [ ] Settings -> Sign out works from the manager app.

### HOA Admin application (new applicant) (needs migration #4 for the server guard; the screen works without it)
- [ ] From an account with no community: submit an application with 1+ photo documents (permission prompt appears). Estimated residents must be 1..100000; "Other" role needs a description.
- [ ] Status screen shows Pending; after the platform reviewer asks for more info, the applicant sees the note, can attach more photos (existing ones are kept) and resubmit.
- [ ] Submitting a second open application for the same community name is refused with a friendly message (needs migration #4).
- [ ] Applicant has NO manager access until approved.

## 3. TenisX platform management
- [ ] Platform reviewer lands in the Platform shell (not a community shell).
- [ ] Applications list filters by status; detail shows applicant, documents (signed links open), notes.
- [ ] Request more info / reject / approve: approve creates the community and the approved admin membership atomically; the applicant becomes an admin of that community only.
- [ ] A non-reviewer who deep-links to the platform routes is bounced.
- [ ] Community interest (needs migration #5): list + status filters; open a lead, change status, write the message the requester sees, add an internal note (requester must NOT see it), link an application. Saving keeps the editor open and shows "Changes saved."

## 4. Cross-cutting
- [ ] Rotate to landscape / small iPhone (SE) / large iPhone: no clipped primary actions, 44pt targets.
- [ ] Kill and relaunch while signed in as each role: lands in the right shell.
- [ ] Background the app mid-photo-upload and return.
- [ ] Airplane mode: each screen shows an error with retry, never a blank screen or a false success.
- [ ] Two phones / sessions: an admin approval made on one is reflected on the other without a manual restart (realtime or pull-to-refresh).
- [ ] Accessibility: VoiceOver reads icon-only buttons (back, close, remove attachment).

## 5. Known blockers and open decisions (see OVERNIGHT-HANDOFF.md)
- Same-email multi-role account switching needs a product/identity decision.
- Hosted `profiles` read policy must be verified (the migrations still contain `profiles_select_authenticated`).
- PDF attachments need `expo-document-picker` (not installed); images only for now.
