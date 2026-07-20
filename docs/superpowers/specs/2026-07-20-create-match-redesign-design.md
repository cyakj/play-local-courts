# Create Match Redesign — Design Spec

**Date:** 2026-07-20
**Status:** Approved — proceeding to implementation plan
**Baseline:** branch `main`, commit `995e21b32af580f2bb1da1f0b0e8d6d57728ad01`, Supabase project `hqqlrliakttqsbalvuyz` ("TENISX REAL", the only active project — there is no separate staging/test Supabase project)

## 1. Goal

Redesign Create Match from a single-screen form with stacked bottom sheets into a step-flow wizard (Activity → Location → Date&Time → Players → Preferences → Details → Review), while fixing real gaps found during backend audit: no privacy/visibility model, no wired gender/rating preferences, self-join with no organizer approval, an unused `status='full'` state, and a `My Matches` surface that only shows two of the four states a session can be in.

**Explicitly out of scope for this pass:** HOA release-mode work, feature-flag/navigation simplification, hiding Match/Coach features, any change to `useUpcomingMatches`'s existing contract (it has 4 live consumers: Home, Me, Schedule, Match tab), Age Eligibility, Scoring Format, Practice Focus.

## 2. Product model

### Activity Type (NEW)
```ts
type ActivityType = 'match' | 'practice_hit';
```
Match = scored play (no scoring UI this pass — deferred). Practice/Hit = rallying/drills/hitting, single type, no subtypes this pass.

`format`'s existing `'casual_hit'` CHECK value is dead (unreachable from any UI, zero rows use it) and is being retired in favor of this proper column — not repurposed.

### Play Format (renamed from `format`)
```ts
type PlayFormat = 'singles' | 'doubles';
```
Controls capacity, invite limits, and valid gender-preference options.

### Match Type — removed from product surface
`match_type` (`casual`/`competitive`) is deleted from the UI, reducer, review screen, and payload entirely. The DB column stays (still `NOT NULL`) but gets a server-side default so the app never has to think about it again.

### Visibility (NEW)
```ts
type MatchVisibility = 'public' | 'invite_only';
```
- `public` (default): discoverable, self-joinable subject to eligibility rules.
- `invite_only`: excluded from discovery, self-join blocked server-side, only organizer + invited/accepted participants can read it.

No visibility column exists today — this requires a migration and RLS rewrite, not UI-only hiding.

### Gender Preference (wires up existing column)
```ts
type GenderPreference = 'all' | 'men' | 'women' | 'mixed';
```
Existing `play_with` column, already CHECK-constrained to exactly these 4 values, currently hardcoded to `'all'` and never exposed. `'mixed'` means mixed-doubles teams — only offered when `playFormat === 'doubles'`; switching to singles resets `mixed → all`.

### Skill/Rating Preference (NEW columns, reuses existing range columns)
```ts
interface SkillPreference {
  ratingSystem: 'utr' | 'ntrp' | 'none';
  minimum: number | null;
  maximum: number | null;
  enforcement: 'preference' | 'strict';
}
```
`open_match_listings` already carries both `ntrp_min/max` and `utr_min/max` simultaneously with no flag for which one a listing actually means — that's the bug this fixes. New `rating_system` and `rating_enforcement` columns are added; the app only ever writes to whichever range pair matches the selected system, leaving the other at its default (which already equals "no filter": NTRP defaults to 1.0–7.0, UTR defaults to 0–16.5 — the full legal range in each case). `ratingSystem: 'none'` clears both minimum/maximum to null in the draft and leaves both DB range pairs at their default. `enforcement: 'strict'` requires a non-`'none'` rating system; the reducer rejects setting strict without one.

### Deferred (Documented Future Enhancements — not in this pass, in any form)
1. **Age Eligibility** — no junior/adult safety infrastructure exists at all (no guardian/consent/minor columns, no age-band logic anywhere in the schema or `search_players`). Needs a separate product + security review before any implementation. Not in `CreateMatchDraft`, not in any step, no disabled placeholder.
2. **Scoring Format** — Create Match organizes play, it doesn't record results. A separate, pre-existing `matches` table (score/winner_id) belongs to an unrelated ladder/challenge system with zero wiring to `open_match_listings`. Introduce alongside real score-entry/results features later.
3. **Practice Focus** — Practice/Hit is intentionally one flat activity type this release. Subtypes (Rally, Drills, Point Play, Match Practice) can be added later without changing this UX.

