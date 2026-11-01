# Resident UI polish sprint - report (2026-11-01)

Local only. Nothing pushed, deployed, applied or written to TENISX REAL. Start: branch `v1/overnight-integration` @ `abd56d2`. Feature commit `d4baba9`, review-fix commit and docs commit listed at the end.
Status words used below: **Implemented** (code written, typechecks, static/logic tests pass) / **Verified** (proven by something stronger than that) / **Blocked** / **Deferred**. Nothing in this sprint is **Verified on a device**: the tactile parts can only be judged on your iPhone (checklist in section 11).

## 1-2. Observed issues and whether they reproduce in the current source
| # | Reported | In source before the sprint? | Status now |
|---|---|---|---|
| 1 | Reservation sheet too much text (large legend, 2 warnings, boxed duration row) | Yes: 6 long legend labels + hours sentence + "can't be shown yet" sentence + 2-line approval warning + separate "Singles - 90 min" row | Implemented |
| 2 | "Pending approval" / "Request expired" badge collides with the chevron | Yes: `cardBody` had no `minWidth:0`, title row was `space-between` with no wrap, chevron had no reserved slot, badge had no max width | Implemented |
| 3 | Time picker looks like a flat list | Yes: 52pt rows with only scaleY/opacity falloff, no curvature, no masks, focus drawn on whichever row re-rendered | Implemented (custom drum, section 4) |
| 4 | Haptics / sound | Not present; `expo-haptics` and `expo-audio` were not even installed | Implemented, **unverified on device** |
| 5 | Community Pulse "COMMUNITY" label, low emphasis | Label already read "COMMUNITY PULSE" but was muted, no icon | Implemented |
| 6 | Home Community Pulse count | **Home actually queried `limit(2)` and rendered two** - your correction says it should stay ONE. It is now exactly one. | Implemented |
| 7 | Urgent coral dot | Not possible: `hoa_announcements` has **no urgency column** | Implemented in app; **needs migration 20261101100000 (not applied)** |
| 8 | Maintenance/service announcements | Table had no category either; no authoring UI exists in the native app | Display Implemented; category needs the same migration; **authoring Deferred** |
| 9 | Old black Announcements / Survey Results screens | **Not reproduced**: both already use `theme.pageBg/cardBg`, the inner Header, back navigation, loading/empty/error states | No change needed; judge on device in light mode |
| 10 | Profile photos not working | Stage D (`20261030120000`) is not applied | **Blocked** (section 9) |

