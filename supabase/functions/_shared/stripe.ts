import Stripe from "https://esm.sh/stripe@14.25.0?target=deno";

export function getStripeClient() {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");

  return new Stripe(secretKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

export function getSiteUrl() {
  return Deno.env.get("SITE_URL") ?? "http://localhost:5173";
}

export function toIsoTimestamp(value?: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

export async function upsertSubscriptionRecord(args: {
  supabaseAdmin: any;
  subscription: Stripe.Subscription;
  userId: string;
}) {
  const { supabaseAdmin, subscription, userId } = args;
  const customerId = typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer?.id ?? null;
  const firstItem = subscription.items.data[0];

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: firstItem?.price?.id ?? null,
      status: subscription.status ?? "inactive",
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: toIsoTimestamp(subscription.current_period_start),
      current_period_end: toIsoTimestamp(subscription.current_period_end),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function resolveUserIdFromStripe(args: {
  customerId?: string | null;
  stripe: Stripe;
  subscriptionMetadata?: Record<string, string>;
  supabaseAdmin: any;
}) {
  const { customerId, stripe, subscriptionMetadata, supabaseAdmin } = args;

  if (subscriptionMetadata?.supabase_user_id) {
    return subscriptionMetadata.supabase_user_id;
  }

  if (!customerId) return null;

  const { data: existing } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (existing?.user_id) {
    return existing.user_id;
  }

  const customer = await stripe.customers.retrieve(customerId);
  if (!("deleted" in customer) && customer.metadata?.supabase_user_id) {
    return customer.metadata.supabase_user_id;
  }

  return null;
}
