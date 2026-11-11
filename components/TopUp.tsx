"use client";

import { useState } from "react";

const PRESETS = [25, 50, 100];

export default function TopUp({ onError }: { onError: (msg: string) => void }) {
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);

  async function addMoney() {
    setBusy(true);
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
      onError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl bg-panel border border-line p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Add money</h2>
      <p className="text-sm text-muted mt-1">
        Paid through Stripe Checkout. In the sandbox, use card 4242 4242 4242 4242 with any future date and CVC.
      </p>
      <div className="mt-4 grid grid-cols-[1fr_1fr_1fr_1.25fr] gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setAmount(p)}
            aria-pressed={amount === p}
            className={`rounded-2xl py-3 font-display text-lg font-semibold tabular transition-colors ${
              amount === p ? "bg-violet text-white" : "bg-violet/10 text-violet hover:bg-violet/20"
            }`}
          >
            ${p}
          </button>
        ))}
        <label className="relative">
          <span className="sr-only">Other amount in dollars</span>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
          <input
            type="number"
            inputMode="decimal"
            min={5}
            max={500}
            value={PRESETS.includes(amount) ? "" : amount || ""}
            placeholder="Other"
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full h-full min-w-0 rounded-2xl border border-line bg-paper pl-6 pr-1 text-base tabular outline-none placeholder:text-sm focus:border-violet"
          />
        </label>
      </div>
      <button
        onClick={addMoney}
        disabled={busy || !amount || amount < 5 || amount > 500}
        className="mt-4 w-full rounded-2xl bg-ink text-panel py-3.5 font-semibold text-base disabled:opacity-40 active:scale-[0.99] transition-transform"
      >
        {busy ? "Opening Stripe Checkout…" : `Add $${amount || 0} to the wallet`}
      </button>
    </section>
  );
}
