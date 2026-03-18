
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'booking_confirmation' | 'booking_cancellation' | 'booking_reminder' | 
        'lesson_confirmation' | 'lesson_reminder' | 
        'match_confirmation' | 'match_reminder';
  bookingId?: string;
  lessonId?: string;
  matchId?: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  // Court/Amenity specific
  courtName?: string;
  playType?: string;
  // Lesson specific
  coachName?: string;
  sport?: string;
  lessonType?: string;
  // Match specific
  opponentName?: string;
  matchType?: string;
  // Common fields
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  // Admin cancellation specific
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
      // Get user email from auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(emailData.userId);
      if (authError) {
        console.error('Error fetching auth user:', authError);
      }
      userEmail = userEmail || authUser?.user?.email;
      
      // Get user name from profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', emailData.userId)
        .single();
      
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }
      userName = userName || profile?.full_name || 'Player';
    }

    if (!userEmail) {
      console.log('No email address found for user:', emailData.userId);
      return new Response(JSON.stringify({ success: false, error: 'No email address found' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check user's email preferences
    const { data: preferences } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', emailData.userId)
      .single();

    // Format date and time for display
    const formattedDate = new Date(emailData.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let subject = '';
    let htmlContent = '';

    switch (emailData.type) {
      case 'booking_confirmation':
        if (preferences && !preferences.booking_confirmations) {
          console.log('User has disabled booking confirmations');
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        subject = `✅ Court Reservation Confirmed - ${emailData.courtName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Court Reservation Confirmed!</h1>
            <p>Dear ${userName},</p>
            <p>Your court reservation has been confirmed. Here are the details:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Reservation Details</h3>
              <p><strong>Court:</strong> ${emailData.courtName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${emailData.startTime} - ${emailData.endTime}</p>
              <p><strong>Play Type:</strong> ${emailData.playType || 'Singles'}</p>
            </div>
            <p>📍 You'll receive a reminder 1 hour before your reservation.</p>
            <p>Please arrive on time and bring any necessary equipment. If you need to cancel your reservation, please do so at least 2 hours in advance.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">This email was sent automatically. Please do not reply to this email.</p>
          </div>
        `;
        break;

      case 'booking_cancellation':
        if (preferences && !preferences.cancellation_notifications) {
          console.log('User has disabled cancellation notifications');
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        subject = `Court Reservation Cancelled - ${emailData.courtName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc2626;">Court Reservation Cancelled</h1>
            <p>Dear ${userName},</p>
            <p>Your court reservation has been cancelled. Here were the details:</p>
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <h3 style="margin-top: 0; color: #374151;">Cancelled Reservation</h3>
              <p><strong>Court:</strong> ${emailData.courtName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${emailData.startTime} - ${emailData.endTime}</p>
              <p><strong>Play Type:</strong> ${emailData.playType || 'Singles'}</p>
            </div>
            <p>You can make a new reservation anytime through our court reservation system.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">This email was sent automatically. Please do not reply to this email.</p>
          </div>
        `;
        break;

      case 'booking_reminder':
        if (preferences && !preferences.booking_reminders) {
          console.log('User has disabled booking reminders');
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        subject = `⏰ Reminder: Court Reservation in 1 Hour - ${emailData.courtName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #059669;">⏰ Your Court Reservation is in 1 Hour!</h1>
            <p>Dear ${userName},</p>
            <p>This is a friendly reminder about your upcoming court reservation:</p>
            <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
              <h3 style="margin-top: 0; color: #374151;">Upcoming Reservation</h3>
              <p><strong>Court:</strong> ${emailData.courtName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${emailData.startTime} - ${emailData.endTime}</p>
              <p><strong>Play Type:</strong> ${emailData.playType || 'Singles'}</p>
            </div>
            <p>Don't forget to bring your equipment and arrive on time. Have a great game!</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">This email was sent automatically. Please do not reply to this email.</p>
          </div>
        `;
        break;

      case 'lesson_confirmation':
        if (preferences && !preferences.lesson_confirmations) {
          console.log('User has disabled lesson confirmations');
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        subject = `✅ Lesson Confirmed with ${emailData.coachName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Lesson Confirmed!</h1>
            <p>Dear ${userName},</p>
            <p>Great news! Your lesson with ${emailData.coachName} has been confirmed.</p>
            <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <h3 style="margin-top: 0; color: #374151;">Lesson Details</h3>
              <p><strong>Coach:</strong> ${emailData.coachName}</p>
              <p><strong>Sport:</strong> ${emailData.sport}</p>
              <p><strong>Lesson Type:</strong> ${emailData.lessonType}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` - ${emailData.endTime}` : ''}</p>
              ${emailData.location ? `<p><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p>📍 You'll receive a reminder 1 hour before your lesson.</p>
            <p>Please arrive a few minutes early to warm up. Have a great session!</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">This email was sent automatically. Please do not reply to this email.</p>
          </div>
        `;
        break;

      case 'lesson_reminder':
        if (preferences && !preferences.lesson_reminders) {
          console.log('User has disabled lesson reminders');
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        subject = `⏰ Reminder: Lesson with ${emailData.coachName} in 1 Hour`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #f59e0b;">⏰ Your Lesson is in 1 Hour!</h1>
            <p>Dear ${userName},</p>
            <p>Your lesson with ${emailData.coachName} starts in 1 hour!</p>
            <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="margin-top: 0; color: #374151;">Lesson Details</h3>
              <p><strong>Coach:</strong> ${emailData.coachName}</p>
              <p><strong>Sport:</strong> ${emailData.sport}</p>
              <p><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` - ${emailData.endTime}` : ''}</p>
              ${emailData.location ? `<p><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p>🎾 Don't forget your equipment and water! Have an awesome lesson!</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">This email was sent automatically. Please do not reply to this email.</p>
          </div>
        `;
        break;

      case 'match_confirmation':
        if (preferences && !preferences.match_confirmations) {
          console.log('User has disabled match confirmations');
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        subject = `✅ Match Confirmed with ${emailData.opponentName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7c3aed;">Match Confirmed!</h1>
            <p>Dear ${userName},</p>
            <p>Your match with ${emailData.opponentName} has been confirmed!</p>
            <div style="background-color: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
              <h3 style="margin-top: 0; color: #374151;">Match Details</h3>
              <p><strong>Opponent:</strong> ${emailData.opponentName}</p>
              <p><strong>Match Type:</strong> ${emailData.matchType}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` - ${emailData.endTime}` : ''}</p>
              ${emailData.location ? `<p><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p>📍 You'll receive a reminder 1 hour before your match.</p>
            <p>Good luck and have fun! 🎾</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">This email was sent automatically. Please do not reply to this email.</p>
          </div>
        `;
        break;

      case 'match_reminder':
        if (preferences && !preferences.match_reminders) {
          console.log('User has disabled match reminders');
          return new Response(JSON.stringify({ success: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        
        subject = `⏰ Reminder: Match with ${emailData.opponentName} in 1 Hour`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7c3aed;">⏰ Your Match is in 1 Hour!</h1>
            <p>Dear ${userName},</p>
            <p>Your match with ${emailData.opponentName} starts in 1 hour!</p>
            <div style="background-color: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #7c3aed;">
              <h3 style="margin-top: 0; color: #374151;">Match Details</h3>
              <p><strong>Opponent:</strong> ${emailData.opponentName}</p>
              <p><strong>Match Type:</strong> ${emailData.matchType}</p>
              <p><strong>Time:</strong> ${emailData.startTime}${emailData.endTime ? ` - ${emailData.endTime}` : ''}</p>
              ${emailData.location ? `<p><strong>Location:</strong> ${emailData.location}</p>` : ''}
            </div>
            <p>🎾 Warm up, stay hydrated, and play your best! Good luck!</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px;">This email was sent automatically. Please do not reply to this email.</p>
          </div>
        `;
        break;

      default:
        console.log('Unknown email type:', emailData.type);
        return new Response(JSON.stringify({ error: 'Unknown email type' }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "RallyNet <noreply@resend.dev>",
      to: [userEmail],
      subject: subject,
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
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
};

serve(handler);
