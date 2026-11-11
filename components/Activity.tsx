"use client";

import { useState } from "react";
import type { LedgerEntry } from "@/lib/ledger";
import { dayLabel, fullDateTime, stripePaymentUrl, timeOf, usd } from "./format";
import { TOPUP_TONE, toneFor } from "./theme";

type Filter = "all" | "purchase" | "topup";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "purchase", label: "Purchases" },
  { id: "topup", label: "Money added" },
];

function statusChip(e: LedgerEntry) {
  if (e.status === "failed")
    return { label: e.spt_id ? "Failed" : "Blocked", cls: "bg-rose/15 text-rose" };
  if (e.status === "pending") return e.kind === "topup"
    ? { label: "Waiting for payment", cls: "bg-amber/15 text-amber" }
    : { label: "On hold", cls: "bg-rose/15 text-rose" };
  return e.kind === "topup" ? { label: "Added", cls: "bg-violet/12 text-violet" } : { label: "Paid", cls: "bg-leaf/15 text-leaf" };
}

const SPT_PATH: Record<string, string> = {
  issued: "Issued by the wallet to the seller",
  sandbox_granted: "Sandbox test helper (simulates the seller receiving it)",
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[13px] break-all">{children}</span>;
}

export default function Activity({ entries, freshIds }: { entries: LedgerEntry[]; freshIds: Set<string> }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const rows = entries.filter((e) => filter === "all" || e.kind === filter);

  const groups: { day: string; items: LedgerEntry[] }[] = [];
  for (const e of rows) {
    const day = dayLabel(e.created_at);
    const g = groups.at(-1);
    if (g && g.day === day) g.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <section className="rounded-3xl bg-panel border border-line">
      <div className="p-5 sm:p-6 pb-3 sm:pb-3">
        <h2 className="font-display text-xl font-semibold">Activity</h2>
        <p className="text-sm text-muted mt-1">What your agent bought, where, for how much and when. Tap a row for the full Stripe trail.</p>
        <div className="mt-4 flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Filter activity">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.id ? "bg-ink text-panel" : "bg-paper text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="px-6 pb-10 pt-6 text-center">
          <p className="text-4xl" aria-hidden>🧾</p>
          <p className="font-medium mt-2">No activity yet</p>
          <p className="text-sm text-muted mt-1">Add money, then ask the agent to buy something. Every step lands here.</p>
        </div>
      ) : (
        <div className="pb-3">
          {groups.map((g) => (
            <div key={g.day}>
              <h3 className="px-5 sm:px-6 pt-4 pb-1 text-sm font-semibold text-muted">{g.day}</h3>
              <ul>
                {g.items.map((e) => {
                  const tone = e.kind === "topup" ? TOPUP_TONE : toneFor(e.merchant_id);
                  const chip = statusChip(e);
                  const isOpen = open === e.id;
                  const credit = e.amount > 0;
                  return (
                    <li key={e.id} className={freshIds.has(e.id) ? "fresh" : ""}>
                      <button
                        onClick={() => setOpen(isOpen ? null : e.id)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center gap-3 px-5 sm:px-6 py-3 text-left hover:bg-paper/70 transition-colors"
                      >
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl ${tone.tile} ${tone.text} font-bold`} aria-hidden>
                          {tone.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {credit ? "Money added" : e.description}
                          </span>
                          <span className="flex items-center gap-2 text-sm text-muted">
                            <span className="truncate">{credit ? "Stripe Checkout" : e.merchant_name}</span>
                            <span className="tabular shrink-0">{timeOf(e.created_at)}</span>
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span
                            className={`block tabular font-display font-semibold ${credit ? "text-violet" : ""} ${
                              e.status === "failed" ? "text-muted line-through" : ""
                            }`}
                          >
                            {credit ? "+" : "−"}
                            {usd(Math.abs(e.amount))}
                          </span>
                          <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${chip.cls}`}>{chip.label}</span>
                        </span>
                      </button>

                      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                        <div className="overflow-hidden">
                          <dl className={`mx-5 sm:mx-6 mb-3 rounded-2xl bg-paper px-4 py-3 ring-1 ${tone.ring}`}>
                            <Detail label="When">{fullDateTime(e.created_at)}</Detail>
                            {e.agent_request && <Detail label="You asked">“{e.agent_request}”</Detail>}
                            {e.items?.length ? (
                              <Detail label="Items">
                                <ul>
                                  {e.items.map((i, idx) => (
                                    <li key={idx}>
                                      {i.quantity} × {i.title} <span className="text-muted">at {usd(i.unit_amount)}</span>
                                    </li>
                                  ))}
                                </ul>
                              </Detail>
                            ) : null}
                            {e.merchant_url && <Detail label="Shop">{e.merchant_name} <span className="text-muted">({e.merchant_url.replace("https://", "")})</span></Detail>}
                            {e.spt_id && <Detail label="Shared Payment Token"><Mono>{e.spt_id}</Mono></Detail>}
                            {e.spt_mode && <Detail label="Token source">{SPT_PATH[e.spt_mode] || e.spt_mode}</Detail>}
                            {e.ucp_checkout_id && <Detail label="UCP checkout"><Mono>{e.ucp_checkout_id}</Mono></Detail>}
                            {e.payment_intent_id && (
                              <Detail label="Stripe payment">
                                <a href={stripePaymentUrl(e.payment_intent_id)} target="_blank" rel="noreferrer" className="text-violet underline underline-offset-2">
                                  <Mono>{e.payment_intent_id}</Mono>
                                </a>
                              </Detail>
                            )}
                            {e.stripe_checkout_session_id && <Detail label="Checkout session"><Mono>{e.stripe_checkout_session_id}</Mono></Detail>}
                            {e.card && <Detail label="Card">{e.card}</Detail>}
                            {e.settled_at && <Detail label="Settled">{fullDateTime(e.settled_at)}</Detail>}
                            {e.error && <Detail label="What went wrong"><span className="text-rose">{e.error}</span></Detail>}
                          </dl>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
