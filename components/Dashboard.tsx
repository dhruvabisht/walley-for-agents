"use client";

import { useCallback, useEffect, useState } from "react";
import type { LedgerEntry } from "@/lib/ledger";
import LedgerTable from "./LedgerTable";
import AgentChat from "./AgentChat";
import { usd } from "./format";

type WalletData = {
  summary: { toppedUp: number; spent: number; held: number; available: number; purchases: number };
  entries: LedgerEntry[];
  byMerchant: { merchant: string; total: number; orders: number }[];
};

const PRESETS = [25, 50, 100];

function Stat({ label, value, hint, big }: { label: string; value: string; hint?: string; big?: boolean }) {
  return (
    <div className={`rounded-2xl border border-line bg-panel px-5 py-4 ${big ? "sm:col-span-2" : ""}`}>
      <div className="text-sm text-muted">{label}</div>
      <div className={`tabular font-semibold tracking-tight ${big ? "text-4xl mt-1" : "text-2xl mt-0.5"}`}>{value}</div>
      {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(50);
  const [toppingUp, setToppingUp] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    // Poll the ledger so agent purchases appear live.
    const first = setTimeout(() => {
      load();
      const p = new URLSearchParams(window.location.search).get("topup");
      if (p === "success") setNotice("Top-up received. Your agent can spend it now.");
      if (p === "cancelled") setNotice("Top-up cancelled.");
      if (p) window.history.replaceState({}, "", "/");
    }, 0);
    const t = setInterval(load, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  async function topUp() {
    setToppingUp(true);
    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      window.location.href = json.url;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
      setToppingUp(false);
    }
  }

  const s = data?.summary;
  const maxMerchant = Math.max(1, ...(data?.byMerchant.map((m) => m.total) || [1]));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent text-white grid place-items-center font-bold">W</div>
            <h1 className="text-2xl font-semibold tracking-tight">Walley</h1>
          </div>
          <p className="text-muted text-sm mt-1">A prepaid wallet your AI agent can spend, and you can audit.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded-full border border-line text-warn">Stripe sandbox</span>
          <span className="px-2 py-1 rounded-full border border-line text-muted">UCP 2026-04-08</span>
          <span className="px-2 py-1 rounded-full border border-line text-muted">Shared Payment Tokens</span>
        </div>
      </header>

      {notice && (
        <div className="mb-4 rounded-xl border border-line bg-panel px-4 py-3 text-sm flex justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-muted">✕</button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <main className="space-y-6 min-w-0">
          <div className="grid gap-4 sm:grid-cols-4">
            <Stat big label="Available to the agent" value={s ? usd(s.available) : "—"} hint="Top-ups minus purchases and holds" />
            <Stat label="Spent by agent" value={s ? usd(s.spent) : "—"} hint={s ? `${s.purchases} purchases` : undefined} />
            <Stat label="On hold" value={s ? usd(s.held) : "—"} hint="Orders in flight" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-line bg-panel px-5 py-4">
              <h2 className="font-semibold">Add money</h2>
              <p className="text-sm text-muted mb-3">Pay with Stripe Checkout. Test card 4242 4242 4242 4242.</p>
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setAmount(p)}
                    className={`px-3 py-1.5 rounded-lg border text-sm tabular ${
                      amount === p ? "border-accent text-accent bg-accent-soft" : "border-line"
                    }`}
                  >
                    ${p}
                  </button>
                ))}
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-24 rounded-lg border border-line bg-bg px-2 py-1.5 text-sm tabular"
                  aria-label="Custom amount in dollars"
                />
                <button
                  onClick={topUp}
                  disabled={toppingUp}
                  className="ml-auto rounded-lg bg-ink text-panel px-4 py-1.5 text-sm font-medium disabled:opacity-50"
                >
                  {toppingUp ? "Opening Stripe…" : `Top up $${amount || 0}`}
                </button>
              </div>
              <p className="text-xs text-muted mt-3">Total topped up: {s ? usd(s.toppedUp) : "—"}</p>
            </section>

            <section className="rounded-2xl border border-line bg-panel px-5 py-4">
              <h2 className="font-semibold mb-3">Agent spend by merchant</h2>
              {data?.byMerchant.length ? (
                <ul className="space-y-2.5">
                  {data.byMerchant.map((m) => (
                    <li key={m.merchant} className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span>{m.merchant}</span>
                        <span className="tabular text-muted">
                          {usd(m.total)} · {m.orders} order{m.orders === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${(m.total / maxMerchant) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No agent purchases yet.</p>
              )}
            </section>
          </div>

          <LedgerTable entries={data?.entries || []} />
        </main>

        <aside className="min-w-0">
          <AgentChat onActivity={load} />
        </aside>
      </div>
    </div>
  );
}
