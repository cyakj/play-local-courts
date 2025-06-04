
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
  type: 'booking_confirmation' | 'booking_cancellation' | 'booking_reminder';
  bookingId: string;
  userEmail: string;
  userName: string;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  playType?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const emailData: EmailRequest = await req.json();
    
    console.log('Sending email for booking:', emailData.bookingId);

    // Check user's email preferences
    const { data: preferences } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', emailData.bookingId)
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
        
        subject = `Court Reservation Confirmed - ${emailData.courtName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Court Reservation Confirmed!</h1>
            <p>Dear ${emailData.userName},</p>
            <p>Your court reservation has been confirmed. Here are the details:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #374151;">Reservation Details</h3>
              <p><strong>Court:</strong> ${emailData.courtName}</p>
              <p><strong>Date:</strong> ${formattedDate}</p>
              <p><strong>Time:</strong> ${emailData.startTime} - ${emailData.endTime}</p>
              <p><strong>Play Type:</strong> ${emailData.playType || 'Singles'}</p>
            </div>
            <p>Please arrive on time and bring any necessary equipment. If you need to cancel your reservation, please do so at least 2 hours in advance.</p>
            <p>Thank you for using our court reservation system!</p>
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
            <p>Dear ${emailData.userName},</p>
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
        
        subject = `Reminder: Your Court Reservation Tomorrow - ${emailData.courtName}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #059669;">Reminder: Your Court Reservation Tomorrow</h1>
            <p>Dear ${emailData.userName},</p>
            <p>This is a friendly reminder about your upcoming court reservation:</p>
            <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
              <h3 style="margin-top: 0; color: #374151;">Tomorrow's Reservation</h3>
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
    }

    // Send the email
    const emailResponse = await resend.emails.send({
      from: "HOA Court System <noreply@resend.dev>",
      to: [emailData.userEmail],
      subject: subject,
      html: htmlContent,
    });

    // Log the email attempt
    await supabase
      .from('email_logs')
      .insert({
        user_id: emailData.bookingId,
        email_type: emailData.type,
        recipient_email: emailData.userEmail,
        subject: subject,
        status: 'sent'
      });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailId: emailResponse.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error sending email:", error);
    
    // Log the error
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    await supabase
      .from('email_logs')
      .insert({
        email_type: 'error',
        recipient_email: 'unknown',
        subject: 'Email send failed',
        status: 'failed',
        error_message: error.message
      });

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
