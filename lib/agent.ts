// The shopping agent. It talks to merchants over UCP and pays through the wallet, never with a card.
import { config } from "./config";
import { MERCHANTS, searchProducts } from "./merchants";
import { availableBalance } from "./ledger";
import { payForCheckout, WalletDeclined } from "./wallet";

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type AgentStep = {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
};

const SYSTEM = `You are Walley, a shopping agent that buys things for the user with their prepaid Walley wallet.
Rules:
- Only buy what the user explicitly asked for. Never add extra items.
- Flow: search_products -> create_checkout -> tell the user the merchant, items and exact total -> wait for the user to confirm -> complete_checkout.
- If the user's message already says to go ahead and buy a specific item (e.g. "buy the merino beanie"), you may create the checkout and complete it in the same turn.
- If complete_checkout is refused, explain why in one sentence (the wallet refused: the total, the balance, and how much is missing, or the per-order limit). Then offer exactly two choices: buy only the items from that order that fit the balance (name them with prices, from affordable_items), or add money to the wallet (at least the shortfall, using "Add money"). Wait for the user's choice; do not retry on your own. If affordable_items is empty, only offer adding money.
- Prices are in US dollars. Tool results give amounts in cents; show dollars to the user.
- After a purchase, report: merchant, items, total, order id, and the Shared Payment Token id used.
- Be brief.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search the catalogs of merchants that accept agent payments over UCP.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to look for, e.g. 'coffee beans'. Empty lists everything." },
          merchant_id: { type: "string", enum: MERCHANTS.map((m) => m.id) },
        },
      },
    },
  },
  {
    type: "function",
    function: { name: "get_wallet_balance", description: "Available Walley wallet balance in cents.", parameters: { type: "object", properties: {} } },
  },
  {
    type: "function",
    function: {
      name: "create_checkout",
      description: "Create a UCP checkout session with one merchant. Returns the checkout id and total. Does not charge anything.",
      parameters: {
        type: "object",
        required: ["merchant_id", "items"],
        properties: {
          merchant_id: { type: "string", enum: MERCHANTS.map((m) => m.id) },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["product_id"],
              properties: { product_id: { type: "string" }, quantity: { type: "integer", minimum: 1, maximum: 10 } },
            },
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_checkout",
      description:
        "Pay for a UCP checkout with the Walley wallet. The wallet holds the funds, issues a seller-scoped Shared Payment Token capped at the total, and the merchant charges it. Only call after the user confirmed.",
      parameters: {
        type: "object",
        required: ["merchant_id", "checkout_id"],
        properties: { merchant_id: { type: "string", enum: MERCHANTS.map((m) => m.id) }, checkout_id: { type: "string" } },
      },
    },
  },
];

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

async function runTool(name: string, args: Record<string, unknown>, origin: string, agentRequest: string) {
  const ucp = (merchantId: string) => `${origin}/api/ucp/${merchantId}`;
  switch (name) {
    case "search_products": {
      const results = searchProducts(args.query as string | undefined, args.merchant_id as string | undefined);
      return { result: results, summary: `Found ${results.length} product${results.length === 1 ? "" : "s"}` };
    }
    case "get_wallet_balance": {
      const available = await availableBalance();
      return { result: { available_cents: available }, summary: `Balance ${usd(available)}` };
    }
    case "create_checkout": {
      const items = (args.items as { product_id: string; quantity?: number }[]) || [];
      const res = await fetch(`${ucp(String(args.merchant_id))}/checkout-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_items: items.map((i) => ({ id: i.product_id, quantity: i.quantity || 1 })) }),
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message || `create_checkout failed (${res.status})`);
      const total = body.totals.find((t: { type: string }) => t.type === "total").amount;
      return {
        result: { checkout_id: body.id, merchant: body.merchant.name, total_cents: total, status: body.status, line_items: body.line_items },
        summary: `UCP checkout ${body.id} at ${body.merchant.name}: ${usd(total)}`,
      };
    }
    case "complete_checkout": {
      const r = await payForCheckout({
        ucpBaseUrl: ucp(String(args.merchant_id)),
        checkoutId: String(args.checkout_id),
        agentRequest,
      });
      if (r.already) return { result: { status: "already_completed", order: r.checkout.order }, summary: "Already paid" };
      const total = r.checkout.totals.find((t) => t.type === "total")?.amount ?? 0;
      return {
        result: {
          status: "completed",
          order_id: r.checkout.order?.id,
          total_cents: total,
          shared_payment_token: r.spt?.id,
          spt_mode: r.spt?.mode,
          payment_intent: r.paymentIntentId,
        },
        summary: `Paid ${usd(total)} with ${r.spt?.id} → ${r.paymentIntentId}`,
      };
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

export async function runAgent(history: ChatMessage[], origin: string) {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...history.filter((m) => m.role !== "system")];
  const steps: AgentStep[] = [];
  const userTexts = history.filter((m) => m.role === "user").map((m) => (m as { content: string }).content);
  const agentRequest = userTexts.slice(-3).join(" → ").slice(0, 500);

  for (let i = 0; i < 8; i++) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouterKey()}`,
        "Content-Type": "application/json",
        "X-Title": "Walley for Agents",
      },
      body: JSON.stringify({ model: config.openRouterModel(), messages, tools: TOOLS, tool_choice: "auto", max_tokens: 1200 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `OpenRouter error ${res.status}`);
    const msg = data.choices?.[0]?.message;
    const assistant: ChatMessage = { role: "assistant", content: msg?.content ?? null, tool_calls: msg?.tool_calls };
    messages.push(assistant);
    if (!msg?.tool_calls?.length) break;

    for (const call of msg.tool_calls as ToolCall[]) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {}
      try {
        const { result, summary } = await runTool(call.function.name, args, origin, agentRequest);
        const keep = call.function.name === "complete_checkout" || call.function.name === "create_checkout";
        steps.push({ tool: call.function.name, args, ok: true, summary, data: keep ? (result as Record<string, unknown>) : undefined });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        const details = e instanceof WalletDeclined ? { declined: true, ...e.details } : undefined;
        steps.push({ tool: call.function.name, args, ok: false, summary: err, data: details });
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: err, ...details }) });
      }
    }
  }
  return { messages: messages.slice(1), steps };
}
