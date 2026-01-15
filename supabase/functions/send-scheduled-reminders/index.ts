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
    
    // Calculate reminder window: events starting between 55 and 65 minutes from now
    const now = new Date();
    const windowStart = new Date(now.getTime() + 55 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 65 * 60 * 1000);
    
    console.log(`Checking for events between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`);

    const remindersSent: string[] = [];

    // 1. Process Court Bookings
    await processBookingReminders(supabase, windowStart, windowEnd, remindersSent);

    // 2. Process Lesson Reminders
    await processLessonReminders(supabase, windowStart, windowEnd, remindersSent);

    // 3. Process Match Reminders
    await processMatchReminders(supabase, windowStart, windowEnd, remindersSent);

    console.log(`Sent ${remindersSent.length} reminders:`, remindersSent);

    return new Response(
      JSON.stringify({ 
        success: true, 
        remindersSent: remindersSent.length,
        details: remindersSent 
      }),
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
  remindersSent: string[]
) {
  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split('T')[0];
  
  // Query confirmed bookings for today
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      user_id,
      date,
      start_time,
      end_time,
      play_type,
      courts:court_id (name)
    `)
    .eq('date', today)
    .eq('status', 'confirmed');

  if (error) {
    console.error("Error fetching bookings:", error);
    return;
  }

  for (const booking of bookings || []) {
    // Combine date and time to create full datetime
    const eventDateTime = new Date(`${booking.date}T${booking.start_time}`);
    
    // Check if within reminder window
    if (eventDateTime >= windowStart && eventDateTime <= windowEnd) {
      // Check if reminder already sent
      const alreadySent = await checkReminderSent(supabase, 'booking', booking.id, booking.user_id);
      if (alreadySent) continue;

      // Check user email preferences
      const shouldSend = await checkEmailPreference(supabase, booking.user_id, 'booking_reminders');
      if (!shouldSend) continue;

      // Send reminder email
      const emailSent = await sendReminderEmail(supabase, {
        type: 'booking_reminder',
        userId: booking.user_id,
        courtName: booking.courts?.name || 'Court',
        date: booking.date,
        startTime: booking.start_time,
        endTime: booking.end_time,
        playType: booking.play_type
      });

      if (emailSent) {
        await recordReminderSent(supabase, 'booking', booking.id, booking.user_id);
        remindersSent.push(`booking:${booking.id}`);
      }
    }
  }
}

async function processLessonReminders(
  supabase: any, 
  windowStart: Date, 
  windowEnd: Date,
  remindersSent: string[]
) {
  const today = new Date().toISOString().split('T')[0];
  
  // Query accepted lessons for today
  const { data: lessons, error } = await supabase
    .from('lesson_requests')
    .select(`
      id,
      player_id,
      coach_id,
      preferred_date,
      preferred_time_start,
      preferred_time_end,
      sport,
      lesson_type,
      location
    `)
    .eq('preferred_date', today)
    .eq('status', 'accepted');

  if (error) {
    console.error("Error fetching lessons:", error);
    return;
  }

  for (const lesson of lessons || []) {
    const eventDateTime = new Date(`${lesson.preferred_date}T${lesson.preferred_time_start}`);
    
    if (eventDateTime >= windowStart && eventDateTime <= windowEnd) {
      // Get coach name
      const { data: coach } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', lesson.coach_id)
        .single();

      // Get player name  
      const { data: player } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', lesson.player_id)
        .single();

      // Send reminder to PLAYER
      const playerSent = await checkReminderSent(supabase, 'lesson', lesson.id, lesson.player_id);
      if (!playerSent) {
        const shouldSendPlayer = await checkEmailPreference(supabase, lesson.player_id, 'lesson_reminders');
        if (shouldSendPlayer) {
          const emailSent = await sendReminderEmail(supabase, {
            type: 'lesson_reminder',
            userId: lesson.player_id,
            coachName: coach?.full_name || 'Coach',
            date: lesson.preferred_date,
            startTime: lesson.preferred_time_start,
            endTime: lesson.preferred_time_end,
            sport: lesson.sport,
            lessonType: lesson.lesson_type,
            location: lesson.location
          });
          
          if (emailSent) {
            await recordReminderSent(supabase, 'lesson', lesson.id, lesson.player_id);
            remindersSent.push(`lesson-player:${lesson.id}`);
          }
        }
      }

      // Send reminder to COACH
      const coachSent = await checkReminderSent(supabase, 'lesson', lesson.id, lesson.coach_id);
      if (!coachSent) {
        const shouldSendCoach = await checkEmailPreference(supabase, lesson.coach_id, 'lesson_reminders');
        if (shouldSendCoach) {
          const emailSent = await sendReminderEmail(supabase, {
            type: 'lesson_reminder',
            userId: lesson.coach_id,
            playerName: player?.full_name || 'Player',
            date: lesson.preferred_date,
            startTime: lesson.preferred_time_start,
            endTime: lesson.preferred_time_end,
            sport: lesson.sport,
            lessonType: lesson.lesson_type,
            location: lesson.location
          });
          
          if (emailSent) {
            await recordReminderSent(supabase, 'lesson', lesson.id, lesson.coach_id);
            remindersSent.push(`lesson-coach:${lesson.id}`);
          }
        }
      }
    }
  }
}

async function processMatchReminders(
  supabase: any, 
  windowStart: Date, 
  windowEnd: Date,
  remindersSent: string[]
) {
  const today = new Date().toISOString().split('T')[0];
  
  // Query accepted matches for today
  const { data: matches, error } = await supabase
    .from('match_requests')
    .select(`
      id,
      challenger_id,
      opponent_id,
      date,
      time_start,
      time_end,
      location,
      match_type,
      court_type
    `)
    .eq('date', today)
    .eq('status', 'accepted');

  if (error) {
    console.error("Error fetching matches:", error);
    return;
  }

  for (const match of matches || []) {
    const eventDateTime = new Date(`${match.date}T${match.time_start}`);
    
    if (eventDateTime >= windowStart && eventDateTime <= windowEnd) {
      // Get challenger name
      const { data: challenger } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', match.challenger_id)
        .single();

      // Get opponent name
      const { data: opponent } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', match.opponent_id)
        .single();

      // Send reminder to CHALLENGER
      const challengerSent = await checkReminderSent(supabase, 'match', match.id, match.challenger_id);
      if (!challengerSent) {
        const shouldSend = await checkEmailPreference(supabase, match.challenger_id, 'match_reminders');
        if (shouldSend) {
          const emailSent = await sendReminderEmail(supabase, {
            type: 'match_reminder',
            userId: match.challenger_id,
            opponentName: opponent?.full_name || 'Opponent',
            date: match.date,
            startTime: match.time_start,
            endTime: match.time_end,
            location: match.location,
            matchType: match.match_type,
            courtType: match.court_type
          });
          
          if (emailSent) {
            await recordReminderSent(supabase, 'match', match.id, match.challenger_id);
            remindersSent.push(`match-challenger:${match.id}`);
          }
        }
      }

      // Send reminder to OPPONENT
      const opponentSent = await checkReminderSent(supabase, 'match', match.id, match.opponent_id);
      if (!opponentSent) {
        const shouldSend = await checkEmailPreference(supabase, match.opponent_id, 'match_reminders');
        if (shouldSend) {
          const emailSent = await sendReminderEmail(supabase, {
            type: 'match_reminder',
            userId: match.opponent_id,
            opponentName: challenger?.full_name || 'Opponent',
            date: match.date,
            startTime: match.time_start,
            endTime: match.time_end,
            location: match.location,
            matchType: match.match_type,
            courtType: match.court_type
          });
          
          if (emailSent) {
            await recordReminderSent(supabase, 'match', match.id, match.opponent_id);
            remindersSent.push(`match-opponent:${match.id}`);
          }
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
  await supabase
    .from('email_reminders_sent')
    .insert({
      event_type: eventType,
      event_id: eventId,
      user_id: userId
    });
}

async function checkEmailPreference(supabase: any, userId: string, preferenceKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('email_preferences')
    .select(preferenceKey)
    .eq('user_id', userId)
    .single();
  
  // If no preferences found, default to true
  if (!data) return true;
  
  return data[preferenceKey] === true;
}

async function sendReminderEmail(supabase: any, emailData: any): Promise<boolean> {
  try {
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-booking-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
      body: JSON.stringify(emailData)
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
