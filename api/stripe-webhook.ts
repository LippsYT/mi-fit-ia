import { supabaseAdmin } from "./_lib/supabase";
import { stripe } from "./_lib/stripe";

function toIsoDate(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

async function upsertSubscription(data: {
  current_period_end: string | null;
  status: string;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_id: string | null;
  user_id: string;
}) {
  const { error } = await supabaseAdmin.from("subscriptions").upsert(data, {
    onConflict: "user_id",
  });

  if (error) {
    console.error("Error updating subscriptions from webhook", error, data);
    throw error;
  }
}

async function resolveUserId(customerId: string | null, metadata?: Record<string, string>) {
  if (metadata?.supabase_user_id) {
    return metadata.supabase_user_id;
  }

  if (!customerId) {
    return null;
  }

  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.user_id ?? null;
}

async function handlePost(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return Response.json({ error: "Missing webhook configuration" }, { status: 400 });
    }

    const rawBody = await request.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const userId = session.client_reference_id ?? await resolveUserId(customerId, session.metadata ?? {});

      if (userId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription));
        await upsertSubscription({
          current_period_end: toIsoDate(subscription.current_period_end),
          status: subscription.status,
          stripe_customer_id: customerId,
          stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
          stripe_subscription_id: subscription.id,
          user_id: userId,
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      const userId = await resolveUserId(customerId, subscription.metadata ?? {});

      if (userId) {
        await upsertSubscription({
          current_period_end: toIsoDate(subscription.current_period_end),
          status: subscription.status,
          stripe_customer_id: customerId,
          stripe_price_id: subscription.items.data[0]?.price?.id ?? null,
          stripe_subscription_id: subscription.id,
          user_id: userId,
        });
      }
    }

    return Response.json({ received: true });
  } catch (error: any) {
    console.error("stripe-webhook failed", error);
    return Response.json({ error: error.message ?? "Webhook failed" }, { status: 400 });
  }
}

export default {
  async fetch(request: Request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    return handlePost(request);
  },
};
