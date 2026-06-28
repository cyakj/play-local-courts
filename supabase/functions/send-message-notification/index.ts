import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend      = new Resend(Deno.env.get("RESEND_API_KEY"));
const fromEmail   = Deno.env.get("FROM_EMAIL") ?? "noreply@tenisx.ai";
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Canonical pair: smaller UUID first for consistent throttle key
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

    // Fetch receiver email
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

    // Upsert throttle record so next send within 30 min is skipped
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