## 3. Draft state model

```ts
type CreateMatchStep = 'activity' | 'location' | 'datetime' | 'players' | 'preferences' | 'details' | 'review';
const STEP_ORDER: CreateMatchStep[] = ['activity','location','datetime','players','preferences','details','review'];

interface MatchLocation { id: string | null; name: string; city: string; distance: string; source: 'hoa'|'club'|'directory'; }
interface MatchInvitee { id: string; name: string; avatarUrl: string | null; utrRating: number | null; sameCommunity?: boolean; }

interface CreateMatchDraft {
  activityType: 'match' | 'practice_hit' | null;
  playFormat: 'singles' | 'doubles' | null;
  visibility: 'public' | 'invite_only';          // default 'public'
  location: MatchLocation | null;
  date: Date;                                     // default today
  time: string | null;
  durationMinutes: number;                        // default 90
  organizerIsPlaying: boolean;                    // default true
  players: MatchInvitee[];
  genderPreference: 'all' | 'men' | 'women' | 'mixed';  // default 'all'
  skillPreference: {
    ratingSystem: 'utr' | 'ntrp' | 'none';         // default 'none'
    minimum: number | null;
    maximum: number | null;
    enforcement: 'preference' | 'strict';          // default 'preference'
  };
  note: string;
  courtReserved: boolean;
  linkedReservationId: string | null;              // not wired to a picker UI this pass
}
```

### Reducer actions
```ts
type Action =
  | { type: 'SET_ACTIVITY_TYPE'; value: 'match'|'practice_hit' }
  | { type: 'SET_PLAY_FORMAT'; value: 'singles'|'doubles' }
  | { type: 'SET_LOCATION'; value: MatchLocation }
  | { type: 'SET_DATE_TIME'; date: Date; time: string; durationMinutes: number }
  | { type: 'SET_ORGANIZER_PLAYING'; value: boolean }
  | { type: 'SET_PLAYERS'; value: MatchInvitee[] }
  | { type: 'SET_VISIBILITY'; value: 'public'|'invite_only' }
  | { type: 'SET_GENDER_PREFERENCE'; value: GenderPreference }
  | { type: 'SET_SKILL_PREFERENCE'; value: Partial<SkillPreference> }
  | { type: 'SET_NOTE'; value: string }
  | { type: 'SET_COURT_RESERVED'; value: boolean }
  | { type: 'NEXT' } | { type: 'BACK' } | { type: 'GO_TO_STEP'; step: CreateMatchStep }
  | { type: 'SUBMIT_START' } | { type: 'SUBMIT_SUCCESS'; listingId: string } | { type: 'SUBMIT_ERROR'; message: string }
  | { type: 'RESET' };
```

### Dependency reset rules (implemented in the pure reducer, unit-tested)
1. Split responsibility, not a reducer-only rule: a pure helper `wouldDropInvitees(draft, nextFormat, nextOrganizerPlaying)` (in `validation.ts`) predicts whether applying a format/organizer-playing change would exceed the new max-invitee count, without dispatching anything. `StepActivity` calls this helper before dispatching `SET_PLAY_FORMAT`/`SET_ORGANIZER_PLAYING`; if it would drop invitees, the step shows a confirm dialog first and only dispatches on confirmation. The reducer itself, once the action is dispatched, unconditionally truncates `players` to the new max-invitee count (first N kept) — it does not re-ask, since confirmation already happened in the UI layer. This keeps the reducer a pure, total function while keeping the "never silently drop a selection" guarantee in the layer that can actually show a dialog.
2. `SET_PLAY_FORMAT` to `'singles'`: if `genderPreference === 'mixed'`, reset to `'all'`.
3. `SET_SKILL_PREFERENCE({ ratingSystem: 'none' })`: force `minimum`/`maximum` to `null`, force `enforcement` to `'preference'`.
4. `SET_SKILL_PREFERENCE({ enforcement: 'strict' })`: rejected (no-op, stays `'preference'`) if current `ratingSystem === 'none'`.
5. `SET_SKILL_PREFERENCE`: if resulting `minimum > maximum`, reject the change (keep prior valid values).
6. Total format capacity is fixed by `playFormat` (singles = 2 total players, doubles = 4 total players). Max invitees = capacity − (`organizerIsPlaying` ? 1 : 0) — i.e. singles allows 1 invitee if the organizer is playing, 2 if not; doubles allows 3 if the organizer is playing, 4 if not. `organizerIsPlaying` defaults `true`, which reproduces today's exact behavior (`maxInvitees = format === 'doubles' ? 3 : 1`, organizer implicitly always a player). Changing `playFormat` or `organizerIsPlaying` re-clamps `players` to the new max invitee count (same confirm-before-truncate rule as #1).
7. Duplicate invitees are prevented at the `AddPlayersSheet` selection layer (already does this via `.some(item => item.id === player.id)` toggling) — no reducer-level duplicate check needed beyond that.

