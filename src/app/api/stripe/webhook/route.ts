import { NextResponse } from "next/server";
import { stripe } from "@/lib/payments";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Payment events update payment status only — never editorial/broadcast status. */
export async function POST(req: Request) {
  const s = stripe();
  if (!s || !config.stripe.webhookSecret) return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  let event;
  try {
    event = s.webhooks.constructEvent(await req.text(), sig, config.stripe.webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const session = event.data.object;
    const paid = event.type === "checkout.session.completed" && session.payment_status === "paid";
    const { kind, id } = session.metadata ?? {};
    const paymentStatus = paid ? "PAID" : "FAILED";
    if (kind === "submission" && id) await db.submission.update({ where: { id }, data: { paymentStatus, stripeSessionId: session.id } }).catch(() => null);
    if (kind === "booking" && id) await db.booking.update({ where: { id }, data: { paymentStatus, stripeSessionId: session.id } }).catch(() => null);
    await audit({ action: `payment.${paymentStatus.toLowerCase()}`, target: `${kind}:${id}`, details: { session: session.id } });
  }
  return NextResponse.json({ received: true });
}
