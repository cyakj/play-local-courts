# Launch Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up all 15 launch-critical TenisX notifications (email + in-app) using the existing Resend + Supabase Edge Function architecture.

**Architecture:** Extend `send-booking-email` with three new email types; add a new `send-message-notification` edge function with server-side 30-minute throttle; wire client-side calls in match.tsx, messages.tsx, and useCoachRequests.ts; fix a silent deduplication bug in `email_reminders_sent`.

**Tech Stack:** Deno / Supabase Edge Functions, Resend v2, Supabase Postgres, React Native / Expo

## Global Constraints

- Sender is always: `TenisX <noreply@tenisx.ai>` — read `FROM_EMAIL` secret; fallback to `noreply@tenisx.ai`
- RESEND_API_KEY and FROM_EMAIL secrets already exist in Supabase
- All non-mandatory notifications must check `email_preferences` table before sending
- Idempotency: deduplication tracked in `email_reminders_sent` (reminders) and `message_email_throttle` (messages)
- TypeScript — no implicit any; use `@/` alias for `src/`
- Never hardcode user IDs or community IDs
- Respect existing `notification_preferences` JSON (profiles table) for in-app preferences

## What Is Already Implemented (Do Not Re-implement)

- Court booking confirmed email → `src/app/(resident)/courts.tsx:699`
- Court booking cancelled email → `src/app/my-reservations.tsx:105`
- Lesson request submitted email (to coach) → `src/components/coaching/BookLessonSheet.tsx:360`
- Lesson accepted email (to player) → `src/hooks/useCoachRequests.ts:204`
- Lesson declined email (to player) → `src/hooks/useCoachRequests.ts:238`
- Lesson expired email (to player only — coach is missing, fixed in Task 5) → `src/hooks/useCoachRequests.ts:147`
- HOA approved/rejected email → `src/app/(admin)/pending-requests.tsx:119`
- All 3 reminder types at 1 h and 24 h → `supabase/functions/send-scheduled-reminders/index.ts`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `supabase/migrations/20260628120000_notification_fixes.sql` | Create | Fix email_reminders_sent constraint; add message_email_throttle table |
| `supabase/functions/send-booking-email/index.ts` | Modify | Add match_request_received, match_declined, lesson_expired_coach types; use FROM_EMAIL env var |
| `supabase/functions/send-message-notification/index.ts` | Create | New function: message notification with 30-min throttle |
| `src/lib/emailNotifications.ts` | Modify | Add new email type literals to the NotificationEmailPayload union |
| `src/app/(resident)/match.tsx` | Modify | Wire emails on match request insert, accept, decline |
| `src/hooks/useCoachRequests.ts` | Modify | Also notify coach when lesson expires |

---

## Task 1: DB Migration — Fix Constraints + Message Throttle Table

**Files:**
- Create: `supabase/migrations/20260628120000_notification_fixes.sql`

**Why:** The `email_reminders_sent` check constraint allows only `'booking'|'lesson'|'match'` but `send-scheduled-reminders` inserts `'booking_1h'`, `'booking_24h'`, `'lesson_1h'`, `'lesson_24h'`, `'match_1h'`, `'match_24h'` — causing silent failures and allowing duplicate reminder emails. The `message_email_throttle` table is needed for Task 6.

- [ ] **Step 1: Create the migration file**

```sql
-- Fix email_reminders_sent: constraint allows only 'booking','lesson','match'
-- but send-scheduled-reminders uses 'booking_1h','booking_24h', etc.
-- This caused silent INSERT failures and duplicate reminder emails.
ALTER TABLE public.email_reminders_sent
  DROP CONSTRAINT IF EXISTS email_reminders_sent_event_type_check;

ALTER TABLE public.email_reminders_sent
  ADD CONSTRAINT email_reminders_sent_event_type_check
  CHECK (event_type IN (
    'booking','lesson','match',
    'booking_1h','booking_24h',
    'lesson_1h','lesson_24h',
    'match_1h','match_24h',
    'message'
  ));

-- Throttle table for message email notifications (30-min per conversation)
CREATE TABLE IF NOT EXISTS public.message_email_throttle (
  user1_id  UUID NOT NULL,
  user2_id  UUID NOT NULL,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user1_id, user2_id),
  CONSTRAINT canonical_pair CHECK (user1_id < user2_id)
);

ALTER TABLE public.message_email_throttle ENABLE ROW LEVEL SECURITY;

-- Only the edge function (service role) reads/writes this table
CREATE POLICY "Service role manages message throttle"
  ON public.message_email_throttle
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with the SQL above. Target the production project.

- [ ] **Step 3: Verify**

Run the following query to confirm both changes:
```sql
-- Check constraint updated
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'email_reminders_sent_event_type_check';

