import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { settleTopup } from "@/lib/ledger";
import { config } from "@/lib/config";

// Optional: Stripe webhooks (set STRIPE_WEBHOOK_SECRET). The redirect route already credits
// top-ups; this makes it reliable if the user closes the tab before the redirect.
export async function POST(req: Request) {
  const secret = config.webhookSecret();
  if (!secret) return Response.json({ message: "Webhooks not configured" }, { status: 501 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature") || "", secret);
  } catch {
    return Response.json({ message: "Bad signature" }, { status: 400 });
  }
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    if (s.metadata?.walley === "topup" && s.payment_status === "paid")
      await settleTopup(s.id, typeof s.payment_intent === "string" ? s.payment_intent : null, null);
  }
  return Response.json({ received: true });
}
