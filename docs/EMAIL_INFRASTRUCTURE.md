# TenisX Email Infrastructure — Production Guide

> Generated: 2026-06-28. Authoritative reference for cron scheduling and email QA.

---

## Phase 2 — Reminder Infrastructure Audit Results

`send-scheduled-reminders` is **fully production-ready**. Verification summary:

| Requirement | Status | Notes |
|---|---|---|
| Court (booking) reminders | ✅ | `processBookingReminders` — filters `bookings.status = 'confirmed'` |
| Lesson reminders | ✅ | `processLessonReminders` — player AND coach both notified |
| Match reminders | ✅ | `processMatchReminders` — challenger AND opponent both notified |
| 1-hour window | ✅ | 55–65 min from now; keys `booking_1h`, `lesson_1h`, `match_1h` |
| 24-hour window | ✅ | 1415–1445 min from now (23h35–24h05); keys `booking_24h`, `lesson_24h`, `match_24h` |
| `email_reminders_sent` dedup | ✅ | `checkReminderSent` before every send; `recordReminderSent` after success |
| Notification preferences | ✅ | `checkEmailPreference` checks `email_preferences` table per user |
| No duplicate reminders possible | ✅ | Unique constraint `(event_type, event_id, user_id)` in DB + pre-send check |

The `email_reminders_sent` CHECK constraint bug (silently rejecting `booking_1h`, `booking_24h`, etc.) was
fixed in migration `20260628120000_notification_fixes.sql`. The dedup system is now functional.

---

## Phase 3 — Cron Deployment Plan

### Option A — Supabase Dashboard (Recommended, No SQL)

**Recommended frequency:** Every 15 minutes.

**Steps:**

