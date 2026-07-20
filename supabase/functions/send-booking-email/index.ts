
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@tenisx.ai";
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type:
    | 'booking_confirmation' | 'booking_cancellation' | 'booking_reminder'
    | 'lesson_confirmation'  | 'lesson_reminder'
    | 'lesson_request_received' | 'lesson_declined' | 'lesson_cancelled'
    | 'lesson_expired' | 'lesson_expired_coach'
    | 'match_confirmation'   | 'match_reminder'
    | 'match_request_received' | 'match_declined'
    | 'match_invite'
    | 'hoa_approved'         | 'hoa_rejected';
  bookingId?: string;
  lessonId?: string;
  matchId?: string;
  userId: string;
  playerId?: string;
  userEmail?: string;
  userName?: string;
  // Court/Amenity specific
  courtName?: string;
  playType?: string;
  // Lesson specific
  coachName?: string;
  playerName?: string;
  sport?: string;
  lessonType?: string;
  // Match specific
  opponentName?: string;
  matchType?: string;
  // Common fields
  date?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  hoursLabel?: string;
  // Cancellation specific
  communityName?: string;
  cancellationReason?: string;
  isAdminCancellation?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const emailData: EmailRequest = await req.json();

    console.log('Sending email:', emailData.type, 'for user:', emailData.userId);

    // Fetch user email and name if not provided
    let userEmail = emailData.userEmail;
    let userName = emailData.userName;

    if (!userEmail || !userName) {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(emailData.userId);
      if (authError) console.error('Error fetching auth user:', authError);
      userEmail = userEmail || authUser?.user?.email;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', emailData.userId)
        .single();
      userName = userName || profile?.full_name || 'Player';
    }

    if (!userEmail) {
      console.log('No email address found for user:', emailData.userId);
      return new Response(JSON.stringify({ success: false, error: 'No email address found' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Fetch player name for coach-directed emails when playerId provided
    let playerName = emailData.playerName;
    if (!playerName && emailData.playerId) {
      const { data: playerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', emailData.playerId)
        .single();
      playerName = playerProfile?.full_name ?? 'Player';
    }

    // Check user's email preferences
    const { data: preferences } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', emailData.userId)
      .single();

    const formattedDate = emailData.date
      ? new Date(emailData.date).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })
      : '';

    const hoursLabel = emailData.hoursLabel ?? '1 Hour';

    let subject = '';
    let htmlContent = '';

    switch (emailData.type) {
      case 'booking_confirmation':
        if (preferences && !preferences.booking_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Court Reservation Confirmed — ${emailData.courtName}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2FD98B;font-size:22px;margin-bottom:8px;">Reservation Confirmed</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <div style="background:#161A26;border:1px solid #232838;border-radius:10px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 8px;font-size:13px;color:#2DE0FF;letter-spacing:1px;text-transform:uppercase;">Reservation Details</p>
              <p style="margin:6px 0;"><strong>Court:</strong> ${emailData.courtName}</p>
              <p style="margin:6px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime} – ${emailData.endTime}</p>
              <p style="margin:6px 0;"><strong>Play Type:</strong> ${emailData.playType ?? 'Singles'}</p>
            </div>
            <p style="color:#9AA3B8;font-size:13px;">You'll receive a reminder before your reservation. Please cancel at least 2 hours in advance if your plans change.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'booking_cancellation': {
        if (preferences && !preferences.cancellation_notifications) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const communityLabel = emailData.communityName ?? 'your community';
        const reasonLine = emailData.cancellationReason
          ? `<p style="margin:6px 0;"><strong>Reason:</strong> ${emailData.cancellationReason}</p>`
          : '';
        const isAdmin = emailData.isAdminCancellation;
        subject = isAdmin
          ? `Your booking at ${emailData.courtName} was cancelled — ${communityLabel}`
          : `Court Reservation Cancelled — ${emailData.courtName}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#FF5C6B;font-size:22px;margin-bottom:8px;">${isAdmin ? 'Booking Cancelled by Management' : 'Reservation Cancelled'}</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <div style="background:#161A26;border:1px solid #FF5C6B44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #FF5C6B;">
              <p style="margin:6px 0;"><strong>Court:</strong> ${emailData.courtName}</p>
              <p style="margin:6px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime} – ${emailData.endTime}</p>
              ${emailData.playType ? `<p style="margin:6px 0;"><strong>Type:</strong> ${emailData.playType}</p>` : ''}
              ${reasonLine}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">${isAdmin ? `Cancelled by ${communityLabel} management. You can rebook in the app.` : 'You can make a new reservation any time through the app.'}</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;
      }

      case 'booking_reminder':
        if (preferences && !preferences.booking_reminders) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Reminder: Court in ${hoursLabel} — ${emailData.courtName}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2DE0FF;font-size:22px;margin-bottom:8px;">Court in ${hoursLabel}</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <div style="background:#161A26;border:1px solid #2DE0FF44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #2DE0FF;">
              <p style="margin:6px 0;"><strong>Court:</strong> ${emailData.courtName}</p>
              <p style="margin:6px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime} – ${emailData.endTime}</p>
              <p style="margin:6px 0;"><strong>Play Type:</strong> ${emailData.playType ?? 'Singles'}</p>
            </div>
            <p style="color:#9AA3B8;font-size:13px;">Bring your equipment and arrive on time. Have a great game!</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'lesson_confirmation':
        if (preferences && !preferences.lesson_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Lesson Confirmed with ${emailData.coachName}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2FD98B;font-size:22px;margin-bottom:8px;">Lesson Confirmed</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName}, your lesson with ${emailData.coachName} is confirmed.</p>
            <div style="background:#161A26;border:1px solid #2FD98B44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #2FD98B;">
              <p style="margin:6px 0;"><strong>Coach:</strong> ${emailData.coachName}</p>
              ${emailData.lessonType ? `<p style="margin:6px 0;"><strong>Lesson Type:</strong> ${emailData.lessonType}</p>` : ''}
              <p style="margin:6px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` – ${emailData.endTime}` : ''}</p>
              ${emailData.location ? `<p style="margin:6px 0;"><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">You'll receive a reminder before your lesson. Arrive a few minutes early to warm up.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'lesson_reminder':
        if (preferences && !preferences.lesson_reminders) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Reminder: Lesson in ${hoursLabel}${emailData.coachName ? ` with ${emailData.coachName}` : ''}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2DE0FF;font-size:22px;margin-bottom:8px;">Lesson in ${hoursLabel}</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <div style="background:#161A26;border:1px solid #2DE0FF44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #2DE0FF;">
              ${emailData.coachName ? `<p style="margin:6px 0;"><strong>Coach:</strong> ${emailData.coachName}</p>` : ''}
              ${emailData.playerName ? `<p style="margin:6px 0;"><strong>Student:</strong> ${emailData.playerName}</p>` : ''}
              <p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` – ${emailData.endTime}` : ''}</p>
              ${emailData.location ? `<p style="margin:6px 0;"><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">Don't forget your equipment and water. Have a great session!</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'lesson_request_received':
        // To the coach — use lesson_confirmations pref as proxy; default send if no pref
        if (preferences && preferences.lesson_confirmations === false) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `New Lesson Request from ${playerName ?? 'a student'}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2D6BFF;font-size:22px;margin-bottom:8px;">New Lesson Request</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName}, you have a new lesson request.</p>
            <div style="background:#161A26;border:1px solid #2D6BFF44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #2D6BFF;">
              <p style="margin:6px 0;"><strong>Student:</strong> ${playerName ?? 'Unknown'}</p>
              ${emailData.lessonType ? `<p style="margin:6px 0;"><strong>Lesson Type:</strong> ${emailData.lessonType}</p>` : ''}
              ${emailData.date ? `<p style="margin:6px 0;"><strong>Preferred Date:</strong> ${formattedDate}</p>` : ''}
              ${emailData.startTime ? `<p style="margin:6px 0;"><strong>Preferred Time:</strong> ${emailData.startTime}${emailData.endTime ? ` – ${emailData.endTime}` : ''}</p>` : ''}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">Open the TenisX app to review and respond within 48 hours.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'lesson_declined':
        if (preferences && !preferences.lesson_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Your lesson request was not accepted`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#FF5C6B;font-size:22px;margin-bottom:8px;">Lesson Request Declined</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <p style="color:#9AA3B8;">Unfortunately ${emailData.coachName ?? 'the coach'} was unable to accept your lesson request${emailData.date ? ` for ${formattedDate}` : ''}.</p>
            ${emailData.cancellationReason ? `<p style="color:#9AA3B8;"><strong>Reason:</strong> ${emailData.cancellationReason}</p>` : ''}
            <p style="color:#9AA3B8;font-size:13px;margin-top:16px;">You can browse other coaches or submit a new request with different dates in the TenisX app.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'lesson_cancelled':
        if (preferences && !preferences.lesson_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Your lesson with ${emailData.coachName ?? 'your coach'} has been cancelled`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#FF5C6B;font-size:22px;margin-bottom:8px;">Lesson Cancelled</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <p style="color:#F5F8FF;">${emailData.coachName ?? 'Your coach'} has cancelled your upcoming lesson${emailData.date ? ` on ${formattedDate}` : ''}.</p>
            <div style="background:#161A26;border:1px solid #FF5C6B44;border-radius:10px;padding:20px;margin:20px 0;border-left:4px solid #FF5C6B;">
              ${emailData.coachName ? `<p style="margin:6px 0;"><strong>Coach:</strong> ${emailData.coachName}</p>` : ''}
              ${emailData.lessonType ? `<p style="margin:6px 0;"><strong>Lesson Type:</strong> ${emailData.lessonType}</p>` : ''}
              ${emailData.date ? `<p style="margin:6px 0;"><strong>Date:</strong> ${formattedDate}</p>` : ''}
              ${emailData.startTime ? `<p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` – ${emailData.endTime}` : ''}</p>` : ''}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">You can browse other coaches and book a new session in the TenisX app.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'lesson_expired':
        if (preferences && !preferences.lesson_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Your lesson request has expired`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#FF5C6B;font-size:22px;margin-bottom:8px;">Lesson Request Expired</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <p style="color:#F5F8FF;">Your lesson request${emailData.coachName ? ` with ${emailData.coachName}` : ''}${emailData.date ? ` for ${formattedDate}` : ''} was not accepted in time and has expired.</p>
            <p style="color:#9AA3B8;font-size:13px;margin-top:16px;">You can browse other available coaches or send a new request in the TenisX app.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

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

      case 'match_invite':
        if (preferences && !preferences.match_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `${emailData.opponentName ?? 'A player'} invited you to a match`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2D6BFF;font-size:22px;margin-bottom:8px;">New Match Invite</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName}, ${emailData.opponentName ?? 'another player'} invited you to a match.</p>
            <div style="background:#161A26;border:1px solid #2D6BFF44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #2D6BFF;">
              ${emailData.matchType ? `<p style="margin:6px 0;"><strong>Format:</strong> ${emailData.matchType}</p>` : ''}
              ${emailData.date ? `<p style="margin:6px 0;"><strong>Date:</strong> ${formattedDate}</p>` : ''}
              ${emailData.startTime ? `<p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` – ${emailData.endTime}` : ''}</p>` : ''}
              ${emailData.location ? `<p style="margin:6px 0;"><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">Open TenisX to accept or decline the invite.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'match_confirmation':
        if (preferences && !preferences.match_confirmations) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Match Confirmed with ${emailData.opponentName}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2FD98B;font-size:22px;margin-bottom:8px;">Match Confirmed</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName}, your match with ${emailData.opponentName} is confirmed!</p>
            <div style="background:#161A26;border:1px solid #2FD98B44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #2FD98B;">
              <p style="margin:6px 0;"><strong>Opponent:</strong> ${emailData.opponentName}</p>
              ${emailData.matchType ? `<p style="margin:6px 0;"><strong>Match Type:</strong> ${emailData.matchType}</p>` : ''}
              <p style="margin:6px 0;"><strong>Date:</strong> ${formattedDate}</p>
              <p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` – ${emailData.endTime}` : ''}</p>
              ${emailData.location ? `<p style="margin:6px 0;"><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">Good luck and have fun!</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'match_reminder':
        if (preferences && !preferences.match_reminders) {
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        subject = `Reminder: Match in ${hoursLabel} with ${emailData.opponentName}`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2DE0FF;font-size:22px;margin-bottom:8px;">Match in ${hoursLabel}</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName}, your match with ${emailData.opponentName} starts in ${hoursLabel}!</p>
            <div style="background:#161A26;border:1px solid #2DE0FF44;border-radius:10px;padding:20px;margin-bottom:20px;border-left:4px solid #2DE0FF;">
              <p style="margin:6px 0;"><strong>Opponent:</strong> ${emailData.opponentName}</p>
              <p style="margin:6px 0;"><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` – ${emailData.endTime}` : ''}</p>
              ${emailData.location ? `<p style="margin:6px 0;"><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p style="color:#9AA3B8;font-size:13px;">Warm up, stay hydrated, and play your best!</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'hoa_approved':
        // Mandatory — always send regardless of preferences
        subject = `Welcome to the community — your membership is approved`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#2FD98B;font-size:22px;margin-bottom:8px;">Membership Approved</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <p style="color:#F5F8FF;">Great news — your membership request has been approved! You now have access to your community's courts and amenities through TenisX.</p>
            <p style="color:#9AA3B8;font-size:13px;margin-top:16px;">Open the app to start booking courts.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      case 'hoa_rejected':
        // Mandatory — always send regardless of preferences
        subject = `Update on your community membership request`;
        htmlContent = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0C0F18;color:#F5F8FF;padding:32px;border-radius:12px;">
            <h1 style="color:#FF5C6B;font-size:22px;margin-bottom:8px;">Membership Request Not Approved</h1>
            <p style="color:#9AA3B8;margin-bottom:24px;">Hi ${userName},</p>
            <p style="color:#F5F8FF;">Unfortunately, your membership request was not approved at this time. If you believe this was in error, please contact your community administrator directly.</p>
            <p style="color:#5A6379;font-size:12px;margin-top:32px;">TenisX · noreply@tenisx.ai</p>
          </div>
        `;
        break;

      default:
        console.log('Unknown email type:', (emailData as any).type);
        return new Response(JSON.stringify({ error: 'Unknown email type' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    const emailResponse = await resend.emails.send({
      from: `TenisX <${fromEmail}>`,
      to: [userEmail],
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
