import { getSupabaseAdmin } from "./_lib/supabase.js";
import { getStripeClient } from "./_lib/stripe.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function sendJson(res: any, status: number, payload: Record<string, unknown>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function toIsoDate(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

async function readRawBody(req: any) {
  const chunks: Buffer[] = [];

  return new Promise<string>((resolve, reject) => {
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", (error: Error) => reject(error));
  });
}

async function upsertSubscription(data: {
  current_period_end: string | null;
  status: string;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_id: string | null;
  user_id: string;
}) {
  const { error } = await getSupabaseAdmin().from("subscriptions").upsert(data, {
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

  const { data } = await getSupabaseAdmin()
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.user_id ?? null;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const signature = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return sendJson(res, 400, { error: "Missing webhook configuration" });
    }

    const rawBody = await readRawBody(req);
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const userId = session.client_reference_id ?? await resolveUserId(customerId, session.metadata ?? {});

      if (userId && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(String(session.subscription)) as any;
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
      const subscription = event.data.object as any;
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

    return sendJson(res, 200, { received: true });
  } catch (error: any) {
    console.error("stripe-webhook failed", error);
    return sendJson(res, 400, { error: error?.message ?? "Webhook failed" });
  }
}
