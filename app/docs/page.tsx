import type { Metadata } from "next";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";

export const metadata: Metadata = {
  title: "Walley docs",
  description: "Let any AI agent shop with a Walley wallet: UCP checkouts, Stripe Shared Payment Tokens, and a ledger the owner can audit.",
};

const BASE = "https://walley-ten.vercel.app";

const AGENT_PROMPT = `You can shop for me with my Walley wallet. Read ${BASE}/llms.txt and follow it exactly. Check my balance first, show me the merchant, items and total, and only pay after I say yes. Use your name as agent_name.`;

const STEPS = [
  { title: "Check the balance", call: "GET /api/wallet", text: "summary.available is what the agent may spend, in cents." },
  { title: "Find products", call: "GET /api/catalog?q=coffee", text: "Each product has a merchant_id, an id and a price in cents." },
  { title: "Open a UCP checkout", call: "POST /api/ucp/{merchant_id}/checkout-sessions", text: "Nothing is charged. You get a checkout id and the total." },
  { title: "Ask the person", call: "", text: "Show the merchant, items and total. Pay only after a clear yes." },
  { title: "Pay with Walley", call: "POST /api/wallet/pay", text: "Walley holds the funds, issues an SPT capped at the total, and the merchant charges it." },
];

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/api/wallet", "Balance, ledger entries and spend per merchant"],
  ["GET", "/api/catalog?q=&merchant=", "Search products across merchants"],
  ["GET", "/.well-known/ucp", "UCP discovery: merchants and checkout endpoints"],
  ["POST", "/api/ucp/{merchant_id}/checkout-sessions", "Open a checkout with line_items"],
  ["GET", "/api/ucp/{merchant_id}/checkout-sessions/{id}", "Read a checkout"],
  ["POST", "/api/ucp/{merchant_id}/checkout-sessions/{id}/cancel", "Cancel a checkout"],
  ["POST", "/api/wallet/pay", "Pay for a checkout from the wallet"],
];

const PAY_REQUEST = `curl -X POST ${BASE}/api/wallet/pay \\
  -H 'Content-Type: application/json' \\
  -d '{
    "merchant_id": "night-owl-coffee",
    "checkout_id": "cs_ucp_0123456789abcdef0123",
    "agent_name": "Ava (Claude)",
    "reason": "User asked for cold brew for the office"
  }'`;

const PAY_OK = `200 OK
{
  "status": "completed",
  "total_cents": 1400,
  "order": { "id": "ord_…", "payment_intent_id": "pi_…" },
  "shared_payment_token": "spt_…",
  "payment_intent": "pi_…"
}`;

const PAY_DECLINED = `402 Payment Required
{
  "status": "declined",
  "message": "Insufficient wallet balance",
  "total_cents": 3000,
  "available_cents": 400,
  "shortfall_cents": 2600,
  "affordable_items": [],
  "suggested_topup_dollars": 26
}`;

const CURL_FLOW = `B=${BASE}
curl -s "$B/api/wallet" | jq .summary
curl -s "$B/api/catalog?q=cold%20brew" | jq '.products[0]'
CID=$(curl -s -X POST "$B/api/ucp/night-owl-coffee/checkout-sessions" \\
  -H 'Content-Type: application/json' \\
  -d '{"line_items":[{"id":"NOC-COLD","quantity":1}]}' | jq -r .id)
curl -s -X POST "$B/api/wallet/pay" -H 'Content-Type: application/json' \\
  -d "{\\"merchant_id\\":\\"night-owl-coffee\\",\\"checkout_id\\":\\"$CID\\",\\"agent_name\\":\\"curl demo\\",\\"reason\\":\\"testing Walley\\"}"`;

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl bg-ink p-4 text-[13px] leading-relaxed text-panel">
      <code className="font-mono">{children}</code>
    </pre>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-3xl border border-line bg-panel p-5 sm:p-7">
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

