import { randomUUID } from "node:crypto";
import { q } from "./db";
import { redact } from "./http";

export type LedgerEntry = {
  id: string;
  created_at: string;
  settled_at: string | null;
  kind: "topup" | "purchase";
  status: "pending" | "settled" | "failed" | "released";
  amount: number;
  currency: string;
  description: string | null;
  merchant_id: string | null;
  merchant_name: string | null;
  merchant_url: string | null;
  items: { title: string; quantity: number; unit_amount: number }[] | null;
  agent_request: string | null;
  stripe_checkout_session_id: string | null;
  payment_intent_id: string | null;
  spt_id: string | null;
  spt_mode: string | null;
  ucp_checkout_id: string | null;
  card: string | null;
  error: string | null;
};

// Money the agent can still spend: settled top-ups minus purchases that are settled or on hold.
const AVAILABLE_SQL = `
  select coalesce(sum(amount) filter (where kind = 'topup' and status = 'settled'), 0)
       + coalesce(sum(amount) filter (where kind = 'purchase' and status in ('pending','settled')), 0) as available
  from ledger_entries`;

export async function getSummary() {
  const [row] = await q<Record<string, string>>(`
    select
      coalesce(sum(amount) filter (where kind = 'topup' and status = 'settled'), 0) as topped_up,
      coalesce(-sum(amount) filter (where kind = 'purchase' and status = 'settled'), 0) as spent,
      coalesce(-sum(amount) filter (where kind = 'purchase' and status = 'pending'), 0) as held,
      count(*) filter (where kind = 'purchase' and status = 'settled') as purchases
    from ledger_entries`);
  const toppedUp = Number(row.topped_up);
  const spent = Number(row.spent);
  const held = Number(row.held);
  return { toppedUp, spent, held, available: toppedUp - spent - held, purchases: Number(row.purchases) };
}

export async function listEntries(limit = 200) {
  return q<LedgerEntry>(`select * from ledger_entries order by created_at desc limit $1`, [limit]);
}

export async function spendByMerchant() {
  return q<{ merchant_name: string; total: string; orders: string }>(`
    select merchant_name, -sum(amount) as total, count(*) as orders
    from ledger_entries where kind = 'purchase' and status = 'settled'
    group by merchant_name order by total desc`);
}

// ---- Top-ups ----------------------------------------------------------------

export async function recordPendingTopup(amount: number, checkoutSessionId: string) {
  await q(
    `insert into ledger_entries (id, kind, status, amount, description, stripe_checkout_session_id)
     values ($1, 'topup', 'pending', $2, 'Wallet top-up via Stripe Checkout', $3)
     on conflict (stripe_checkout_session_id) do nothing`,
    [randomUUID(), amount, checkoutSessionId],
  );
}

// Idempotent: safe to call from both the success redirect and the webhook.
export async function settleTopup(checkoutSessionId: string, paymentIntentId: string | null, card: string | null) {
  const rows = await q(
    `update ledger_entries set status = 'settled', settled_at = now(),
       payment_intent_id = coalesce($2, payment_intent_id), card = coalesce($3, card)
     where stripe_checkout_session_id = $1 and status = 'pending' returning id`,
    [checkoutSessionId, paymentIntentId, card],
  );
  return rows.length > 0;
}

// ---- Agent purchases --------------------------------------------------------

export type HoldInput = {
  amount: number; // positive cents
  currency: string;
  merchantId: string;
  merchantName: string;
  merchantUrl: string;
  items: { title: string; quantity: number; unit_amount: number }[];
  agentRequest: string;
  ucpCheckoutId: string;
};

// Places a hold on wallet funds. Atomic: the insert only happens if the balance covers it.
export async function placeHold(h: HoldInput): Promise<string | null> {
  const id = randomUUID();
  const rows = await q(
    `insert into ledger_entries (id, kind, status, amount, currency, description, merchant_id, merchant_name,
        merchant_url, items, agent_request, ucp_checkout_id)
     select $1, 'purchase', 'pending', $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10
     where (${AVAILABLE_SQL}) >= $11
     returning id`,
    [
      id,
      -h.amount,
      h.currency,
      h.items.map((i) => `${i.quantity}× ${i.title}`).join(", "),
      h.merchantId,
      h.merchantName,
      h.merchantUrl,
      JSON.stringify(h.items),
      h.agentRequest,
      h.ucpCheckoutId,
      h.amount,
    ],
  );
  return rows.length ? id : null;
}

// Logs a purchase the wallet refused (no balance, over the per-order limit), so the attempt is auditable.
export async function recordDeclined(h: HoldInput, reason: string) {
  await q(
    `insert into ledger_entries (id, kind, status, amount, currency, description, merchant_id, merchant_name,
        merchant_url, items, agent_request, ucp_checkout_id, error)
     values ($1, 'purchase', 'failed', $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
    [
      randomUUID(),
      -h.amount,
      h.currency,
      h.items.map((i) => `${i.quantity}× ${i.title}`).join(", "),
      h.merchantId,
      h.merchantName,
      h.merchantUrl,
      JSON.stringify(h.items),
      h.agentRequest,
      h.ucpCheckoutId,
      reason,
    ],
  );
}

export async function attachSpt(entryId: string, sptId: string, mode: string) {
  await q(`update ledger_entries set spt_id = $2, spt_mode = $3 where id = $1`, [entryId, sptId, mode]);
}

export async function settlePurchase(entryId: string, paymentIntentId: string, card: string | null) {
  await q(
    `update ledger_entries set status = 'settled', settled_at = now(), payment_intent_id = $2, card = $3 where id = $1`,
    [entryId, paymentIntentId, card],
  );
}

export async function releaseHold(entryId: string, error: string) {
  await q(`update ledger_entries set status = 'failed', error = $2 where id = $1 and status = 'pending'`, [
    entryId,
    redact(error).slice(0, 500),
  ]);
}

export async function availableBalance(): Promise<number> {
  const [row] = await q<{ available: string }>(AVAILABLE_SQL);
  return Number(row.available);
}