-- Check table created
SELECT table_name FROM information_schema.tables
WHERE table_name = 'message_email_throttle';
```

Expected: constraint row with the expanded IN list; `message_email_throttle` row exists.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628120000_notification_fixes.sql
git commit -m "fix(notifications): expand email_reminders_sent constraint + add message throttle table"
```

---

## Task 2: Extend send-booking-email — New Types + FROM_EMAIL

**Files:**
- Modify: `supabase/functions/send-booking-email/index.ts`

**Interfaces:**
- Produces: `match_request_received | match_declined | lesson_expired_coach` email types consumed by Tasks 3, 4, 5

- [ ] **Step 1: Replace the hardcoded from address with FROM_EMAIL env var**

In `supabase/functions/send-booking-email/index.ts`, after the `const resend = ...` line (line 6), add:

```typescript
const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@tenisx.ai";
```

Then replace the `from:` line (line 388) from:
```typescript
from: "TenisX <noreply@tenisx.ai>",
```
to:
```typescript
from: `TenisX <${fromEmail}>`,
```

- [ ] **Step 2: Add match_request_received, match_declined, lesson_expired_coach to the EmailRequest type**

Replace lines 16–21 (the type union):
```typescript
interface EmailRequest {
  type:
    | 'booking_confirmation' | 'booking_cancellation' | 'booking_reminder'
    | 'lesson_confirmation'  | 'lesson_reminder'
    | 'lesson_request_received' | 'lesson_declined' | 'lesson_expired'
    | 'lesson_expired_coach'
    | 'match_confirmation'   | 'match_reminder'
    | 'match_request_received' | 'match_declined'
    | 'hoa_approved'         | 'hoa_rejected';
```

- [ ] **Step 3: Add match_request_received case to the switch statement**

Insert before the `case 'match_confirmation':` block (around line 305):