### Validation (pure, unit-tested)
- `activity`: `activityType !== null && playFormat !== null`
- `location`: `location !== null`
- `datetime`: `time !== null && isWithinCreateWindow(date)` (existing 14-day-window rule, unchanged)
- `players`: always valid (optional step)
- `preferences`: `skillPreference.enforcement !== 'strict' || skillPreference.ratingSystem !== 'none'`, and if `minimum`/`maximum` set, `minimum <= maximum`
- `details`: always valid (optional step)
- `review`: all of the above, re-evaluated

## 4. Database changes

### Column additions (additive, non-breaking — table currently has exactly 1 row, zero migration risk)
```sql
alter table open_match_listings
  add column activity_type text not null default 'match' check (activity_type in ('match','practice_hit')),
  add column visibility text not null default 'public' check (visibility in ('public','invite_only')),
  add column rating_system text not null default 'none' check (rating_system in ('utr','ntrp','none')),
  add column rating_enforcement text not null default 'preference' check (rating_enforcement in ('preference','strict')),
  add column linked_reservation_id uuid references bookings(id) on delete set null;

alter table open_match_listings alter column match_type set default 'casual';

-- Retire the dead 'casual_hit' value (zero rows use it)
alter table open_match_listings drop constraint open_match_listings_format_check;
alter table open_match_listings add constraint open_match_listings_format_check check (format in ('singles','doubles'));

-- New participant status for the approval flow
alter table open_match_listing_participants drop constraint open_match_listing_participants_status_check;
alter table open_match_listing_participants add constraint open_match_listing_participants_status_check
  check (status in ('invited','accepted','declined','requested','joined'));
```

**Duplicate participant protection**: already exists — `PRIMARY KEY (listing_id, user_id)` on `open_match_listing_participants`. Verified via `pg_constraint`, no migration needed. Practical consequence: a previously-`declined` invitee cannot be re-inserted via plain `INSERT` (hits the PK) — the create/invite/request RPCs and self-join path must use `INSERT ... ON CONFLICT` semantics or surface a clear "already invited/requested" error rather than a raw constraint-violation message.

### RLS changes

**`open_match_listings` SELECT** (replaces `"Authenticated users can discover open matches"`):
```sql
using (
  (status = 'open' and visibility = 'public')
  or creator_id = auth.uid()
  or exists (
    select 1 from open_match_listing_participants p
    where p.listing_id = open_match_listings.id and p.user_id = auth.uid()
  )
)
```
This also fixes a pre-existing gap unrelated to this feature: today, once a listing's `status` leaves `'open'`, even its own confirmed participants can no longer read it. The participant-membership clause fixes that as a byproduct of the same policy rewrite — flagged here explicitly since it's a bonus fix riding along with the required change, not scope creep introduced separately.

