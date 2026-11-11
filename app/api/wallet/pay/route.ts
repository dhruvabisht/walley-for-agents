import { getMerchant } from "@/lib/merchants";
import { payForCheckout, WalletDeclined } from "@/lib/wallet";
import { errorResponse, redact } from "@/lib/http";
import { requireAccount } from "@/lib/auth";
import { refillDemo } from "@/lib/demo";

// Agent API: pay for a UCP checkout with the caller's Walley wallet.
// POST /api/wallet/pay { merchant_id, checkout_id, agent_name?, reason? }
// Auth: Authorization: Bearer wk_test_... (or a signed-in session).
// Guardrails: balance hold, per-order limit, SPT capped at the exact total.
export async function POST(req: Request) {
  try {
    const account = await requireAccount(req);
    if (account.is_demo) await refillDemo(account.id); // the public demo wallet never runs dry
    const body = (await req.json().catch(() => ({}))) as {
      merchant_id?: string;
      checkout_id?: string;
      agent_name?: string;
      reason?: string;
    };
    if (!body.merchant_id || !getMerchant(body.merchant_id))
      return Response.json({ code: "invalid_merchant", message: "merchant_id must be one of the merchants in GET /api/catalog" }, { status: 400 });
    if (!body.checkout_id || !/^cs_ucp_[a-f0-9]{20}$/.test(body.checkout_id))
      return Response.json({ code: "invalid_checkout", message: "checkout_id must be the id returned by POST /api/ucp/{merchant}/checkout-sessions" }, { status: 400 });

    const agent = (body.agent_name || "External agent").slice(0, 60);
    const reason = (body.reason || "no reason given").slice(0, 300);
    const origin = new URL(req.url).origin;
    try {
      const r = await payForCheckout({
        accountId: account.id,
        ucpBaseUrl: `${origin}/api/ucp/${body.merchant_id}`,
        checkoutId: body.checkout_id,
        agentRequest: `[${agent}] ${reason}`,
      });
      const total = r.checkout.totals.find((t) => t.type === "total")?.amount ?? 0;
      return Response.json({
        status: r.already ? "already_completed" : "completed",
        merchant: r.checkout.merchant,
        total_cents: total,
        order: r.checkout.order,
        shared_payment_token: r.spt?.id ?? null,
        spt_mode: r.spt?.mode ?? null,
        payment_intent: r.paymentIntentId ?? r.checkout.order?.payment_intent_id ?? null,
        ledger_entry_id: r.ledgerEntryId ?? null,
        view_in_walley: origin,
      });
    } catch (e) {
      if (e instanceof WalletDeclined)
        return Response.json({ status: "declined", message: e.message, ...e.details }, { status: 402 });
      return Response.json({ status: "failed", message: redact(e instanceof Error ? e.message : String(e)) }, { status: 502 });
    }
  } catch (e) {
    return errorResponse(e);
  }
}
