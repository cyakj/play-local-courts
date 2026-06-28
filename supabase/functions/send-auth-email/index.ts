import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend    = new Resend(Deno.env.get("RESEND_API_KEY"));
const fromEmail = Deno.env.get("FROM_EMAIL") ?? "noreply@tenisx.ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AuthEmailRequest {
  user: {
    email: string;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: AuthEmailRequest = await req.json();
    console.log("Received auth email request for:", payload.user.email);

    const { user, email_data } = payload;
    const { token_hash, email_action_type, redirect_to } = email_data;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) {
      throw new Error("Missing SUPABASE_URL env var");
    }

    const confirmLink = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(email_action_type)}&redirect_to=${encodeURIComponent(redirect_to)}`;

    let subject = "Confirm your email";
    let htmlContent = "";

    if (email_action_type === "signup") {
      subject = "Welcome to TenisX — confirm your email";
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;background:#0C0F18;margin:0;padding:20px;">
            <div style="max-width:600px;margin:0 auto;">
              <div style="background:#0F2A57;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:#2DE0FF;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.02em;">TenisX</h1>
                <p style="color:#9AA3B8;margin:8px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:0.18em;">Welcome</p>
              </div>
              <div style="background:#161A26;padding:32px;border-radius:0 0 12px 12px;border:1px solid #232838;">
                <p style="color:#F5F8FF;font-size:16px;margin-bottom:16px;">Hi there,</p>
                <p style="color:#9AA3B8;font-size:16px;margin-bottom:24px;">You're almost in. Confirm your email address to activate your TenisX account.</p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${confirmLink}" style="background:#2D6BFF;color:#F5F8FF;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;font-size:16px;">Confirm Email Address</a>
                </div>
                <p style="font-size:13px;color:#7A839A;margin-top:24px;">If the button doesn't work, copy and paste this link:</p>
                <p style="font-size:12px;color:#5A6379;word-break:break-all;">${confirmLink}</p>
                <hr style="border:none;border-top:1px solid #232838;margin:28px 0;">
                <p style="font-size:12px;color:#5A6379;">Didn't create this account? You can safely ignore this email.</p>
                <p style="font-size:12px;color:#5A6379;margin-top:16px;">TenisX · noreply@tenisx.ai</p>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (email_action_type === "recovery") {
      subject = "TenisX — reset your password";
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;background:#0C0F18;margin:0;padding:20px;">
            <div style="max-width:600px;margin:0 auto;">
              <div style="background:#0F2A57;padding:32px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:#2DE0FF;margin:0;font-size:28px;font-weight:700;letter-spacing:-0.02em;">TenisX</h1>
                <p style="color:#9AA3B8;margin:8px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:0.18em;">Password Reset</p>
              </div>
              <div style="background:#161A26;padding:32px;border-radius:0 0 12px 12px;border:1px solid #232838;">
                <p style="color:#F5F8FF;font-size:16px;margin-bottom:16px;">Hi there,</p>
                <p style="color:#9AA3B8;font-size:16px;margin-bottom:24px;">We received a request to reset your TenisX password. Click the button below to choose a new one.</p>
                <div style="text-align:center;margin:32px 0;">
                  <a href="${confirmLink}" style="background:#2D6BFF;color:#F5F8FF;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;display:inline-block;font-size:16px;">Reset Password</a>
                </div>
                <p style="font-size:13px;color:#7A839A;margin-top:24px;">If the button doesn't work, copy and paste this link:</p>
                <p style="font-size:12px;color:#5A6379;word-break:break-all;">${confirmLink}</p>
                <hr style="border:none;border-top:1px solid #232838;margin:28px 0;">
                <p style="font-size:12px;color:#5A6379;">Didn't request a password reset? You can safely ignore this email — your account is safe.</p>
                <p style="font-size:12px;color:#5A6379;margin-top:16px;">TenisX · noreply@tenisx.ai</p>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: `TenisX <${fromEmail}>`,
      to: [user.email],
      subject: subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-auth-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
