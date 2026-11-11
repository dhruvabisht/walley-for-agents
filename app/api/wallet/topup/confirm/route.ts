import { stripe } from "@/lib/stripe";
import { settleTopup } from "@/lib/ledger";

// Stripe Checkout redirects here. We verify the session server-side before crediting the wallet,
// so this works even without a webhook listener running.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  if (!sessionId) return Response.redirect(`${url.origin}/?topup=missing`, 303);
  const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.payment_method"] });
  if (session.payment_status === "paid") {
    const pi = typeof session.payment_intent === "object" ? session.payment_intent : null;
    const pm = pi && typeof pi.payment_method === "object" ? pi.payment_method : null;
    const card = pm?.card ? `${pm.card.brand} •••• ${pm.card.last4}` : null;
    await settleTopup(session.id, pi?.id ?? null, card);
    return Response.redirect(`${url.origin}/?topup=success`, 303);
  }
  return Response.redirect(`${url.origin}/?topup=unpaid`, 303);
}
