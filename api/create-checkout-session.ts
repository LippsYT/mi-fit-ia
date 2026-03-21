import { getSupabaseAdmin, getAuthenticatedUserFromAccessToken } from "./_lib/supabase.js";
import { getStripeClient } from "./_lib/stripe.js";

type JsonResponse = {
  error?: string;
  url?: string;
};

type CheckoutBody = {
  email?: string;
  userId?: string;
};

function sendJson(res: any, status: number, payload: JsonResponse) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function getBearerToken(req: any) {
  const header = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof header !== "string") {
    return "";
  }
  return header.replace(/^Bearer\s+/i, "").trim();
}

function parseJsonBody(req: any): CheckoutBody {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      console.error("Invalid JSON body in create-checkout-session", { error, body: req.body });
      throw new Error("Invalid JSON body");
    }
  }

  if (typeof req.body === "object") {
    return req.body as CheckoutBody;
  }

  return {};
}

function getRequestOrigin(req: any) {
  const origin = req.headers?.origin;
  if (typeof origin === "string" && origin.length > 0) {
    return origin;
  }

  const forwardedProto = req.headers?.["x-forwarded-proto"];
  const forwardedHost = req.headers?.["x-forwarded-host"] ?? req.headers?.host;
  const proto = typeof forwardedProto === "string" ? forwardedProto : "https";
  const host = typeof forwardedHost === "string" ? forwardedHost : "";

  if (!host) {
    console.error("Could not determine request origin", {
      forwardedHost,
      forwardedProto,
      host: req.headers?.host,
    });
    throw new Error("Missing request origin");
  }

  return `${proto}://${host}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  try {
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!priceId) {
      console.error("Missing STRIPE_PRICE_ID in Vercel environment", {
        STRIPE_SECRET_KEY: Boolean(process.env.STRIPE_SECRET_KEY),
        STRIPE_PRICE_ID: Boolean(process.env.STRIPE_PRICE_ID),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
        VITE_SUPABASE_URL: Boolean(process.env.VITE_SUPABASE_URL),
        VITE_SUPABASE_ANON_KEY: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
        VITE_SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.VITE_SUPABASE_PUBLISHABLE_KEY),
      });
      return sendJson(res, 500, { error: "Missing STRIPE_PRICE_ID" });
    }

    const body = parseJsonBody(req);
    const userId = body.userId?.trim();
    const email = body.email?.trim();
    const accessToken = getBearerToken(req);

    if (!userId || !email) {
      console.error("Missing user payload in create-checkout-session", { body });
      return sendJson(res, 400, { error: "Missing userId or email" });
    }

    const authUser = await getAuthenticatedUserFromAccessToken(accessToken);

    if (authUser.id !== userId || (authUser.email && authUser.email !== email)) {
      console.error("Authenticated user does not match request body", {
        authEmail: authUser.email,
        authUserId: authUser.id,
        email,
        userId,
      });
      return sendJson(res, 403, { error: "Authenticated user mismatch" });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const stripe = getStripeClient();

    const { data: existingSubscription, error: existingSubscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingSubscriptionError) {
      console.error("Error reading subscriptions before checkout", existingSubscriptionError);
      return sendJson(res, 500, { error: existingSubscriptionError.message });
    }

    let customerId = existingSubscription?.stripe_customer_id ?? null;

    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email,
          metadata: {
            supabase_user_id: userId,
          },
        });
        customerId = customer.id;
      } catch (error: any) {
        console.error("Stripe customer creation failed", {
          error,
          email,
          userId,
        });
        return sendJson(res, 500, { error: error?.message ?? "Stripe customer creation failed" });
      }

      const { error: upsertCustomerError } = await supabaseAdmin
        .from("subscriptions")
        .upsert(
          {
            user_id: userId,
            stripe_customer_id: customerId,
            status: "inactive",
          },
          { onConflict: "user_id" },
        );

      if (upsertCustomerError) {
        console.error("Error saving stripe_customer_id in public.subscriptions", upsertCustomerError);
        return sendJson(res, 500, { error: upsertCustomerError.message });
      }
    }

    const origin = getRequestOrigin(req);

    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: userId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${origin}/dashboard?subscribed=true`,
        cancel_url: `${origin}/dashboard?canceled=true`,
        metadata: {
          supabase_user_id: userId,
        },
        subscription_data: {
          metadata: {
            supabase_user_id: userId,
          },
        },
      });

      if (!checkoutSession.url) {
        console.error("Stripe checkout session created without URL", { checkoutSession });
        return sendJson(res, 500, { error: "Stripe did not return a checkout URL" });
      }

      return sendJson(res, 200, { url: checkoutSession.url });
    } catch (error: any) {
      console.error("Stripe checkout session creation failed", {
        error,
        origin,
        priceId,
        userId,
      });
      return sendJson(res, 500, { error: error?.message ?? "Stripe checkout session failed" });
    }
  } catch (error: any) {
    console.error("Unhandled create-checkout-session error", error);
    return sendJson(res, 500, { error: error?.message ?? "Internal server error" });
  }
}
