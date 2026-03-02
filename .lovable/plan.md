

# Competition Edge Cases - Implementation Plan

This is a very large feature set spanning 10 distinct items across database schema, UI components, edge functions, and automated logic. Given the scope, I recommend implementing this in phases.

## Phase 1: Database Schema Changes

A single migration to add all required columns and tables:

### New columns on `ladders` table:
- `max_freeze_days` (integer, default 30) - for freeze mode
- `min_players_required` (integer, nullable) - minimum player threshold
- `score_photo_required` (boolean, default false) - future-proofing

### New columns on `ladder_teams` table:
- `is_frozen` (boolean, default false)
- `freeze_start_date` (timestamptz, nullable)
- `freeze_end_date` (timestamptz, nullable)
- `walkover_losses` (integer, default 0)
- `dispute_strikes` (integer, default 0)
- `is_withdrawn` (boolean, default false)
- `withdrawn_at` (timestamptz, nullable)

### New columns on `ladder_matches` table:
- `is_retirement` (boolean, default false)
- `retired_by_team_id` (uuid, nullable)
- `is_walkover` (boolean, default false)
- `is_void` (boolean, default false)
- `score_photo_url_team1` (text, nullable)
- `score_photo_url_team2` (text, nullable)
- `extension_requested_by` (uuid, nullable)
- `extension_days` (integer, nullable)
- `extension_reason` (text, nullable)
- `extension_status` (text, nullable - pending/approved/declined)
- `original_deadline_date` (date, nullable)

### New table: `competition_notifications` 
For in-app notifications specific to competition events (forfeit, dispute, freeze, withdrawal, extension):
- `id`, `competition_id`, `user_id`, `type`, `title`, `message`, `is_read`, `metadata` (jsonb), `created_at`

### Storage: 
- Create a `score-photos` storage bucket (public) for scorecard uploads

### RLS policies for new table and updated tables

## Phase 2: Wizard Updates (4 files)

### Rules Step (`CreateCompetitionWizard.tsx`)
- Add **Maximum Freeze Days** field (number input, default 30)
- Add to `WizardFormData` type: `max_freeze_days: string`
- Save to `ladders` table on submit

### Structure Step (`CreateCompetitionWizard.tsx`)
- Add **Minimum Players Required** field (number input)
- Add to `WizardFormData` type: `min_players_required: string`

### Eligibility Step
- Add informational note: "Player ratings are verified at the time of registration only..."

### Review Step
- Show new fields in review summary

## Phase 3: Score Submission Enhancements (SubmitScoreDialog.tsx)

- Add **Match Retired** toggle with radio buttons (I Retired / My Opponent Retired)
- Add optional **Scorecard Photo** upload with encouragement note
- When retired: skip score validation, mark retiring player as loser, no forfeit strike
- Photo uploads go to `score-photos` bucket

## Phase 4: Player Competition View (CompetitionDetailPlayer.tsx)

### Freeze Participation
- Add "Freeze Participation" button in competition detail view
- Date picker for freeze end (max = competition's `max_freeze_days`)
- Validation: cannot freeze if active match deadline has passed
- Updates `ladder_teams` record

### Formal Withdrawal
- Add "Withdraw" button inside a settings/options menu (dropdown)
- Confirmation dialog with consequences explanation
- Sets `is_withdrawn = true`, removes from leaderboard
- For doubles: notifies partner, gives 7-day replacement window

### Match Extension Request
- Add "Request Extension" button on upcoming match cards in `LadderMatches.tsx`
- Dialog with days (1-7) and required reason field
- Opponent gets notification with Approve/Decline buttons

## Phase 5: Leaderboard Updates (LadderLeaderboard.tsx)

- Show "Frozen" badge (snowflake icon) next to frozen players
- Show "Reliability Warning" badge for 3+ walkover losses
- Show "Dispute Warning" badge for 3+ dispute strikes without evidence
- Filter out withdrawn players from active standings

## Phase 6: Admin Management Updates (ManageCompetition.tsx)

### Players Tab
- Show freeze status and end dates for frozen players
- Show walkover loss count and reliability warnings
- Show dispute strike count

### Matches Tab
- Allow admin to edit deadline dates directly on any match row
- Manual score override for disputed matches with conflicting photos

## Phase 7: Upcoming Match Reminders (LadderMatches.tsx)

- Add scorecard tip message on every upcoming match card: "Tip: Take a photo of your scorecard after your match..."

## Phase 8: Automated Logic (Edge Functions + Cron)

### New Edge Function: `process-competition-deadlines`
Runs on a cron schedule (every hour) to handle:
1. **Non-Response Forfeit**: Check matches past acceptance window with no response, auto-award walkover win, increment `walkover_losses`
2. **Score Submission Deadline**: 48 hours after match deadline with no score = void match
3. **Auto-confirm uncontested scores**: If one player submitted and dispute window expired, auto-confirm
4. **Minimum Player Threshold**: 48 hours before registration deadline, check if minimum met, notify admin

### Dispute Resolution Logic (in score confirmation flow)
- If submitter has photo, disputer doesn't: submitted score stands automatically
- If neither has photo: match voided, both notified
- If both have conflicting photos: admin notified for manual review
- Track dispute strikes per player

### Doubles Partner Replacement (7-day window)
- After withdrawal, track deadline in `competition_notifications` metadata
- Cron job checks for expired replacement windows, auto-withdraws team

## Phase 9: Notification Integration

- Create `competition_notifications` entries for all automated events
- Wire into existing `/notifications` page via `useInAppNotifications` hook
- Types: `walkover_win`, `walkover_loss`, `score_reminder`, `match_voided`, `auto_confirmed`, `dispute_result`, `freeze_activated`, `withdrawal`, `partner_withdrawn`, `extension_request`, `extension_response`, `min_threshold_warning`

## Technical Notes

- The `WizardFormData` interface in `types.ts` needs two new fields: `max_freeze_days` and `min_players_required`
- The `Competition` interface needs `max_freeze_days` added
- The `CompetitionTeam` interface needs all new team-level fields
- Score photo uploads use the existing `avatars` bucket pattern (or new `score-photos` bucket)
- The cron edge function follows the same pattern as `send-scheduled-reminders`
- All automated actions create audit-trail notifications

## Estimated Scope

This involves changes to approximately 15-20 files and 1-2 new edge functions. I recommend implementing in the order listed above, starting with the database migration as the foundation. The automated edge function logic (Phase 8) is the most complex piece and should be implemented last after the UI is in place.