1. Open [Supabase Dashboard → Project → Edge Functions](https://supabase.com/dashboard/project/hqqlrliakttqsbalvuyz/functions)
2. Click **`send-scheduled-reminders`**
3. Click **"Add Schedule"** (or "Cron Jobs" tab depending on dashboard version)
4. Set the cron expression:
   ```
   */15 * * * *
   ```
   (Every 15 minutes, 24/7)
5. Leave the HTTP method as **POST**, body empty
6. Click **Save**

The function returns a JSON summary of reminders sent — visible in the function logs.

---

### Option B — pg_cron (SQL, runs inside Postgres)

Run this SQL once in the Supabase SQL editor
([Dashboard → SQL Editor](https://supabase.com/dashboard/project/hqqlrliakttqsbalvuyz/sql)):

```sql
-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the reminder function every 15 minutes
SELECT cron.schedule(
  'send-scheduled-reminders',           -- job name (unique)
  '*/15 * * * *',                       -- cron expression: every 15 min
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/send-scheduled-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{}'::jsonb
  );
  $$
);
```

> **Note:** pg_cron + `net.http_post` requires the `pg_net` extension. Both are available on all Supabase paid plans. On free tier, use Option A (Dashboard schedule) instead.

To verify the job was created:
```sql
SELECT * FROM cron.job WHERE jobname = 'send-scheduled-reminders';
```

To remove it:
```sql
SELECT cron.unschedule('send-scheduled-reminders');
```

---

### Infrastructure Cost Impact

| Item | Cost |
|---|---|
| Edge Function invocations | Free tier: 500k/month included. 15-min schedule = ~2,880/month → negligible |
| pg_cron (Option B) | Included on Pro plan; not available on free tier |
| Resend email sends | First 3,000/month free on Resend Hobby; Pro plan from $20/month |
| Expected email volume | Low (HOA community = tens to low hundreds of users) |

**Recommendation:** Use Dashboard scheduling (Option A). It's zero-config, free, and requires no pg_cron setup.

---

## Phase 4 — Email QA Checklist

For each notification: trigger action → verify email arrives → check DB records → check failure indicators.

### Prerequisites

- Resend dashboard open at [resend.com/emails](https://resend.com) to monitor outbound
- Supabase logs open: Dashboard → Edge Functions → `send-booking-email` / `send-message-notification`
- Two test accounts with different emails (resident A, resident B)
- One coach account
- One admin account

---

### 1. Court Booking Confirmation

| Field | Expected |
|---|---|
| **Trigger** | Resident completes a court booking in the app |
| **Recipient** | The resident who made the booking |
| **Subject** | `Your court booking is confirmed` |
| **Body** | Court name, date, start time, end time, play type |
| **DB records** | `bookings` row with `status = 'confirmed'` |
| **Failure indicators** | Email not received within 2 min; `send-booking-email` logs show error; `RESEND_API_KEY` missing in secrets |

**Code path:** `src/app/(resident)/courts.tsx` → `sendNotificationEmail({ type: 'booking_confirmation', ... })`

---

### 2. Court Booking Cancellation

| Field | Expected |
|---|---|
| **Trigger** | Resident cancels a booking in My Reservations |
| **Recipient** | The resident who cancelled |
| **Subject** | `Your court booking has been cancelled` |
| **Body** | Court name, date, time, cancellation reason (if any) |
| **DB records** | `bookings.status = 'cancelled'` |
| **Failure indicators** | Email not received; cancellation reason missing from body |

**Code path:** `src/app/my-reservations.tsx` → `sendNotificationEmail({ type: 'booking_cancellation', ... })`

---

### 3. Lesson Request Submitted (to Coach)

| Field | Expected |
|---|---|
| **Trigger** | Resident submits a lesson booking request |
| **Recipient** | The coach whose service was requested |
| **Subject** | `New lesson request` |
| **Body** | Player name, lesson type, preferred date/time, skill level |
| **DB records** | `lesson_requests` row with `status = 'pending'` |
| **Failure indicators** | Coach receives no email; `playerId` / `playerName` blank in email body |

**Code path:** `src/components/coaching/BookLessonSheet.tsx` → `sendNotificationEmail({ type: 'lesson_request_received', ... })`

---

### 4. Lesson Accepted (to Player)

| Field | Expected |
|---|---|
| **Trigger** | Coach taps Accept on a lesson request |
| **Recipient** | The player who submitted the request |
| **Subject** | `Your lesson is confirmed` |
| **Body** | Coach name, lesson type, confirmed date, start/end time |
| **DB records** | `lesson_requests.status = 'approved'`, `confirmed_date` and `confirmed_time_start/end` set |
| **Failure indicators** | Player receives no email; times blank; coach name missing |

**Code path:** `src/hooks/useCoachRequests.ts:accept()` → `sendNotificationEmail({ type: 'lesson_confirmation', ... })`

---

### 5. Lesson Declined (to Player)

| Field | Expected |
|---|---|
| **Trigger** | Coach taps Decline on a lesson request |
| **Recipient** | The player who submitted the request |
| **Subject** | `Your lesson request was declined` |
| **Body** | Coach name, lesson type, original date, decline reason (optional) |
| **DB records** | `lesson_requests.status = 'declined'`, `cancellation_reason` (if provided) |
| **Failure indicators** | Player receives no email; reason not shown when provided |

**Code path:** `src/hooks/useCoachRequests.ts:decline()` → `sendNotificationEmail({ type: 'lesson_declined', ... })`

---

### 6. Lesson Expired (to Player and Coach)

| Field | Expected |
|---|---|
| **Trigger** | Coach opens the requests screen and a pending lesson's time has passed |
| **Recipient** | Both the player AND the coach |
| **Subject (player)** | `Your lesson request has expired` |
| **Subject (coach)** | `Lesson request expired — [player name]` |
| **Body** | Lesson type, date, time that passed |
| **DB records** | `lesson_requests.status = 'expired'`, `responded_at` set |
| **Failure indicators** | Only one email sent instead of two; expiry only triggers when coach opens the screen (client-side) |

**Code path:** `src/hooks/useCoachRequests.ts` auto-expire loop

---

### 7. Match Challenge Received

| Field | Expected |
|---|---|
| **Trigger** | Resident sends a match challenge to another player |
| **Recipient** | The opponent (challenged player) |
| **Subject** | `New match challenge from [challenger name]` |
| **Body** | Challenger name, match type, proposed date/time; note that challenge expires in 48h |
| **DB records** | `match_requests` row with `status = 'pending'` |
| **Failure indicators** | Opponent receives no email; challenger name missing; date/time blank |

**Code path:** `src/app/(resident)/match.tsx:handleSend()` → `sendNotificationEmail({ type: 'match_request_received', ... })`

---

### 8. Match Accepted (to Challenger)

| Field | Expected |
|---|---|
| **Trigger** | Opponent taps Accept on the match request |
| **Recipient** | The challenger who sent the request |
| **Subject** | `Your match challenge was accepted` |
| **Body** | Opponent name, match type, date/time |
| **DB records** | `match_requests.status = 'accepted'` |
| **Failure indicators** | Challenger receives no email; opponent name missing |

**Code path:** `src/app/(resident)/match.tsx:acceptRequest()` → `sendNotificationEmail({ type: 'match_confirmation', ... })`

---

### 9. Match Declined (to Challenger)

| Field | Expected |
|---|---|
| **Trigger** | Opponent taps Decline on the match request |
| **Recipient** | The challenger who sent the request |
| **Subject** | `Your match challenge was declined` |
| **Body** | Opponent name, optional decline reason |
| **DB records** | `match_requests.status = 'declined'` |
| **Failure indicators** | Challenger receives no email; reason missing when provided |

**Code path:** `src/app/(resident)/match.tsx:declineRequest()` → `sendNotificationEmail({ type: 'match_declined', ... })`

---

### 10. New Message Notification (30-min Throttle)

| Field | Expected |
|---|---|
| **Trigger** | Resident sends a message to another user |
| **Recipient** | The message receiver |
| **Subject** | `New message from [sender name]` |
| **Body** | Sender name, prompt to open app |
| **DB records** | `message_email_throttle` row upserted with `last_sent_at` |
| **Throttle test** | Send a second message within 30 min → no second email; `message_email_throttle` row `last_sent_at` unchanged |
| **Failure indicators** | Multiple emails per conversation in 30 min; `send-message-notification` logs show throttle table error |

**Code path:** `src/app/messages.tsx:sendMessage()` → `supabase.functions.invoke('send-message-notification', ...)`

---

### 11. HOA Membership Approved

| Field | Expected |
|---|---|
| **Trigger** | Admin approves a pending HOA member in Pending Requests screen |
| **Recipient** | The resident who applied |
| **Subject** | `Welcome to [community name]! Your membership is approved` |
| **Body** | Community name, welcome message |
| **DB records** | `community_members.status = 'active'` (or equivalent approval column) |
| **Failure indicators** | No email sent; community name blank |

**Code path:** `src/app/(admin)/pending-requests.tsx` → `sendNotificationEmail({ type: 'hoa_approved', ... })`

---

### 12. HOA Membership Rejected

| Field | Expected |
|---|---|
| **Trigger** | Admin rejects a pending HOA member |
| **Recipient** | The resident who applied |
| **Subject** | `Your HOA membership application was not approved` |
| **Body** | Community name, rejection message |
| **DB records** | `community_members.status = 'rejected'` (or equivalent) |
| **Failure indicators** | No email sent; same email as approval |

**Code path:** `src/app/(admin)/pending-requests.tsx` → `sendNotificationEmail({ type: 'hoa_rejected', ... })`

---

### 13–15. Reminder Emails (Booking / Lesson / Match)

These are sent by `send-scheduled-reminders` which must be scheduled (see Phase 3).

**Testing without waiting 24h:** Temporarily insert a booking/lesson/match with `start_time` set to 62 minutes from now, then invoke the function manually:

```bash
npx supabase functions invoke send-scheduled-reminders --project-ref hqqlrliakttqsbalvuyz
```

| # | Type | Recipient | Subject | Window |
|---|---|---|---|---|
| 13a | Booking 1h reminder | Resident | `Court reminder — 1 hour away` | 55–65 min |
| 13b | Booking 24h reminder | Resident | `Court reminder — 24 hours away` | 23h35–24h05 |
| 14a | Lesson 1h reminder | Player + Coach | `Lesson reminder — 1 hour away` | 55–65 min |
| 14b | Lesson 24h reminder | Player + Coach | `Lesson reminder — 24 hours away` | 23h35–24h05 |
| 15a | Match 1h reminder | Challenger + Opponent | `Match reminder — 1 hour away` | 55–65 min |
| 15b | Match 24h reminder | Challenger + Opponent | `Match reminder — 24 hours away` | 23h35–24h05 |

**Dedup test:** Invoke the function twice in a row with the same test event → second invocation sends zero emails.
Check `email_reminders_sent` table after each run.

**Preference test:** Set `email_preferences.booking_reminders = false` for user → booking reminders suppressed, other reminder types still send.

---

## Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `send-scheduled-reminders` not yet scheduled | High | Must be done manually in Dashboard (Phase 3 above) |
| Resend domain verification for `tenisx.ai` | High | Verify domain in [Resend Dashboard → Domains](https://resend.com/domains) before launch; unverified domain = emails bounce |
| Lesson expiry is client-triggered | Medium | Expiry only fires when coach opens the requests screen. Consider adding a DB trigger or cron-based expiry for reliability |
| `email_preferences` row missing for new users | Low | `checkEmailPreference` returns `true` (opt-in by default) if no row exists — safe behavior |
| Auth email for `email_change` action type | Low | `send-auth-email` only handles `signup` and `recovery`; `email_change` falls through with empty HTML — add if needed |
