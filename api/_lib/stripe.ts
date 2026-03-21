import Stripe from "stripe";

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    console.error("Missing Stripe environment variable", { name, present: false });
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function getStripeClient() {
  return new Stripe(getEnv("STRIPE_SECRET_KEY"), {
    apiVersion: "2026-02-25.clover",
  });
}