```typescript
      case 'match_request_received':
        if (preferences && !preferences.match_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `New Match Challenge from ${playerName ?? 'a player'}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#D6FF3D;font-size:22px;margin-bottom:8px;">New Match Challenge</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <p style="color:#F5F8FF;">You've received a match challenge from <strong>${playerName ?? 'another player'}</strong>.</p>
            <div style="background:#161A26;border:1px solid #D6FF3D44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #D6FF3D;">
              ${emailData.matchType ? `<p style="margin:6px 0;"><strong>Match Type:</strong> ${emailData.matchType}</p>` : ''}
              ${emailData.date ? `<p style="margin:6px 0;"><strong>Proposed Date:</strong> ${formattedDate}</p>` : ''}
              ${emailData.startTime ? `<p style="margin:6px 0;"><strong>Proposed Time:</strong> ${emailData.startTime}${emailData.endTime ? ` – ${emailData.endTime}` : ''}</p>` : ''}
              ${emailData.location ? `<p style="margin:6px 0;"><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">Open TenisX to accept or decline. This request expires in 48 hours.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;
```

- [ ] **Step 4: Add match_declined case**

Insert after the `match_request_received` case:

```typescript
      case 'match_declined':
        if (preferences && !preferences.match_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Your match request was declined`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#FF5C6B;font-size:22px;margin-bottom:8px;">Match Request Declined</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <p style="color:#F5F8FF;">${emailData.opponentName ?? 'Your opponent'} was unable to accept your match request${emailData.date ? ` for ${formattedDate}` : ''}.</p>
            ${emailData.cancellationReason ? `<p style="color:#9AA3B8;margin-top:8px;"><strong>Message:</strong> ${emailData.cancellationReason}</p>` : ''}
            <p style="color:#9AA3B8;font-size:13px;margin-top:16px;">You can challenge other players in the TenisX app.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;
```

- [ ] **Step 5: Add lesson_expired_coach case**

Insert after the `lesson_expired` case (around line 303):

```typescript
      case 'lesson_expired_coach':
        if (preferences && !preferences.lesson_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Lesson request from ${playerName ?? 'a student'} has expired`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#FF5C6B;font-size:22px;margin-bottom:8px;">Lesson Request Expired</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <p style="color:#F5F8FF;">A lesson request from <strong>${playerName ?? 'a student'}</strong>${emailData.date ? ` for ${formattedDate}` : ''} expired without a response.</p>
            <p style="color:#9AA3B8;font-size:13px;margin-top:16px;">The request has been automatically closed. The student has been notified and may reach out again.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;
```

- [ ] **Step 6: Deploy the edge function**

Use `mcp__supabase__deploy_edge_function` with function name `send-booking-email` and the full updated file content.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/send-booking-email/index.ts
git commit -m "feat(notifications): add match_request_received, match_declined, lesson_expired_coach email types; use FROM_EMAIL env var"
```

---

## Task 3: Update emailNotifications.ts TypeScript Types

**Files:**
- Modify: `src/lib/emailNotifications.ts`

**Interfaces:**
- Produces: `NotificationEmailPayload` with full union consumed by Tasks 4 and 5

- [ ] **Step 1: Update the type union**

Replace the type union in `src/lib/emailNotifications.ts` (lines 4–16):

```typescript
interface NotificationEmailPayload {
  type:
    | 'booking_confirmation'
    | 'booking_cancellation'
    | 'booking_reminder'
    | 'lesson_confirmation'
    | 'lesson_reminder'
    | 'lesson_request_received'
    | 'lesson_declined'
    | 'lesson_expired'
    | 'lesson_expired_coach'
    | 'match_confirmation'
    | 'match_reminder'
    | 'match_request_received'
    | 'match_declined'
    | 'hoa_approved'
    | 'hoa_rejected';
  userId: string;
  playerId?: string;
  bookingId?: string;
  lessonId?: string;
  courtName?: string;
  coachName?: string;
  playerName?: string;
  opponentName?: string;
  matchId?: string;
  matchType?: string;
  lessonType?: string;
  sport?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  playType?: string;
  location?: string;
  hoursLabel?: string;
  cancellationReason?: string;
  isAdminCancellation?: boolean;
  communityName?: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`

Expected: no type errors in emailNotifications.ts or its consumers.

- [ ] **Step 3: Commit**

```bash
git add src/lib/emailNotifications.ts
git commit -m "feat(notifications): add match_request_received, match_declined, lesson_expired_coach to email payload types"
```

---

## Task 4: Wire Match Email Notifications in match.tsx

**Files:**
- Modify: `src/app/(resident)/match.tsx`

**Interfaces:**
- Consumes: `sendNotificationEmail` from `src/lib/emailNotifications.ts` (match_request_received | match_confirmation | match_declined)

The three events that need emails:
1. Challenge sent → email to opponent (`match_request_received`)
2. Challenge accepted → email to challenger (`match_confirmation`)
3. Challenge declined → email to challenger (`match_declined`)

- [ ] **Step 1: Add sendNotificationEmail import**

At the top of `src/app/(resident)/match.tsx`, after the `import { supabase }` line (line 44), add:

```typescript
import { sendNotificationEmail } from '@/lib/emailNotifications';
```

- [ ] **Step 2: Wire email after match request INSERT**

Find the `match_requests` INSERT around line 2123. After the `await supabase.from('match_requests').insert(...)` call (and confirming no error), add:

```typescript
      // Notify opponent of new challenge — fire and forget
      sendNotificationEmail({
        type: 'match_request_received',
        userId: opponent.id,
        playerId: currentUserId,   // edge function looks up challenger's name via this
        date: dateStr,
        startTime: timeSlot,
        endTime: timeEnd,
        matchType: matchType as string,
        location: selectedCourt?.name ?? undefined,
      });
```

The exact insertion point is immediately after the `supabase.from('match_requests').insert({...})` call closes. Use `opponent.id` (already in scope as `opponent.id`), `currentUserId` (already in scope), `dateStr`, `timeSlot`, `timeEnd`, `matchType`, `selectedCourt?.name`.

- [ ] **Step 3: Wire email in acceptRequest()**

In the `acceptRequest` function (starting around line 477), after `await supabase.from('match_requests').update({ status: 'accepted' })...` succeeds, add a fire-and-forget block:

```typescript
  // Notify challenger that request was accepted — fire and forget
  void (async () => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', currentUserId)
      .single();
    sendNotificationEmail({
      type: 'match_confirmation',
      userId: challengerId,
      opponentName: (prof as any)?.full_name ?? 'Your opponent',
    });
  })();
```

- [ ] **Step 4: Wire email in declineRequest()**

In the `declineRequest` function (starting around line 509), after `await supabase.from('match_requests').update({ status: 'declined' })...` succeeds, add:

```typescript
  // Notify challenger that request was declined — fire and forget
  void (async () => {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', currentUserId)
      .single();
    sendNotificationEmail({
      type: 'match_declined',
      userId: challengerId,
      opponentName: (prof as any)?.full_name ?? 'Your opponent',
      cancellationReason: message || undefined,
    });
  })();
```

- [ ] **Step 5: Run lint**

```
npm run lint
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/(resident)/match.tsx
git commit -m "feat(notifications): send email to opponent on match request, and to challenger on accept/decline"
```

---

## Task 5: Notify Coach When Lesson Expires

**Files:**
- Modify: `src/hooks/useCoachRequests.ts`

**Interfaces:**
- Consumes: `sendNotificationEmail` (already imported at line 3); `lesson_expired_coach` type from Task 3

The expiry loop at lines 143–157 already notifies the **player**. The **coach** (current user, `user.id`) is not notified.

- [ ] **Step 1: Add coach notification inside the expiry loop**

Locate the existing expiry `.then()` block (around lines 143–157):

```typescript
.then(({ error: expErr }) => {
  if (expErr) return;
  // Notify each player that their request expired
  for (const req of toExpire) {
    sendNotificationEmail({
      type: 'lesson_expired',
      userId: req.playerId,
      coachName: undefined,
      lessonType: req.lessonType,
      date: req.preferredDate,
      startTime: req.preferredTimeStart,
      endTime: req.preferredTimeEnd,
    });
  }
});
```

Replace the entire block with:

```typescript
.then(async ({ error: expErr }) => {
  if (expErr) return;
  const { data: { user: coachUser } } = await supabase.auth.getUser();
  if (!coachUser) return;
  for (const req of toExpire) {
    // Notify player
    sendNotificationEmail({
      type: 'lesson_expired',
      userId: req.playerId,
      coachName: undefined,
      lessonType: req.lessonType,
      date: req.preferredDate,
      startTime: req.preferredTimeStart,
      endTime: req.preferredTimeEnd,
    });
    // Notify coach
    sendNotificationEmail({
      type: 'lesson_expired_coach',
      userId: coachUser.id,
      playerId: req.playerId,   // edge function looks up student name
      lessonType: req.lessonType,
      date: req.preferredDate,
      startTime: req.preferredTimeStart,
      endTime: req.preferredTimeEnd,
    });
  }
});
```

- [ ] **Step 2: Run lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useCoachRequests.ts
git commit -m "feat(notifications): notify coach when their lesson request expires"
```

---

## Task 6: Create send-message-notification Edge Function

**Files:**
- Create: `supabase/functions/send-message-notification/index.ts`

**Interfaces:**
- Consumes: `message_email_throttle` table (from Task 1); Resend API; `profiles` table; `notification_preferences` JSON
- Receives payload: `{ senderId: string, receiverId: string }`
- Produces: HTTP 200 with `{ sent: boolean, reason?: string }`

**Throttle logic:** canonical pair = `(LEAST(senderId, receiverId), GREATEST(senderId, receiverId))`. If a row exists with `last_sent_at > NOW() - 30 minutes`, skip. Otherwise send and upsert.

- [ ] **Step 1: Create the function file**

Create `supabase/functions/send-message-notification/index.ts` with:

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend       = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;
const supabaseKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fromEmail    = Deno.env.get("FROM_EMAIL") ?? "noreply@tenisx.ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { senderId, receiverId } = await req.json() as { senderId: string; receiverId: string };

    if (!senderId || !receiverId) {
      return new Response(JSON.stringify({ error: 'senderId and receiverId required' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Message notification: ${senderId} → ${receiverId}`);

    // Check receiver's in-app notification preference for new_messages
    const { data: profile } = await supabase
      .from('profiles')
      .select('notification_preferences, full_name')
      .eq('id', receiverId)
      .single();

    const notifPrefs = (profile?.notification_preferences as Record<string, boolean> | null) ?? {};
    if (notifPrefs.new_messages === false) {
      console.log('Receiver has disabled new_messages notifications');
      return new Response(JSON.stringify({ sent: false, reason: 'preference_disabled' }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check email_preferences table
    const { data: emailPrefs } = await supabase
      .from('email_preferences')
      .select('admin_announcements')  // no specific key for messages; use default-send
      .eq('user_id', receiverId)
      .single();

    // Canonical pair: smaller UUID first
    const [user1, user2] = [senderId, receiverId].sort();

    // 30-minute throttle check
    const throttleWindow = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: throttle } = await supabase
      .from('message_email_throttle')
      .select('last_sent_at')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .single();

    if (throttle && throttle.last_sent_at > throttleWindow) {
      console.log('Throttled: email sent within last 30 minutes for this conversation');
      return new Response(JSON.stringify({ sent: false, reason: 'throttled' }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch receiver email and name
    const { data: authUser } = await supabase.auth.admin.getUserById(receiverId);
    const receiverEmail = authUser?.user?.email;
    if (!receiverEmail) {
      console.log('No email found for receiver:', receiverId);
      return new Response(JSON.stringify({ sent: false, reason: 'no_email' }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const receiverName = profile?.full_name ?? 'there';

    // Fetch sender name
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', senderId)
      .single();
    const senderName = senderProfile?.full_name ?? 'Someone';

    // Send email
    const emailResponse = await resend.emails.send({
      from: `TenisX <${fromEmail}>`,
      to: [receiverEmail],
      subject: `New message from ${senderName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
          <h1 style="color:#2DE0FF;font-size:22px;margin-bottom:8px;">New Message</h1>
          <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${receiverName},</p>
          <p style="color:#F5F8FF;">You have a new message from <strong>${senderName}</strong> in TenisX.</p>
          <p style="color:#9AA3B8;font-size:13px;margin-top:16px;">Open the app to read and reply.</p>
          <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
        </div>
      `,
    });

    console.log('Message notification sent:', emailResponse);

    // Upsert throttle record
    await supabase
      .from('message_email_throttle')
      .upsert(
        { user1_id: user1, user2_id: user2, last_sent_at: new Date().toISOString() },
        { onConflict: 'user1_id,user2_id' }
      );

    return new Response(JSON.stringify({ sent: true, emailId: emailResponse.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error('Error in send-message-notification:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deploy the edge function**

Use `mcp__supabase__deploy_edge_function` with function name `send-message-notification`.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-message-notification/index.ts
git commit -m "feat(notifications): add send-message-notification edge function with 30-min throttle"
```

---

## Task 7: Wire Message Notification in messages.tsx

**Files:**
- Modify: `src/app/messages.tsx`

**Interfaces:**
- Consumes: `send-message-notification` edge function (from Task 6) via `supabase.functions.invoke`

The `sendMessage()` function (line 150) inserts a message into the `messages` table but never triggers a notification. After a successful insert, fire the edge function.

- [ ] **Step 1: Call send-message-notification after message insert**

In `sendMessage()` (around line 150), after the `supabase.from('messages').insert(...)` call and `setThread` update, add:

```typescript
    // Notify recipient — fire and forget; throttled to once per 30 min per conversation
    if (newMsg) {
      supabase.functions
        .invoke('send-message-notification', {
          body: { senderId: userId, receiverId: activeConvo.partnerId },
        })
        .catch(() => {});
    }
```

Place this after `if (newMsg) setThread((prev) => [...prev, newMsg]);`

The full updated `sendMessage` function:

```typescript
  async function sendMessage() {
    if (!draft.trim() || !activeConvo || !userId) return;
    setSending(true);
    const { data: newMsg } = await supabase
      .from('messages')
      .insert({ sender_id: userId, receiver_id: activeConvo.partnerId, content: draft.trim() })
      .select()
      .single();
    if (newMsg) {
      setThread((prev) => [...prev, newMsg]);
      // Notify recipient — fire and forget; throttled to once per 30 min per conversation
      supabase.functions
        .invoke('send-message-notification', {
          body: { senderId: userId, receiverId: activeConvo.partnerId },
        })
        .catch(() => {});
    }
    setDraft('');
    setSending(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }
```

- [ ] **Step 2: Run lint**

```
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/messages.tsx
git commit -m "feat(notifications): trigger message email notification with 30-min throttle on send"
```

---

## Task 8: Run All Checks Before Final Commit

- [ ] **Step 1: Run lint**

```
npm run lint
```

Expected: zero errors.

- [ ] **Step 2: Run build check**

```
npm run build
```

Expected: builds successfully with no type errors.

- [ ] **Step 3: Final verification commit (if any outstanding files)**

```bash
git status
# Commit any remaining modified files
```

---

## QA Steps

### Email tests (requires Supabase dashboard — logs viewer or test emails)

**Notification 1 — Court reservation confirmed:**
- Log in as a resident, book a court
- Check send-booking-email logs for `booking_confirmation` send
- Check resident's email inbox

**Notification 2 — Court reservation cancelled:**
- Cancel a booking from My Reservations
- Check logs for `booking_cancellation`

**Notification 3 — Lesson request submitted (to coach):**
- Request a lesson from a coach profile
- Check coach's email for `lesson_request_received`

**Notifications 4 & 5 — Lesson accepted / declined:**
- Log in as coach, accept then decline separate requests
- Check player's email for `lesson_confirmation` and `lesson_declined`

**Notification 6 — Lesson expired (player + coach):**
- Create a lesson request with preferred_date in the past (or manually update DB to set expires_at to past)
- Open the coach's requests screen to trigger expiry loop
- Check both player AND coach emails

**Notification 7 — Match request received:**
- Send a match challenge to another user
- Check opponent's email for `match_request_received`

**Notification 8 — Match request accepted:**
- Accept an incoming match request
- Check challenger's email for `match_confirmation`

**Notification 9 — Match request declined:**
- Decline an incoming match request
- Check challenger's email for `match_declined`

**Notification 10 — New message received (30-min throttle):**
- Send a message to another user
- Verify recipient email arrives
- Send a second message within 30 minutes — verify NO second email
- Wait 30+ minutes (or set throttle in DB to old timestamp), send again — verify email arrives

**Notifications 11 & 12 — HOA join approved / rejected:**
- Approve/reject a pending member from the admin screen
- Check applicant's email (these were already implemented)

**Notifications 13–15 — Reminders:**
- Create bookings/lessons/matches for 1h and 24h from now
- Manually invoke `send-scheduled-reminders` edge function
- Verify reminder emails arrive and no duplicate is sent on second invocation

### Reminder deduplication regression test (fixes bug in Task 1):
- Note count in `email_reminders_sent` table before invoking reminders
- Invoke `send-scheduled-reminders` twice in quick succession
- Verify reminder count does not double

---

## Remaining Gaps / Manual Steps

1. **send-scheduled-reminders is not on a cron job** — must be scheduled in Supabase Dashboard → Edge Functions → Schedule, or via `pg_cron`. Suggested: every 5 minutes (`*/5 * * * *`).

2. **In-app match notifications** — match_request_received/accepted/declined write emails only; the match screen itself shows pending requests to the opponent but there is no push-to-bell notification center for match events currently. This would require a new notification bell UI reading from `hoa_notifications` (which would need its type CHECK constraint extended to include match types). Not in scope for this task.

3. **In-app message notification** — the messages screen unread indicator serves as the in-app notification; no separate notification bell for messages.

4. **FROM_EMAIL secret value** — verify it contains only the email address (e.g., `noreply@tenisx.ai`) not the display-name format. If it contains the full display string, adjust the template string in both edge functions.

5. **send-auth-email still uses `onboarding@resend.dev`** — this will fail in production until Resend domain is verified and the from address is updated. Manual action required in Supabase Dashboard or by updating `send-auth-email`.
