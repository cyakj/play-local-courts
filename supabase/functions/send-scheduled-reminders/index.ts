import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date();

    // 1-hour window: events starting 55–65 minutes from now
    const win1hStart = new Date(now.getTime() + 55  * 60 * 1000);
    const win1hEnd   = new Date(now.getTime() + 65  * 60 * 1000);

    // 24-hour window: events starting 1415–1445 minutes from now (23h35m – 24h05m)
    const win24hStart = new Date(now.getTime() + 1415 * 60 * 1000);
    const win24hEnd   = new Date(now.getTime() + 1445 * 60 * 1000);

    console.log(`1h  window: ${win1hStart.toISOString()} – ${win1hEnd.toISOString()}`);
    console.log(`24h window: ${win24hStart.toISOString()} – ${win24hEnd.toISOString()}`);

    const remindersSent: string[] = [];

    // ── 1h reminders ────────────────────────────────────────────────────────
    await processBookingReminders(supabase, win1hStart, win1hEnd, remindersSent, '1h', '1 Hour');
    await processLessonReminders(supabase, win1hStart, win1hEnd, remindersSent, '1h', '1 Hour');
    await processMatchReminders(supabase, win1hStart, win1hEnd, remindersSent, '1h', '1 Hour');

    // ── 24h reminders ───────────────────────────────────────────────────────
    await processBookingReminders(supabase, win24hStart, win24hEnd, remindersSent, '24h', '24 Hours');
    await processLessonReminders(supabase, win24hStart, win24hEnd, remindersSent, '24h', '24 Hours');
    await processMatchReminders(supabase, win24hStart, win24hEnd, remindersSent, '24h', '24 Hours');

    console.log(`Sent ${remindersSent.length} reminders:`, remindersSent);

    return new Response(
      JSON.stringify({ success: true, remindersSent: remindersSent.length, details: remindersSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in scheduled reminders:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function processBookingReminders(
  supabase: any,
  windowStart: Date,
  windowEnd: Date,
  remindersSent: string[],
  windowKey: string,
  hoursLabel: string,
) {
  const today = windowStart.toISOString().split('T')[0];

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`id, user_id, date, start_time, end_time, play_type, courts:court_id (name)`)
    .eq('date', today)
    .eq('status', 'confirmed');

  if (error) { console.error("Error fetching bookings:", error); return; }

  for (const booking of bookings ?? []) {
    const eventDateTime = new Date(`${booking.date}T${booking.start_time}`);
    if (eventDateTime < windowStart || eventDateTime > windowEnd) continue;

    const eventType = `booking_${windowKey}`;
    const alreadySent = await checkReminderSent(supabase, eventType, booking.id, booking.user_id);
    if (alreadySent) continue;

    const shouldSend = await checkEmailPreference(supabase, booking.user_id, 'booking_reminders');
    if (!shouldSend) continue;

    const ok = await sendReminderEmail(supabase, {
      type: 'booking_reminder',
      userId: booking.user_id,
      courtName: booking.courts?.name ?? 'Court',
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      playType: booking.play_type,
      hoursLabel,
    });

    if (ok) {
      await recordReminderSent(supabase, eventType, booking.id, booking.user_id);
      remindersSent.push(`booking-${windowKey}:${booking.id}`);
    }
  }
}

async function processLessonReminders(
  supabase: any,
  windowStart: Date,
  windowEnd: Date,
  remindersSent: string[],
  windowKey: string,
  hoursLabel: string,
) {
  const today = windowStart.toISOString().split('T')[0];

  const { data: lessons, error } = await supabase
    .from('lesson_requests')
    .select(`id, player_id, coach_id, confirmed_date, confirmed_time_start, confirmed_time_end, preferred_date, preferred_time_start, sport, lesson_type, location`)
    .eq('status', 'approved');

  if (error) { console.error("Error fetching lessons:", error); return; }

  for (const lesson of lessons ?? []) {
    const lessonDate  = lesson.confirmed_date      ?? lesson.preferred_date;
    const lessonStart = lesson.confirmed_time_start ?? lesson.preferred_time_start;
    if (!lessonDate || !lessonStart) continue;
    if (lessonDate !== today) continue;

    const eventDateTime = new Date(`${lessonDate}T${lessonStart}`);
    if (eventDateTime < windowStart || eventDateTime > windowEnd) continue;

    const eventType = `lesson_${windowKey}`;

    const { data: coach  } = await supabase.from('profiles').select('full_name').eq('id', lesson.coach_id).single();
    const { data: player } = await supabase.from('profiles').select('full_name').eq('id', lesson.player_id).single();

    // Notify player
    if (!await checkReminderSent(supabase, eventType, lesson.id, lesson.player_id)) {
      if (await checkEmailPreference(supabase, lesson.player_id, 'lesson_reminders')) {
        const ok = await sendReminderEmail(supabase, {
          type: 'lesson_reminder',
          userId: lesson.player_id,
          coachName: coach?.full_name ?? 'Coach',
          date: lessonDate,
          startTime: lessonStart,
          endTime: lesson.confirmed_time_end ?? lesson.preferred_time_end,
          sport: lesson.sport,
          lessonType: lesson.lesson_type,
          location: lesson.location,
          hoursLabel,
        });
        if (ok) {
          await recordReminderSent(supabase, eventType, lesson.id, lesson.player_id);
          remindersSent.push(`lesson-${windowKey}-player:${lesson.id}`);
        }
      }
    }

    // Notify coach
    if (!await checkReminderSent(supabase, eventType, lesson.id, lesson.coach_id)) {
      if (await checkEmailPreference(supabase, lesson.coach_id, 'lesson_reminders')) {
        const ok = await sendReminderEmail(supabase, {
          type: 'lesson_reminder',
          userId: lesson.coach_id,
          playerName: player?.full_name ?? 'Student',
          date: lessonDate,
          startTime: lessonStart,
          endTime: lesson.confirmed_time_end ?? lesson.preferred_time_end,
          sport: lesson.sport,
          lessonType: lesson.lesson_type,
          location: lesson.location,
          hoursLabel,
        });
        if (ok) {
          await recordReminderSent(supabase, eventType, lesson.id, lesson.coach_id);
          remindersSent.push(`lesson-${windowKey}-coach:${lesson.id}`);
        }
      }
    }
  }
}

async function processMatchReminders(
  supabase: any,
  windowStart: Date,
  windowEnd: Date,
  remindersSent: string[],
  windowKey: string,
  hoursLabel: string,
) {
  const today = windowStart.toISOString().split('T')[0];

  const { data: matches, error } = await supabase
    .from('match_requests')
    .select(`id, challenger_id, opponent_id, date, time_start, time_end, location, match_type, court_type`)
    .eq('date', today)
    .eq('status', 'accepted');

  if (error) { console.error("Error fetching matches:", error); return; }

  for (const match of matches ?? []) {
    const eventDateTime = new Date(`${match.date}T${match.time_start}`);
    if (eventDateTime < windowStart || eventDateTime > windowEnd) continue;

    const eventType = `match_${windowKey}`;

    const { data: challenger } = await supabase.from('profiles').select('full_name').eq('id', match.challenger_id).single();
    const { data: opponent }   = await supabase.from('profiles').select('full_name').eq('id', match.opponent_id).single();

    // Notify challenger
    if (!await checkReminderSent(supabase, eventType, match.id, match.challenger_id)) {
      if (await checkEmailPreference(supabase, match.challenger_id, 'match_reminders')) {
        const ok = await sendReminderEmail(supabase, {
          type: 'match_reminder',
          userId: match.challenger_id,
          opponentName: opponent?.full_name ?? 'Opponent',
          date: match.date,
          startTime: match.time_start,
          endTime: match.time_end,
          location: match.location,
          matchType: match.match_type,
          hoursLabel,
        });
        if (ok) {
          await recordReminderSent(supabase, eventType, match.id, match.challenger_id);
          remindersSent.push(`match-${windowKey}-challenger:${match.id}`);
        }
      }
    }

    // Notify opponent
    if (!await checkReminderSent(supabase, eventType, match.id, match.opponent_id)) {
      if (await checkEmailPreference(supabase, match.opponent_id, 'match_reminders')) {
        const ok = await sendReminderEmail(supabase, {
          type: 'match_reminder',
          userId: match.opponent_id,
          opponentName: challenger?.full_name ?? 'Opponent',
          date: match.date,
          startTime: match.time_start,
          endTime: match.time_end,
          location: match.location,
          matchType: match.match_type,
          hoursLabel,
        });
        if (ok) {
          await recordReminderSent(supabase, eventType, match.id, match.opponent_id);
          remindersSent.push(`match-${windowKey}-opponent:${match.id}`);
        }
      }
    }
  }
}

async function checkReminderSent(supabase: any, eventType: string, eventId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('email_reminders_sent')
    .select('id')
    .eq('event_type', eventType)
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .single();
  return !!data;
}

async function recordReminderSent(supabase: any, eventType: string, eventId: string, userId: string) {
  await supabase.from('email_reminders_sent').insert({ event_type: eventType, event_id: eventId, user_id: userId });
}

async function checkEmailPreference(supabase: any, userId: string, preferenceKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('email_preferences')
    .select(preferenceKey)
    .eq('user_id', userId)
    .single();
  if (!data) return true;
  return data[preferenceKey] === true;
}

async function sendReminderEmail(supabase: any, emailData: any): Promise<boolean> {
  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-booking-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(emailData),
    });
    if (!response.ok) {
      console.error('Failed to send reminder email:', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending reminder email:', error);
    return false;
  }
}
