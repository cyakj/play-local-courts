import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { lessonRequestId, coachId } = await req.json();
    if (!lessonRequestId || !coachId) {
      throw new Error("Missing required fields");
    }

    // Get lesson request details
    const { data: lessonRequest, error: lessonError } = await supabaseClient
      .from("lesson_requests")
      .select("*, coach:profiles!lesson_requests_coach_id_fkey(full_name)")
      .eq("id", lessonRequestId)
      .single();

    if (lessonError) throw lessonError;

    // Get coach's hourly rate
    const { data: coachData, error: coachError } = await supabaseClient
      .from("coaches")
      .select("hourly_rate, stripe_accounts!stripe_accounts_coach_id_fkey(stripe_account_id)")
      .eq("user_id", coachId)
      .single();

    if (coachError) throw coachError;
    if (!coachData.hourly_rate) throw new Error("Coach has not set hourly rate");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const amount = Math.round(coachData.hourly_rate * 100); // Convert to cents
    const applicationFeeAmount = Math.round(amount * 0.10); // 10% platform fee

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Tennis Lesson with ${lessonRequest.coach?.full_name || 'Coach'}`,
              description: `${lessonRequest.lesson_type} - ${lessonRequest.sport}`,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/my-locker?payment=success&lesson=${lessonRequestId}`,
      cancel_url: `${req.headers.get("origin")}/my-locker?payment=cancelled`,
      metadata: {
        lesson_request_id: lessonRequestId,
        player_id: user.id,
        coach_id: coachId,
      },
    };

    // Add Stripe Connect if coach has connected account
    if (coachData.stripe_accounts?.[0]?.stripe_account_id) {
      sessionParams.payment_intent_data = {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: coachData.stripe_accounts[0].stripe_account_id,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Create pending transaction
    await supabaseClient.from("transactions").insert({
      lesson_request_id: lessonRequestId,
      player_id: user.id,
      coach_id: coachId,
      stripe_checkout_session_id: session.id,
      amount: amount,
      currency: "usd",
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating checkout:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
