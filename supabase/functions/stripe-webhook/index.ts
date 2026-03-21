import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { getStripeClient, resolveUserIdFromStripe, upsertSubscriptionRecord } from "../_shared/stripe.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing Stripe webhook configuration", { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const supabaseAdmin = createAdminClient();
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        const userId = session.client_reference_id
          ?? await resolveUserIdFromStripe({
            customerId: typeof session.customer === "string" ? session.customer : null,
            stripe,
            subscriptionMetadata: subscription.metadata,
            supabaseAdmin,
          });

        if (!userId) throw new Error("No se pudo resolver el usuario de checkout");

        await upsertSubscriptionRecord({
          supabaseAdmin,
          subscription,
          userId,
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id ?? null;
        const userId = await resolveUserIdFromStripe({
          customerId,
          stripe,
          subscriptionMetadata: subscription.metadata,
          supabaseAdmin,
        });

        if (!userId) throw new Error("No se pudo resolver el usuario de la suscripcion");

        await upsertSubscriptionRecord({
          supabaseAdmin,
          subscription,
          userId,
        });
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("stripe-webhook error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error desconocido" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
