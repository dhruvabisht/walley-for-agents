// Seller side of the Universal Commerce Protocol (UCP) checkout flow.
// Spec shape: https://ucp.dev/2026-04-08/specification/checkout-rest/
import { randomUUID } from "node:crypto";
import { q } from "./db";
import { getMerchant, type Merchant } from "./merchants";
import { stripePreview, StripeApiError } from "./stripe";
import { config } from "./config";

type Row = {
  id: string;
  merchant_id: string;
  status: string;
  currency: string;
  line_items: { id: string; item: { id: string; title: string; price: number }; quantity: number; total: number }[];
  total: string;
  payment_intent_id: string | null;
  order_id: string | null;
  spt_id: string | null;
};

export class UcpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function present(row: Row, merchant: Merchant) {
  const total = Number(row.total);
  return {
    ucp: { version: "2026-04-08" },
    id: row.id,
    status: row.status, // ready_for_complete | completed | canceled
    currency: row.currency,
    merchant: { id: merchant.id, name: merchant.name, url: merchant.url },
    line_items: row.line_items,
    totals: [
      { type: "subtotal", amount: total },
      { type: "total", amount: total },
    ],
    payment: {
      handlers: [{ id: "stripe_spt", name: "com.stripe.shared_payment_token", config: { currency: row.currency } }],
    },
    order: row.order_id ? { id: row.order_id, payment_intent_id: row.payment_intent_id } : null,
  };
}

function requireMerchant(merchantId: string) {
  const m = getMerchant(merchantId);
  if (!m) throw new UcpError(404, "merchant_not_found", `Unknown merchant ${merchantId}`);
  return m;
}

async function load(merchantId: string, id: string) {
  const m = requireMerchant(merchantId);
  const [row] = await q<Row>(`select * from merchant_checkouts where id = $1 and merchant_id = $2`, [id, merchantId]);
  if (!row) throw new UcpError(404, "checkout_not_found", `Checkout ${id} not found`);
  return { m, row };
}

export async function createCheckout(merchantId: string, body: { line_items?: { id: string; quantity?: number }[] }) {
  const m = requireMerchant(merchantId);
  const wanted = body.line_items || [];
  if (!wanted.length) throw new UcpError(400, "invalid_request", "line_items is required");
  const lineItems = wanted.map((li) => {
    const p = m.products.find((x) => x.id === li.id);
    if (!p) throw new UcpError(400, "item_not_found", `${m.name} does not sell ${li.id}`);
    const quantity = Math.max(1, Math.min(10, Math.floor(li.quantity || 1)));
    return { id: randomUUID(), item: { id: p.id, title: p.title, price: p.price }, quantity, total: p.price * quantity };
  });
  const total = lineItems.reduce((s, li) => s + li.total, 0);
  const id = `cs_ucp_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const [row] = await q<Row>(
    `insert into merchant_checkouts (id, merchant_id, status, currency, line_items, total)
     values ($1, $2, 'ready_for_complete', $3, $4::jsonb, $5) returning *`,
    [id, m.id, config.currency, JSON.stringify(lineItems), total],
  );
  return present(row, m);
}

export async function getCheckout(merchantId: string, id: string) {
  const { m, row } = await load(merchantId, id);
  return present(row, m);
}

export async function cancelCheckout(merchantId: string, id: string) {
  const { m, row } = await load(merchantId, id);
  if (row.status === "completed") throw new UcpError(409, "already_completed", "Checkout is already completed");
  const [updated] = await q<Row>(
    `update merchant_checkouts set status = 'canceled', updated_at = now() where id = $1 returning *`,
    [row.id],
  );
  return present(updated, m);
}

// Charge the SPT the buyer's agent sent us. Stripe clones the agent's payment method onto
// our account and the card is charged; we never see card details.
async function chargeSpt(token: string, amount: number, currency: string, checkoutId: string) {
  return stripePreview<{ id: string; status: string; payment_method: string }>("POST", "/v1/payment_intents", {
    amount,
    currency,
    confirm: "true",
    payment_method_data: { shared_payment_granted_token: token },
    metadata: { ucp_checkout_id: checkoutId, source: "walley-agent" },
  });
}

export async function completeCheckout(
  merchantId: string,
  id: string,
  body: { payment_data?: { token?: string; provider?: string }; sandbox_grant?: { expires_at: number } },
) {
  const { m, row } = await load(merchantId, id);
  if (row.status === "completed") return present(row, m); // idempotent
  if (row.status !== "ready_for_complete") throw new UcpError(409, "invalid_state", `Checkout is ${row.status}`);
  const token = body.payment_data?.token;
  if (!token || !token.startsWith("spt_")) throw new UcpError(400, "payment_required", "payment_data.token (spt_…) is required");

  const total = Number(row.total);
  let pi;
  try {
    pi = await chargeSpt(token, total, row.currency, row.id);
  } catch (e) {
    const msg = e instanceof StripeApiError ? e.message : String(e);
    throw new UcpError(402, "payment_failed", msg.replace(/[a-z][a-z0-9+.-]*:\/\/[^\s@]+@\S+/gi, "[redacted]"));
  }
  if (pi.status !== "succeeded") throw new UcpError(402, "payment_failed", `PaymentIntent ${pi.id} is ${pi.status}`);

  const orderId = `ord_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const [updated] = await q<Row>(
    `update merchant_checkouts set status = 'completed', payment_intent_id = $2, order_id = $3, spt_id = $4, updated_at = now()
     where id = $1 returning *`,
    [row.id, pi.id, orderId, token],
  );
  return present(updated, m);
}
