"use client";

import { Fragment, useState } from "react";
import type { LedgerEntry } from "@/lib/ledger";
import { dateTime, stripePaymentUrl, usd } from "./format";

type Filter = "all" | "purchase" | "topup";

const STATUS_STYLE: Record<string, string> = {
  settled: "bg-credit/10 text-credit",
  pending: "bg-warn/10 text-warn",
  failed: "bg-danger/10 text-danger",
  released: "bg-line text-muted",
};

function Trace({ label, value, href }: { label: string; value: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-muted w-36 shrink-0">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline truncate">
          {value} ↗
        </a>
      ) : (
        <span className="font-mono truncate">{value}</span>
      )}
    </div>
  );
}

export default function LedgerTable({ entries }: { entries: LedgerEntry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const rows = entries.filter((e) => filter === "all" || e.kind === filter);

  return (
    <section className="rounded-2xl border border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line">
        <div>
          <h2 className="font-semibold">Ledger</h2>
          <p className="text-sm text-muted">Every top-up and every purchase your agent made, with its Stripe trace.</p>
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-sm">
          {(["all", "purchase", "topup"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md ${filter === f ? "bg-ink text-panel" : "text-muted hover:text-ink"}`}
            >
              {f === "all" ? "All" : f === "purchase" ? "Agent purchases" : "Top-ups"}
            </button>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="px-5 py-12 text-center text-muted text-sm">
          Nothing here yet. Top up the wallet, then ask the agent to buy something.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="font-medium px-5 py-2.5">When</th>
                <th className="font-medium px-3 py-2.5">What</th>
                <th className="font-medium px-3 py-2.5">Where</th>
                <th className="font-medium px-3 py-2.5 text-right">Amount</th>
                <th className="font-medium px-5 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const { date, time } = dateTime(e.created_at);
                const isOpen = open === e.id;
                const credit = e.amount > 0;
                return (
                  <Fragment key={e.id}>
                    <tr
                      onClick={() => setOpen(isOpen ? null : e.id)}
                      className="border-b border-line last:border-0 cursor-pointer hover:bg-bg/60"
                    >
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div>{date}</div>
                        <div className="text-muted font-mono text-xs">{time}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
                              credit ? "bg-credit/10 text-credit" : "bg-accent-soft text-accent"
                            }`}
                          >
                            {credit ? "Top-up" : "Agent"}
                          </span>
                          <span className="truncate max-w-[22ch] sm:max-w-[34ch]">{e.description}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{e.merchant_name || (credit ? "Stripe Checkout" : "—")}</td>
                      <td className={`px-3 py-3 text-right tabular font-medium whitespace-nowrap ${credit ? "text-credit" : ""}`}>
                        {credit ? "+" : "−"}
                        {usd(Math.abs(e.amount))}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-line bg-bg/50">
                        <td colSpan={5} className="px-5 py-4">
                          <div className="grid gap-1.5 text-xs">
                            {e.agent_request && (
                              <div className="flex items-baseline gap-2">
                                <span className="text-muted w-36 shrink-0">You asked</span>
                                <span className="italic">“{e.agent_request}”</span>
                              </div>
                            )}
                            {e.items?.map((i, idx) => (
                              <div key={idx} className="flex items-baseline gap-2">
                                <span className="text-muted w-36 shrink-0">{idx === 0 ? "Items" : ""}</span>
                                <span>
                                  {i.quantity} × {i.title} @ {usd(i.unit_amount)}
                                </span>
                              </div>
                            ))}
                            <Trace label="Shared Payment Token" value={e.spt_id} />
                            <Trace label="SPT path" value={e.spt_mode} />
                            <Trace label="UCP checkout" value={e.ucp_checkout_id} />
                            <Trace
                              label="PaymentIntent"
                              value={e.payment_intent_id}
                              href={e.payment_intent_id ? stripePaymentUrl(e.payment_intent_id) : undefined}
                            />
                            <Trace label="Checkout Session" value={e.stripe_checkout_session_id} />
                            <Trace label="Card" value={e.card} />
                            <Trace label="Merchant site" value={e.merchant_url} />
                            {e.settled_at && <Trace label="Settled" value={new Date(e.settled_at).toLocaleString("en-GB")} />}
                            {e.error && (
                              <div className="flex items-baseline gap-2 text-danger">
                                <span className="w-36 shrink-0">Error</span>
                                <span>{e.error}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
