# Greens V1 — iPhone V1 fixes (branch `greens-iphone-v1-fixes`)

Built on `greens-sdk57-upgrade` @ `b80fba0` (Expo SDK 57, RN 0.86.3). `main`, `greens-v1`
and the SDK upgrade branch are untouched. **Nothing is pushed and no migration is applied.**

## 1. Root causes and resolutions

| # | Reported | Root cause (verified) | Resolution |
|---|---|---|---|
| 1 | Documents: View/Download → `404 Bucket not found / NoSuchBucket` | `hoa_documents.file_url` stores `/storage/v1/object/public/hoa-documents/…`, but the `hoa-documents` bucket is **private**. The public endpoint answers `400 Bucket not found` (reproduced with curl). Buckets, both files (284,151 B and 59,416 B) and the "Approved HOA members can read HOA documents" storage policy all exist and are correct. | `src/lib/communityDocuments*.ts`: extract the object path, `createSignedUrl` (5 min) as the signed-in resident. View → in-app browser (PDF/image); Office files and Download → cache + iOS share sheet ("Save to Files"). No bucket/policy change. |
| 2 | Documents screen unfinished, emoji icons | Legacy screen | Rewritten: vector icons, type/size/date, distinct View + Download, search, category chips, loading/empty/error/notice states, theme-aware (light + dark). |
| 3 | Report Issue opens the form directly | Entry from a court/amenity card (`?courtId=…`) rendered a form-only screen (`isCourtReport`) that hid the Reports list | Reports overview first (list, filters, status, category, date); facility card → "Report an issue with <facility>" CTA → form → confirmation with **View Report** / **Back to Reports**. Scoped to the active community. |
| 4 | Court `pending`, pool `confirmed` | **Correct by configuration**: `amenity_rules.requires_admin_approval` is `true` for The Greens Court, `false` for Greens Pool; `enforce_amenity_booking_rules` forces `pending` server-side. | Left as is. Admin UI now explains the toggle and lists pending requests with **Approve / Decline**. |
| 5 | *(found while investigating #4)* resident can self-approve | `"Users can cancel their own bookings"` is `FOR UPDATE USING (auth.uid()=user_id)` with no `WITH CHECK`, and the trigger returns early for non-moving updates → a resident could `PATCH {"status":"confirmed"}` on their own pending booking. No `rejected` status existed. | **Migration (not applied)**: `enforce_booking_status_transitions` trigger — owners may only cancel; admins pending→confirmed/rejected/cancelled; approval re-checks blockouts; reviewer recorded. Source-level finding; not exploited live. |
| 6 | `<24h` chip; cancellation cutoff | Chip is just the cutoff printed on a disabled-looking pill. Cutoff math was wrong in **both** places: client used device clock and a **UTC** "today" (bookings vanish from Upcoming after 8 PM Puerto Rico time); server compared PR wall-clock start to `now()::timestamp` (**UTC**, 4 h ahead of PR). | `communityTime.ts` (America/Puerto_Rico) + plain-language reasons; server fix in the same migration. |
| 7 | Repeated cancelled pool cards | Distinct rows (different ids/timestamps) created by repeated automated Playwright runs on 2026-09-22/23 and today — not duplicates. | Nothing deleted. List now paginates History and each card opens a details screen. |
| 8 | Location search: "Could not search locations. Check your connection" | The Mapbox token is valid but **URL-restricted**: every request without an allowed `Referer` returns **403 Forbidden** (reproduced; with `Referer: https://tenisx.ai/` it returns results). Native `fetch` sends no Referer. The app mapped *any* failure to "check your connection". | Typed failure kinds (offline / denied / rate-limited / server) with honest wording; automatic fallback to a bundled list of Puerto Rico's 78 municipios (US Census Gazetteer, public domain) so "Dorado" is always selectable and saves/restores. **Still needs your action** to restore full address search — see §4. |
| 9 | Settings leave without saving | No dirty tracking on Notifications / Privacy; Edit Profile had `dirty` but no prompt | `useUnsavedChangesGuard`: Save Changes / Discard Changes / Keep Editing for header back, iOS swipe-back, Android back, router calls. Dirty = differs from persisted (toggle on+off = clean). Native `Alert`, web modal. |
| 10 | Help & Support dead links, blank square | `tenisx.ai` is a **GoDaddy parking page**: every path (`/faq`, `/terms`, `/privacy`, `/licenses`) returns the same 114-byte stub redirecting to `/lander`. The blank square is `<View style={styles.backBtn} />` (36×36, `rgba(255,255,255,0.12)` fill) used as a header spacer on Settings, Account, Change Password and Help. The repo's FAQ/Terms/Privacy pages are "coming soon". `tenisx.ai` also has **no MX record**. | FAQ screen (how-to answers about verified app behaviour only), Terms/Privacy routes with an explicit "not published yet" state (config-driven URL), generated Open Source Licenses (604 packages, 240 distinct license texts), Contact Support with a no-mail-app fallback. Blank squares removed (shared header). |
| 11 | Oversized floating blue gear | **Not an app component**: no such view in `src/` and `expo-dev-client` is not installed. It is the Expo Go / dev-tools overlay; absent in production builds. Not verified on the physical device. | No change. |
| 12 | Universal header | Resident header showed only the community name text + "Powered by TenisX" | TenisX logo + active community identity (logo, else name) on resident, inner and admin headers; see §3. |

## 2. Database

* **Created, NOT applied:** `supabase/migrations/20261012190000_greens_v1_booking_approval_workflow.sql`
  (adds `rejected` status, `reviewed_by/at`, `booking_rejected` notification type, status-transition
  trigger, Puerto-Rico-time cancellation window). Historical rows untouched.
* **Verification script:** `supabase/tests/booking_approval.sql` — one transaction that always ends in an
  exception (nothing can commit); impersonates the resident/admin test accounts; 10 checks.
* `hoas.logo_url` already exists and is used first. Dorado Beach's logo currently ships bundled, keyed by its
  `hoas.id` (`f222b3de-…`, whose name in the DB is **"DBE"**). Preferred long-term path: upload the logo to the
  public `branding` bucket and set `hoas.logo_url` (needs your approval).
* App code does **not** depend on the unapplied migration (the detail screen no longer selects `reviewed_at`;
  Decline shows a clear message until `rejected` is allowed).

## 3. Branding

* Assets in `assets/branding/`: `tenisx-logo.png` (official transparent logo, tight-cropped),
  `dorado-beach-logo.png` (transparent, derived from the supplied opaque-black PNG by edge-coverage alpha — artwork
  colours unchanged), and `source/` with both originals.
* **Report:** the supplied Dorado Beach image has a baked-in opaque black background (transparent version made);
  the supplied TenisX image has an opaque near-black (#18191E) background — the repo already had the official
  transparent logo, which is used instead.
* The "supplied files in `assets/branding/`" did not exist in the repo; they were taken from the images pasted in chat.
* Observation (not changed — logos are not to be recoloured): Dorado Beach's dark-bronze wordmark has low contrast on
  the app's navy header. A lighter-bronze or white-on-dark variant would read better.

## 4. Needs you

1. **Resident test password.** `TEST_EMAIL` (28-027@sanignacio.pr) in `.env` now returns `invalid_credentials`
   (its `last_sign_in_at` is today 17:51 UTC — probably changed during iPhone testing). The full resident suite
   (courts / reports / docs / profile-settings) and the Save-path tests could not be run against it.
2. **Approve applying the migration** (and running `supabase/tests/booking_approval.sql` in its rolled-back form).
3. **Mapbox:** remove the URL restriction on the token, or issue a token that works from native apps, or approve an
   edge-function proxy so the secret stays server-side. Until then the municipio fallback is used.
4. **Terms of Service / Privacy Policy:** publish approved documents and set `LEGAL_DOCUMENTS.*.url` in
   `src/config/support.ts`. **Apple requires a privacy-policy URL for App Store submission.**
5. **Support mailbox:** `support@tenisx.ai` cannot receive mail (no MX). Configure it or change `SUPPORT_EMAIL`.
6. Review the FAQ copy in `src/app/faq.tsx` (product facts only; no HOA policies).
7. Optional: store the Dorado Beach logo in `hoas.logo_url`; confirm "DBE" ↔ "Dorado Beach".

## 5. Not done / not verified

* No physical-iPhone verification of anything. In-app browser, share sheet, `Alert` dialog and Dynamic Type are
  untested on device.
* Notification screen still lists tennis-only toggles (Match Invitations, Lesson Reminders, Coach Messages) in
  Community mode — pre-existing, out of scope, flagged.
* The advance-booking window in `enforce_amenity_booking_rules` still uses UTC `current_date` (up to 4 h skew at
  day boundaries); left alone to avoid touching the blockout-fix function.
* Licenses list is the full production dependency tree (includes build-tooling such as Metro); 83 packages ship no
  LICENSE file in `node_modules` — their declared SPDX id and repository are shown, no text is invented.
* Test data: the repeated 2026-09/10 Playwright runs left cancelled pool bookings and one confirmed Greens Pool
  booking (2026-10-13 13:00, resident) in the live DB.

## 6. Retest on iPhone

1. `git checkout greens-iphone-v1-fixes`, `npx expo start --go` (SDK 57 Expo Go), scan the QR code.
2. Header: Home / Reserve / Me → TenisX logo + "The Greens" name; switch to Dorado Beach → its logo.
3. Community → Documents & Rules → **View** (PDF opens in-app) and **Download** (share sheet → Save to Files).
4. Home → Report Issue → Reports list → **+** → submit → **View Report**. From a court card → CTA → form.
5. Me → My Reservations → open a card; try Cancel on one inside the cutoff (message explains why).
6. Me → Edit Profile → type "Dorado" → select → Save → reopen.
7. Me → Settings → Notifications → toggle → Back → Save / Discard / Keep Editing.
8. Me → Help & Support → FAQ, Terms (unpublished state), Open Source Licenses, Contact Support.
