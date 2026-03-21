import { getAuthenticatedUser, supabaseAdmin } from "./_lib/supabase";
import { getSiteUrl, stripe } from "./_lib/stripe";

async function handlePost(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    await request.json().catch(() => ({}));
    const userId = user.id;
    const email = user.email;
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!userId || !email || !priceId) {
      return Response.json({ error: "Missing user id or email" }, { status: 400 });
    }

    const { data: existingSubscription, error: existingSubscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingSubscriptionError) {
      console.error("Error reading subscriptions", existingSubscriptionError);
      return Response.json({ error: existingSubscriptionError.message }, { status: 500 });
    }

    let customerId = existingSubscription?.stripe_customer_id ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          supabase_user_id: userId,
        },
      });
      customerId = customer.id;

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
        console.error("Error saving stripe_customer_id in subscriptions", upsertCustomerError);
        return Response.json({ error: upsertCustomerError.message }, { status: 500 });
      }
    }

    const siteUrl = getSiteUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: userId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard?subscribed=true`,
      cancel_url: `${siteUrl}/pricing`,
      metadata: {
        supabase_user_id: userId,
      },
      subscription_data: {
        metadata: {
          supabase_user_id: userId,
        },
      },
    });

    return Response.json({ url: session.url });
  } catch (error: any) {
    console.error("create-checkout-session failed", error);
    return Response.json(
      { error: error.message ?? "Internal server error" },
      { status: error.message === "Unauthorized" ? 401 : 500 },
    );
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