## 3. Changes
**Reservation sheet** (`src/app/(resident)/courts.tsx`, `src/components/ui/ReservationLegend.tsx`, new `src/lib/reservationCopy.ts`)
- Legend: one wrapping row of 16pt icon swatches with one-word labels (Available, Selected, Reserved, Blocked, Mine, Pending; schedule adds Past). Each item keeps its FULL description as its accessibility label ("Reserved by someone else", "Blocked by management", "My request, pending approval"...).
- Removed the long hours sentence and the permanent "can't be shown yet" sentence. One short line instead: `Available to book: 7 AM-7 PM` (the amenity's own hours), plus `Times in Pacific Time` only when the phone zone differs, plus (only when the server lacks the busy-times function) `Other residents' bookings aren't shown yet, so a time may be taken.`
- Approval notice is now `Approval required · Your time is held until reviewed or it starts.` - shown **only after a successful `get_amenity_busy_times` answer** (that function ships with the exclusive-holds migration). Otherwise: `Approval required · An administrator will review your request.` (no hold promise). Codex caught that a failed network read must not count as "enforced"; fixed with a separate `busyHolds` flag.
- The "Singles - 90 min" box is gone; the duration is a quiet label on the Singles/Doubles row. Fixed header/footer, wheel is the only scroller (unchanged).
**My Reservations** (`src/app/my-reservations.tsx`, `src/components/ui/ReservationBadge.tsx`): card body `minWidth:0`; title and badge wrap (badge drops under the title when they do not fit, never overlaps); court name up to 2 lines; chevron in its own 20pt non-shrinking slot; badge `maxWidth:100%` with a wrapping label and no font shrinking. The badge is shared, so Home, reservation detail and manager schedule get the same bound; those already place it on its own line (audited).
**Community Pulse** (`src/app/(resident)/index.tsx`, `src/lib/announcements*.ts`, `src/components/community/AnnouncementMeta.tsx`, `community.tsx`, `announcements.tsx`): exactly one item (urgent first, else newest; collapses when none); heading is full-contrast with a small Activity (pulse) icon; small coral dot (`Colors.coral`) only when `is_urgent` is true; "Maintenance"/"Service" chip from `category`; the same dot/chip in the Community and full Announcements lists. Urgency is metadata only - a test proves "URGENT" in the title does nothing and maintenance is never auto-urgent. Individual maintenance **reports** are not in the pulse (a test asserts it).
**Settings** (`src/app/settings.tsx`): "Time picker feedback" with Haptics (default on) and Sound (default OFF) switches, persisted.

## 4. The time wheel - decision and design
Compared (A) the native iOS picker vs (B) a custom animated wheel. **Chose B** because each row needs a weather icon + temperature, availability colour/state, a disabled/"Reserved/Blocked/Yours/Pending/Overlaps" pill and a Select action; `UIDatePicker`/a native wheel renders plain text rows only and would lose all of that and the correct overlap/duration handling. No new dependency: it uses `react-native-reanimated` 4.7.1 / `react-native-worklets` 0.13 (already installed, in Expo Go) and `react-native-svg`.
- 44pt rows, ~7-9 visible (fills the sheet's height). Per-row UI-thread style from the scroll offset: `perspective` + `rotateX` (21 deg per row, max 62), scale 1 -> 0.88, opacity 1/.82/.55/.30/.10, time text colour interpolating to muted. Fixed centre band (neutral) so the focus indicator never moves; SVG top/bottom fade masks. Light-theme colours only; no heavy shadow.
- `snapToInterval=44`, `decelerationRate=fast`; rows sit at `index*44` offsets so a resting wheel is always on a whole 30-minute row.
- **Focus is not selection.** The centred row is only highlighted by the band. A time is booked-selected only via its Select button (blue border + check). Disabled rows have no button. Duration/overlap logic (`computeSlots`) is untouched.
- Re-render/refresh no longer re-styles by React state (the old code re-rendered rows on every index change); landing on the selection after a data refresh is a silent programmatic scroll.
**Not verified:** how the curvature actually looks on an iPhone (rotateX sign chosen from the CSS/RN convention - top edge of rows above the centre tilts away). If it looks inverted or too strong, tune `DRUM_DEG_PER_ROW` / `DRUM_MAX_DEG` in `TimeSlotWheel.tsx` (one-line change).

## 5. Haptics and sound
- `expo-haptics` ~58.0.7: `selectionAsync()` per centred-row change caused by the user's finger, throttled to one per 40 ms (`decideFeedback`, pure, tested); `impactAsync(Light)` on an intentional Select, only when haptics are on. Nothing fires on mount, refresh, re-render or programmatic scroll. Failures (Taptic Engine off, Low Power Mode, camera active - iOS silently does nothing) are swallowed.
- `expo-audio` ~58.0.11 (included in Expo Go per the v58 docs): optional tick, **off by default**, own throttle (70 ms), one reusable player (`seekTo(0)` then `play()`), `playsInSilentMode:false` (respects the silent switch), `interruptionMode:'mixWithOthers'` (does not stop other audio), no background session, config plugin set to `microphonePermission:false`. First tick after enabling is warmed up, so the first scroll may be silent. The sound is an original 22 ms synthesized click I generated (`assets/sounds/picker-tick.wav`, 2 KB) - no Apple asset. Sound is never required to understand anything.
- Compatible with Expo Go: yes per Expo v58 docs; the iOS bundle exports successfully (`expo export --platform ios`), `expo install --check` shows only the 3 pre-existing patch updates. **Not tested on a device.**

## 6. Differences from the brief
- Legend uses "Mine"/"Pending" etc. exactly as suggested; "Open"->kept "Available" for continuity with existing tests.
- Wheel is custom (not native), reasons above. No excessive 3D.
- Settings switches added so sound can be disabled (the brief required a simple way).
- Part 5/6 "limit to two announcements" was overridden by your correction -> **one**.
- Browser screenshot comparisons: not done (section 7).

## 7. Tests
- Logic suite (`playwright.logic.config.ts`, Node): **600 passed, 0 failed** (was 558 before this sprint + 42 new in `tests/ui-polish-logic.spec.ts`). Two older assertions were changed because the copy they pinned was deliberately replaced (`workstream-b-logic` legend test, `reservation-integrity-logic` copy test); four mocked-browser specs had old legend wording updated (`courts.spec`, `reservation-holds-mocked-ui`, `reservation-status-mocked-ui`, `slots-mocked-ui`). These were intent changes, not weakened checks: every state still has to be present, now via visible short label + full accessible label.
- Covered: wheel snapping math, feedback throttling/no-fire cases, prefs defaults, copy/promise rules, legend, badge/chevron layout rules (static), Community Pulse one-item/urgency/category/migration shape, Expo deps/audio mode, worklet directive.
- TypeScript: no errors in touched files (only the repo's pre-existing casing/`/explore` errors).
- iOS export: succeeded.
- **Not run:** the browser (Playwright) suites. The sign-in setup step timed out loading `http://localhost:8081/login` (dev server cold/bundling, ~2.5 GB free memory), so I stopped rather than loop. The four updated mocked specs are therefore **edited but not executed**. No screenshot comparisons. Narrow-iPhone / large-font behaviour of My Reservations is justified by layout rules and static tests only, not rendered.
- Not tested anywhere: real Supabase, a physical iPhone, Storage.

## 8. Independent Codex review (fresh read-only session on `d4baba9`)
4 findings, all fixed: (P1) `centeredIndex` was called from the UI-thread scroll worklet without being a worklet (would throw on device) -> `'worklet'` directive + test; (P2) the hold promise could appear after a failed (non-"missing function") availability read -> `busyHolds` set only on success; (P2) "held until reviewed" ignored expiry at start time -> wording now says "or it starts"; (P2) the Select confirmation haptic ignored the haptics switch -> guarded. The fixes were not re-inspected by Codex. Codex could not run the app on a device either.

## 9. Profile photos - blocker tracked (no change to the blocker)
Add/replace/remove, signed URLs and avatar surfaces (Me, Edit profile, account menu, header via `ProfileAvatar`/`useProfileIdentity`) were audited last session and are unchanged. **They cannot work until Stage D (`20261030120000`) is applied**; it is NOT applied, and nothing here weakens Storage, uses the public `avatars` bucket, or bypasses the migration. Required before hosted deployment: (1) fresh backup, (2) restore verified, (3) Gate-1 read-only SQL (`docs/MIGRATION-PLAN-2026-11-01.md` section 2), (4) rehearsal, (5) your explicit approval, (6) live Expo Go photo smoke test (`docs/PROFILE-PHOTO-DEPLOYMENT-CHECKLIST.md`). Do not call photos fixed until step 6 passes.

## 10. Backend / migration dependencies
| Feature | Depends on | Behaviour without it |
|---|---|---|
| Hold promise in the approval notice, other residents' reservations on the wheel | `20261031100000` + `20261031110000` (E, F) | "An administrator will review your request." and "Other residents' bookings aren't shown yet..." |
| Coral urgent dot, Maintenance/Service chip | **new** `20261101100000_announcement_urgency_and_category.sql` (additive: `is_urgent boolean default false`, `category text default 'general'` + CHECK; rollback in `supabase/rollbacks/`; no policy changes; no dependency on other migrations; NOT applied, NOT rehearsed) | App reads without the columns: no dot, no chip, everything "general" |
| Creating urgent/maintenance announcements | No native authoring screen exists (legacy `src/pages/CMCommunityDashboard.tsx` inserts announcements; it is Stage 2 and untouched). After the migration, set the columns in the Supabase editor, or ask for an admin authoring screen (Deferred) | - |
| Profile photos | Stage D | blocked, honest error |
Add the announcement migration to the staged plan as an independent, low-risk stage (suggested position: with Stage G, after Stage D; Gate-0 backup still applies).

## 11. Physical iPhone acceptance checklist (Expo Go, light mode)
Reservation sheet: [ ] open an approval-required amenity - one short notice, no long paragraphs; [ ] legend fits on one or two lines on the smallest phone you own, labels readable; [ ] "Available to book: ..." matches the amenity's hours; [ ] before the holds migration: notice does NOT say "held"; [ ] Singles/Doubles + "90 min" on one row.
Wheel: [ ] 7-9 rows visible, centre row clearly dominant, rows above/below curve away, no big empty white area; [ ] slow scroll, fast flick, reverse direction: always rests exactly on a row (no half rows), no jumps; [ ] a centred row is NOT selected until you tap Select; [ ] Reserved/Blocked/Yours/Pending rows cannot be selected; [ ] weather icon + temp still show for outdoor amenities; [ ] curvature direction looks right (not inverted) - if not, tell me.
Haptics: [ ] slow scroll: one light tick per row; [ ] hard flick: ticks coalesce, no buzzing; [ ] pull the list while it is not moving (no ticks); [ ] open the sheet / change date (no tick on load); [ ] Select a time: one slightly firmer tap; [ ] Settings -> Time picker feedback -> Haptics off: no ticks, no select tap; [ ] Low Power Mode on: no haptics is normal (iOS), nothing breaks; [ ] camera/dictation active: none, nothing breaks.
Sound: [ ] default OFF (silent); [ ] switch Sound on, scroll: a soft tick per row, not overlapping, no stutter (the very first tick may be skipped); [ ] ring/silent switch on silent: no sound; [ ] music playing in another app: keeps playing; [ ] Sound off again: silent.
My Reservations: [ ] long amenity name + "Pending approval": badge sits under the name, chevron untouched; [ ] "Request expired" in History same; [ ] Cancelled / Declined / Completed / In progress / Confirmed all readable; [ ] iOS Settings -> Display -> Text Size larger + Bold Text: no overlap, whole card still taps.
Community Pulse: [ ] Home shows ONE announcement with the "COMMUNITY PULSE" heading + pulse icon; [ ] none -> the card is gone; [ ] after the announcement migration + one urgent row: coral dot on that one only; a "pool closed" announcement not marked urgent shows no dot; a maintenance one shows a Maintenance chip; [ ] tap -> Announcements list (light background, back returns to Home); [ ] Survey Results opens in the same light style and Back returns to Announcements.
Photos (after Stage D only): see the photo checklist.

## 12. Outstanding
Browser suites and screenshots not run; rotateX tuning may be needed after seeing it on a phone; announcement authoring UI deferred; hosted checks/backup/migrations unchanged and still NO-GO per `docs/MIGRATION-PLAN-2026-11-01.md`; Part-9 "light-mode screenshot comparisons where feasible" not feasible this session.

## 13. Commits
See `git log --oneline abd56d2..HEAD`.
