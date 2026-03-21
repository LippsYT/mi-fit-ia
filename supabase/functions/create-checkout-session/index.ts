import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient, requireUser } from "../_shared/supabase.ts";
import { getSiteUrl, getStripeClient } from "../_shared/stripe.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user } = await requireUser(req);
    const supabaseAdmin = createAdminClient();
    const stripe = getStripeClient();
    const priceId = Deno.env.get("STRIPE_PRICE_ID");

    if (!priceId) throw new Error("STRIPE_PRICE_ID is not configured");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("name, stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw new Error("Perfil no encontrado");

    let customerId = profile.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile.name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    } else {
      await stripe.customers.update(customerId, {
        email: user.email,
        name: profile.name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
    }

    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        status: "inactive",
      },
      { onConflict: "user_id" },
    );

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${getSiteUrl()}/dashboard?checkout=success`,
      cancel_url: `${getSiteUrl()}/dashboard?checkout=cancelled`,
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      metadata: { supabase_user_id: user.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("create-checkout-session error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
