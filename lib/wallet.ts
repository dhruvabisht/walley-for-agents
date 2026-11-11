// The wallet: holds the user's prepaid balance and is the only thing that can mint
// Shared Payment Tokens (SPTs). The agent never sees a card; it asks the wallet to pay.
import { q } from "./db";
import { config } from "./config";
import { stripe, stripePreview, StripeApiError } from "./stripe";
import { attachSpt, placeHold, recordDeclined, releaseHold, settlePurchase, type HoldInput } from "./ledger";

// The wallet's funding card. In the sandbox this is a Stripe test card; in production it would be
// a Stripe Issuing virtual card funded by the user's top-ups.
async function fundingPaymentMethod(): Promise<string> {
  const [row] = await q<{ value: string }>(`select value from wallet_config where key = 'funding_pm'`);
  if (row) return row.value;
  const s = stripe();
  const customer = await s.customers.create({ name: "Walley wallet (funding)", metadata: { walley: "funding" } });
  const pm = await s.paymentMethods.create({ type: "card", card: { token: "tok_visa" } });
  await s.paymentMethods.attach(pm.id, { customer: customer.id });
  await q(`insert into wallet_config (key, value) values ('funding_pm', $1) on conflict (key) do nothing`, [pm.id]);
  const [saved] = await q<{ value: string }>(`select value from wallet_config where key = 'funding_pm'`);
  return saved.value;
}

export type SptResult = { id: string; mode: "issued" | "sandbox_granted"; expiresAt: number };

// Issue an SPT scoped to one seller, capped at the exact order total, expiring in 15 minutes.
// 1) Real agent-side API: POST /v1/shared_payment/issued_tokens (needs a Stripe profile on the account).
// 2) Sandbox fallback: POST /v1/test_helpers/shared_payment/granted_tokens, which simulates the same
//    token arriving at the seller. Same usage limits; the ledger records which path was used.
export async function issueSpt(amount: number, currency: string): Promise<SptResult> {
  const expiresAt = Math.floor(Date.now() / 1000) + config.sptTtlSeconds;
  const pm = await fundingPaymentMethod();
  const usage_limits = { currency, max_amount: amount, expires_at: expiresAt };
  try {
    const t = await stripePreview<{ id: string }>("POST", "/v1/shared_payment/issued_tokens", {
      payment_method: pm,
      seller_details: { network_business_profile: config.sellerProfile() },
      usage_limits,
      return_url: "https://walley.example/agent-checkout/return",
    });
    // An issued token is granted to the seller's profile. Our demo sellers share this sandbox
    // account, so only use it directly when the seller profile is our own.
    if (process.env.WALLEY_SELLER_PROFILE) return { id: t.id, mode: "issued", expiresAt };
  } catch (e) {
    if (!(e instanceof StripeApiError)) throw e;
    // Most common in a fresh sandbox: "This API key does not correspond to a Stripe profile."
  }
  const g = await stripePreview<{ id: string }>("POST", "/v1/test_helpers/shared_payment/granted_tokens", {
    payment_method: "pm_card_visa",
    usage_limits,
  });
  return { id: g.id, mode: "sandbox_granted", expiresAt };
}

type UcpCheckout = {
  id: string;
  status: string;
  currency: string;
  merchant: { id: string; name: string; url: string };
  line_items: { item: { title: string; price: number }; quantity: number }[];
  totals: { type: string; amount: number }[];
  order: { id: string; payment_intent_id: string } | null;
};

// Full purchase: hold funds -> mint SPT -> UCP complete -> settle (or release on failure).
export async function payForCheckout(opts: {
  ucpBaseUrl: string; // e.g. https://host/api/ucp/alpine-supply
  checkoutId: string;
  agentRequest: string;
}) {
  const res = await fetch(`${opts.ucpBaseUrl}/checkout-sessions/${opts.checkoutId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load checkout ${opts.checkoutId} (${res.status})`);
  const checkout = (await res.json()) as UcpCheckout;
  if (checkout.status === "completed") return { already: true, checkout };
  const total = checkout.totals.find((t) => t.type === "total")?.amount ?? 0;

  if (total <= 0) throw new Error("Checkout total is zero");

  const hold: HoldInput = {
    amount: total,
    currency: checkout.currency,
    merchantId: checkout.merchant.id,
    merchantName: checkout.merchant.name,
    merchantUrl: checkout.merchant.url,
    items: checkout.line_items.map((li) => ({ title: li.item.title, quantity: li.quantity, unit_amount: li.item.price })),
    agentRequest: opts.agentRequest,
    ucpCheckoutId: checkout.id,
  };
  if (total > config.maxOrderAmount()) {
    const reason = `Over the per-order limit of $${(config.maxOrderAmount() / 100).toFixed(2)}`;
    await recordDeclined(hold, reason);
    throw new Error(`${reason}. Order total is $${(total / 100).toFixed(2)}.`);
  }
  const entryId = await placeHold(hold);
  if (!entryId) {
    const reason = "Insufficient wallet balance";
    await recordDeclined(hold, reason);
    throw new Error(`${reason}. Ask the user to top up.`);
  }

  try {
    const spt = await issueSpt(total, checkout.currency);
    await attachSpt(entryId, spt.id, spt.mode);

    const done = await fetch(`${opts.ucpBaseUrl}/checkout-sessions/${checkout.id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_data: { token: spt.id, provider: "stripe" } }),
      cache: "no-store",
    });
    const completed = await done.json();
    if (!done.ok) throw new Error(completed?.message || `Merchant rejected payment (${done.status})`);

    const pi = await stripe().paymentIntents.retrieve(completed.order.payment_intent_id, {
      expand: ["payment_method"],
    });
    const pmObj = pi.payment_method && typeof pi.payment_method === "object" ? pi.payment_method : null;
    const card = pmObj?.card ? `${pmObj.card.brand} •••• ${pmObj.card.last4}` : null;
    await settlePurchase(entryId, pi.id, card);
    return { already: false, checkout: completed as UcpCheckout, ledgerEntryId: entryId, spt, paymentIntentId: pi.id };
  } catch (e) {
    await releaseHold(entryId, e instanceof Error ? e.message : String(e));
    throw e;
  }
}