**`open_match_listing_participants` SELECT** (replaces `using (true)` — currently anyone can read every participant row on every listing, which would leak who's on an `invite_only` listing even though the listing itself is hidden):
```sql
using (
  exists (
    select 1 from open_match_listings listing
    where listing.id = open_match_listing_participants.listing_id
      and (listing.visibility = 'public' or listing.creator_id = auth.uid())
  )
  or user_id = auth.uid()
)
```

**`open_match_listing_participants` INSERT** (replaces `"Users can join or creators can invite"`):
```sql
check (
  (
    user_id = auth.uid() and status = 'requested'
    and exists (
      select 1 from open_match_listings listing
      where listing.id = open_match_listing_participants.listing_id
        and listing.status = 'open'
        and listing.visibility = 'public'
        and listing.creator_id <> auth.uid()
        and (
          listing.rating_enforcement = 'preference'
          or listing.rating_system = 'none'
          or (
            listing.rating_system = 'utr' and exists (
              select 1 from profiles p where p.id = auth.uid()
                and p.utr_rating is not null
                and p.utr_rating between listing.utr_min and listing.utr_max
            )
          )
          or (
            listing.rating_system = 'ntrp' and exists (
              select 1 from profiles p where p.id = auth.uid()
                and p.ntrp_rating is not null
                and p.ntrp_rating between listing.ntrp_min and listing.ntrp_max
            )
          )
        )
    )
  )
  or (
    status = 'invited' and added_by = auth.uid()
    and exists (select 1 from open_match_listings listing where listing.id = open_match_listing_participants.listing_id and listing.creator_id = auth.uid())
  )
)
```
Note: a user with **no rating on file** is not silently treated as eligible under `strict` — the `between` checks require `utr_rating`/`ntrp_rating is not null` first, so a null rating fails the strict check (falls through to no matching clause, INSERT rejected). Organizer-initiated invites (`status='invited'` branch) are unaffected by strict enforcement — organizers can always explicitly invite past a strict range, per the approved design; the UI should show a warning when doing so, but the DB does not block it.

**New UPDATE policy** (organizer approves a request):
```sql
create policy "Creator can approve a join request" on open_match_listing_participants
for update
using (
  status = 'requested'
  and exists (select 1 from open_match_listings listing where listing.id = open_match_listing_participants.listing_id and listing.creator_id = auth.uid())
)
with check (status = 'joined');
```
Decline of a request reuses the existing `"Creator can remove or reopen a participant slot"` DELETE policy — no new policy needed. Requester withdrawal reuses the existing `"Participant can leave a match"` DELETE policy — no change needed.

### RPC design

**`create_match_listing(listing jsonb, invitee_ids uuid[], organizer_playing boolean) returns uuid`**
- `SECURITY DEFINER`, derives `creator_id` from `auth.uid()` internally — never trusts a client-supplied creator id.
- Single transaction: insert the listing row, insert the organizer's own participant row (`status='joined'`) if `organizer_playing`, insert one `status='invited'` row per invitee id.
- Idempotency, scoped to what's practical without a schema change: a server-side idempotency-key column would be a new persistence mechanism beyond what was approved, so it's not part of this pass. The practical mitigation is client-side — `useCreateMatchDraft.submit()` guards on its own `submitting` state (already part of the approved draft model) so a double-tap or a re-render can't fire the RPC twice concurrently; a genuine network-level retry (request succeeded server-side but the response was lost) would still be able to create two listings. That residual gap is accepted for this pass — flagging it here rather than silently deciding it away, since if you want true server-side idempotency later, that's a small additive follow-up (one nullable unique column + an `ON CONFLICT` clause), not a redesign.
- Explicit error returns (as Postgres exceptions with a stable `errcode`/message the client maps to friendly copy, not raw constraint text):
  - duplicate invitation/request → distinguishable from a generic failure (maps to the existing PK constraint).
  - invalid capacity (invitee_ids exceeds format capacity) → rejected before insert.

**`approve_match_participant(listing_id uuid, participant_user_id uuid) returns void`**
- `SECURITY DEFINER`, verifies `auth.uid()` is the listing's `creator_id` (server-side, not client-trusted) → else raises an "unauthorized" error.
- Verifies the target row's current `status = 'requested'` → else raises "participant request no longer pending" (covers the double-approval / already-declined-elsewhere race).
- Locks the listing row (`select ... for update`) to make the capacity check+transition atomic against a concurrent approval racing past it.
- Recomputes the reserved-slot count using the **same rule the app already uses** for `openSlots` display in `useUpcomingMatches.ts` (`status <> 'declined'` — i.e. `joined`/`accepted`/`invited` all reserve a slot, since an organizer-sent invite is already earmarked even before it's answered) **plus this feature's one new exclusion**: `'requested'` rows do not reserve a slot, since a pending request is precisely not-yet-reserved. So capacity used = count where `status in ('joined','accepted','invited')`. If listing is already at total format capacity, raises "listing already full" and does not update the participant row.
- Updates participant to `status='joined'`; if that fill was the last open slot, updates listing `status='full'` in the same transaction.

Both RPCs: on success, the DB mutation commits first; the caller (`useCreateMatchDraft.submit()` / the approval action) then fires notifications in a `try/catch` that **cannot** roll back or fail the already-succeeded mutation — a notification failure is caught, logged, and surfaced to the UI as a non-blocking warning ("Match created, but we couldn't notify everyone — you can still reach them from the match page"), never as a hard error on the create/approve action itself. This mirrors the existing pattern in `sendMatchInviteNotifications` (`lib/matchInvites.ts`), which already treats its own message-insert and email-send failures as logged-not-thrown.

### Migration execution order
1. Additive columns + `match_type` default (one migration file), then format-constraint tightening (a second, immediately-following file) — both additive/safe, run back to back.
2. Participant status CHECK addition (`'requested'`).
3. `open_match_listings` SELECT RLS rewrite.
4. `open_match_listing_participants` SELECT + INSERT RLS rewrite.
5. `open_match_listing_participants` approve UPDATE policy.
6. `create_match_listing` RPC.
7. `approve_match_participant` RPC.

### Rollback notes
Migrations are intended forward-only (standard for this project — no existing migration in `supabase/migrations/` has a paired down-migration). If a rollback is ever needed:
- Steps 3–5 (RLS) roll back cleanly by re-creating the prior policy definitions (captured verbatim earlier in this spec's audit — the original `USING`/`CHECK` expressions are quoted above each replacement).
- Step 2 (status CHECK) rolls back by dropping and re-adding the constraint without `'requested'` — **only safe if no row has that status at rollback time**; if the approval feature has been used, existing `'requested'` rows would violate the reverted constraint and must be resolved (approved, declined, or manually reset) before rollback.
- Step 1 (additive columns) rolls back via `drop column` — safe at any time, no dependent data loss beyond the columns themselves, since nothing else references them (mirrors the confirmed test row).
- Steps 6–7 (RPCs) roll back via `drop function` — safe once client code no longer calls them.

## 5. Component architecture

### File structure
```
supabase/migrations/
  <ts>_create_match_activity_visibility_rating_columns.sql
  <ts>_create_match_tighten_format_constraint.sql   (bundled into the same file as above per execution-order step 1)
  <ts>_create_match_participant_status_requested.sql
  <ts>_create_match_rls_listings_select.sql
  <ts>_create_match_rls_participants_select_insert.sql
  <ts>_create_match_rls_participants_approve_update.sql
  <ts>_create_match_rpc_create_listing.sql
  <ts>_create_match_rpc_approve_participant.sql

src/hooks/createMatchDraft/
  types.ts
  reducer.ts             — pure createMatchReducer(state, action); all dependency resets
  validation.ts           — pure isStepValid(), isDraftValid()
  payload.ts              — pure buildListingPayload(), buildInviteeIds()
  useCreateMatchDraft.ts    — useReducer + memoized per-concern slices/setters + submit()
  index.ts

src/lib/matchRequests.ts   — sendMatchJoinRequestNotification / sendMatchRequestDecisionNotification (mirrors matchInvites.ts's logged-not-thrown pattern)

src/components/match/steps/
  StepActivity.tsx  StepLocation.tsx  StepDateTime.tsx  StepPlayers.tsx
  StepPreferences.tsx  StepDetails.tsx  StepReview.tsx  StepProgress.tsx

src/app/match/new.tsx        — rewritten, thin orchestration container
src/hooks/useMyMatches.ts    — NEW, separate hook (useUpcomingMatches is untouched)
src/app/my-matches.tsx       — NEW screen: Upcoming / Pending / Past / Cancelled
src/components/match/MyMatchesPanel.tsx  — header becomes a link into /my-matches, otherwise unchanged
src/components/match/MatchDiscovery.tsx  — query gains .eq('visibility','public'); self-join insert becomes status:'requested'; copy already says "Request sent" (was previously inaccurate, now true)

tests/create-match-logic.spec.ts   — pure logic (reducer/validation/payload/dependency-resets), Playwright Node runner, mirrors tests/coach-logic.spec.ts
tests/create-match-flow.spec.ts    — E2E step flow, Playwright browser runner, mirrors tests/home.spec.ts / tests/profile-settings.spec.ts
```

### Responsibilities
- **`match/new.tsx`**: owns `useCreateMatchDraft()`; renders `StepProgress` + active step in an animated transition container; Back/Next/Close chrome; hardware/browser back → `goBack()` or discard-confirmation (only when `hasMeaningfulSelections`); wires Review's submit to `submit()`; on success navigates to `/my-matches` (Upcoming, new listing highlighted); on notification-only failure shows a non-blocking toast/banner.
- **Each `Step*`**: presentational, step-local UI state only (search text, sheet-open booleans). No Supabase calls of its own beyond what reused components (`AddPlayersSheet`) already own.
- **`useCreateMatchDraft`**: reducer, validation, dependency resets, payload construction, calls `create_match_listing` RPC, then fires invite notifications non-blockingly, submission state/errors.
- **UI build note**: step components will be built using the `taste-design` and `ui-ux-pro-max` skills per your instruction, applied at implementation time for each step's visual design — not part of this architecture doc's scope to pre-specify pixel-level styling.

## 6. My Matches

New `useMyMatches(userId)` hook (separate from `useUpcomingMatches`) backing a new `/my-matches` screen with 4 tabs:
- **Upcoming**: confirmed participation (`status in ('joined','accepted')`) or organizer, `match_date >= today`, `status != 'cancelled'`.
- **Pending**: outgoing invitations (sent, `status='invited'`), incoming invitations (received, `status='invited'`), outgoing requests (sent, `status='requested'`), incoming requests (received on own listings, `status='requested'` — organizer must act). Incoming requests get inline Approve/Decline actions calling `approve_match_participant` / the existing delete-based decline.
- **Past**: `match_date < today`, `status != 'cancelled'`.
- **Cancelled**: `status = 'cancelled'`, any date.

`MyMatchesPanel` (the existing embedded teaser on the Match tab) keeps showing Invitations + Upcoming as it does today, with its header now linking into the full `/my-matches` screen — not replaced, not duplicated as a separate "Upcoming Matches" destination.

## 7. Test plan

- **`tests/create-match-logic.spec.ts`** (Playwright Node runner, dependency-free logic mirrored into the test file per the existing `coach-logic.spec.ts` convention — no Jest/Vitest/RN-testing-library added): every reducer action; dependency resets (format-switch confirmation-gated truncation, mixed→all reset, skill-preference clearing/rejection rules); per-step validation; payload mapping draft→insert shape.
- **`tests/create-match-flow.spec.ts`** (Playwright browser E2E, mirrors `home.spec.ts`/`profile-settings.spec.ts`): full happy path singles + doubles; Next disabled until step valid; format-switch-with-invitees shows confirmation, doesn't silently drop players; weather-depends-on-location messaging; `invite_only` hidden from `MatchDiscovery`; strict-rating self-join blocked / preference-mode allowed; Review tap-to-edit; back-button/discard-confirmation; submit error surfaces inline; My Matches shows a newly-created listing in Upcoming and a sent invite in Pending.
- **Existing suite**: run the full existing Playwright suite (`tests/*.spec.ts`) alongside the new files to catch regressions in unrelated flows touched incidentally (`MatchDiscovery`, `MyMatchesPanel`).

## 8. Implementation safeguards (from approval message, restated as commitments)

- Baseline recorded before any migration: branch `main`, commit `995e21b32af580f2bb1da1f0b0e8d6d57728ad01`, target Supabase project `hqqlrliakttqsbalvuyz` ("TENISX REAL" — the only active project; there is no separate staging project to test against first).
- **Migrations will not be applied until the code and migration files have been reviewed and the target project explicitly reconfirmed** — this is a hard stop before step 4 of the implementation plan (see plan doc), not a formality.
- RPCs return explicit, user-safe errors for: listing already full; participant request no longer pending; unauthorized approval; duplicate invitation/request; strict rating eligibility failure.
- Duplicate participant protection verified already present (`PRIMARY KEY (listing_id, user_id)`) — no new constraint.
- Notification failures never roll back or fail an already-successful listing-creation or participant-approval mutation.
- This spec's migration section includes rollback notes despite migrations being forward-only by project convention.

## 9. Stop-and-ask triggers

Per your instruction, implementation will pause and ask rather than proceed if it surfaces a need for: a new auth/role model; broad changes to the existing court-reservation architecture; changes to unrelated Match, Coach, HOA, or profile flows; a destructive production data migration; or any deviation from this approved state model.
