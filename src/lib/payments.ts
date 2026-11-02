import "server-only";
import Stripe from "stripe";
import { config, integrations } from "./config";

let client: Stripe | null = null;
export function stripe(): Stripe | null {
  if (!integrations.stripe()) return null;
  client ??= new Stripe(config.stripe.secretKey!);
  return client;
}

/** Create a Checkout session. Returns null when Stripe is not configured. */
export async function createCheckout(opts: {
  name: string; description: string; amountCents: number; email: string; metadata: Record<string, string>; returnPath: string;
}): Promise<string | null> {
  const s = stripe();
  if (!s) return null;
  const session = await s.checkout.sessions.create({
    mode: "payment",
    customer_email: opts.email,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: opts.amountCents, product_data: { name: opts.name, description: opts.description } } }],
    metadata: opts.metadata,
    success_url: `${config.appUrl}${opts.returnPath}?paid=1`,
    cancel_url: `${config.appUrl}${opts.returnPath}?cancelled=1`,
  });
  return session.url;
}