export default function Docs() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 lg:pt-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet font-display text-xl font-bold text-white">W</span>
          <span className="font-display text-2xl font-semibold tracking-tight">Walley</span>
        </Link>
        <Link href="/" className="rounded-full bg-violet/10 px-4 py-2 text-sm font-semibold text-violet">
          Open the wallet
        </Link>
      </header>

      <div className="wallet-card rounded-[28px] p-6 text-white sm:p-9">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">Let any agent shop with your wallet</h1>
        <p className="mt-3 max-w-2xl text-white/80">
          Your agent finds products, opens a checkout over the Universal Commerce Protocol, and asks Walley to pay. Walley
          issues a Stripe Shared Payment Token for that one order, and you see every purchase in your ledger.
        </p>
        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <a href="/llms.txt" className="rounded-full bg-white px-4 py-2 font-semibold text-ink">Agent guide (llms.txt)</a>
          <a href="#endpoints" className="rounded-full bg-white/15 px-4 py-2 font-semibold">Endpoints</a>
          <a href="https://github.com/dhruvabisht/walley-for-agents" className="rounded-full bg-white/15 px-4 py-2 font-semibold">Source on GitHub</a>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <Section id="connect" title="Connect your agent in one message">
          <p>Paste this into Claude, ChatGPT or any agent that can make HTTP requests:</p>
          <div className="flex flex-col gap-3 rounded-2xl bg-violet/10 p-4 sm:flex-row sm:items-start">
            <p className="flex-1 text-[15px]">{AGENT_PROMPT}</p>
            <CopyButton text={AGENT_PROMPT} label="Copy prompt" />
          </div>
          <p className="text-muted">
            This demo runs in Stripe test mode, so no real money moves. Add test money on the{" "}
            <Link href="/" className="text-violet underline underline-offset-2">dashboard</Link> with card 4242 4242 4242 4242.
          </p>
        </Section>

        <Section id="flow" title="How a purchase works">
          <ol className="space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet font-display font-semibold text-white">{i + 1}</span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  {s.call && <p className="font-mono text-[13px] text-violet">{s.call}</p>}
                  <p className="text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p>
            The purchase then shows up in <span className="font-mono text-[13px]">GET /api/wallet</span> and on the dashboard,
            with the agent&apos;s name, its reason, the SPT and a link to the Stripe payment.
          </p>
        </Section>

        <Section id="endpoints" title="Endpoints">
          <p className="text-muted">
            Base URL <span className="font-mono text-[13px] text-ink">{BASE}</span>. All amounts are integers in US cents.
          </p>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {ENDPOINTS.map(([method, path, what]) => (
              <li key={method + path} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                <span className={`w-14 shrink-0 font-mono text-xs font-semibold ${method === "GET" ? "text-leaf" : "text-violet"}`}>{method}</span>
                <span className="break-all font-mono text-[13px]">{path}</span>
                <span className="text-sm text-muted sm:ml-auto sm:text-right">{what}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="pay" title="Paying with the wallet">
          <Code>{PAY_REQUEST}</Code>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 font-semibold text-leaf">Paid</p>
              <Code>{PAY_OK}</Code>
            </div>
            <div>
              <p className="mb-2 font-semibold text-rose">Declined: nothing was charged</p>
              <Code>{PAY_DECLINED}</Code>
            </div>
          </div>
          <p>
            On a decline, don&apos;t retry. Tell the person why, offer the <span className="font-mono text-[13px]">affordable_items</span>,
            or ask them to add money.
          </p>
        </Section>

        <Section id="guardrails" title="What protects the person">
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              ["Balance hold", "Funds are held before any token exists, so an agent can't overspend."],
              ["One token per order", "Each SPT is capped at the exact total and expires in 15 minutes."],
              ["Per-order limit", "No single agent order can go over $500."],
              ["Everything is logged", "Declined attempts show as Blocked, with the agent's name and reason."],
            ].map(([t, d]) => (
              <li key={t} className="rounded-2xl bg-paper p-4">
                <p className="font-semibold">{t}</p>
                <p className="text-sm text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="try" title="Try the whole flow with curl">
          <Code>{CURL_FLOW}</Code>
        </Section>
      </div>
    </div>
  );
}
