import { stripe } from "@/lib/stripe";
import { recordPendingTopup } from "@/lib/ledger";
import { config } from "@/lib/config";
import { errorResponse } from "@/lib/http";
import { requireAccount } from "@/lib/auth";

// Starts a Stripe Checkout session that loads money into the caller's wallet.
// From the dashboard the browser goes straight to Checkout; an agent gets the URL to give its person.
export async function POST(req: Request) {
  try {
    const account = await requireAccount(req);
    const { amount } = (await req.json()) as { amount: number }; // dollars
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isFinite(cents) || cents < 500 || cents > 50000)
      return Response.json({ message: "Top-up must be between $5 and $500" }, { status: 400 });
    const origin = new URL(req.url).origin;
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: config.currency,
            unit_amount: cents,
            product_data: { name: "Walley wallet top-up", description: "Prepaid balance your AI agent can spend" },
          },
        },
      ],
      payment_intent_data: { metadata: { walley: "topup", account_id: account.id } },
      metadata: { walley: "topup", account_id: account.id },
      ...(account.email ? { customer_email: account.email } : {}),
      success_url: `${origin}/api/wallet/topup/confirm?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?topup=cancelled`,
    });
    await recordPendingTopup(account.id, cents, session.id);
    return Response.json({ url: session.url, amount_cents: cents });
  } catch (e) {
    return errorResponse(e);
  }
}
