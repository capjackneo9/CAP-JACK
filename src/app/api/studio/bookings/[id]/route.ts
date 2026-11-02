import { z } from "zod";
import { guarded, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { createCheckout } from "@/lib/payments";

const body = z.object({
  status: z.enum(["REQUESTED", "UNDER_REVIEW", "APPROVED", "DECLINED", "SCHEDULED", "COMPLETED", "CANCELLED"]).optional(),
  internalNotes: z.string().max(5000).optional(),
  priceCents: z.number().int().min(0).max(10_000_000).optional(),
  requestPayment: z.boolean().optional(),
});

export const PATCH = guarded<{ id: string }>("bookings.manage", async (req, actor, { id }) => {
  const b = body.parse(await req.json());
  const booking = await db.booking.findUnique({ where: { id }, include: { product: true } });
  if (!booking) throw new HttpError(404, "Booking not found");
  let checkoutUrl: string | null = null;
  if (b.requestPayment) {
    if (!["APPROVED", "SCHEDULED"].includes(b.status ?? booking.status)) throw new HttpError(409, "Approve the booking before requesting payment");
    const price = b.priceCents ?? booking.priceCents;
    if (!price) throw new HttpError(400, "Set a price first");
    checkoutUrl = await createCheckout({
      name: booking.product?.name ?? `NCVR ${booking.type.replaceAll("_", " ").toLowerCase()}`, description: "NCVR booking — sponsored content is disclosed on-air.",
      amountCents: price, email: booking.email, metadata: { kind: "booking", id }, returnPath: "/radio/advertise",
    });
    if (!checkoutUrl) throw new HttpError(503, "Stripe is not configured");
  }
  const updated = await db.booking.update({
    where: { id },
    data: { status: b.status, internalNotes: b.internalNotes, priceCents: b.priceCents, ...(checkoutUrl ? { paymentStatus: "PENDING" } : {}) },
  });
  await audit({ userId: actor.id, action: "booking.update", target: `booking:${id}`, details: { status: b.status, payment: Boolean(checkoutUrl) } });
  return { booking: updated, checkoutUrl };
});
