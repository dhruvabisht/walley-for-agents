"use client";

import { usd } from "./format";
import { TONES, toneByName } from "./theme";
import type { MerchantSpend as Row } from "./WalletCard";

// Every merchant the agent can buy from, with what it has spent there so far.
export default function MerchantSpend({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <section className="rounded-3xl bg-panel border border-line p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Spend by shop</h2>
      <ul className="mt-4 space-y-4">
        {Object.values(TONES).map((tone) => {
          const row = rows.find((r) => toneByName(r.merchant).name === tone.name);
          return (
            <li key={tone.name} className="flex items-center gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl ${tone.tile}`} aria-hidden>
                {tone.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{tone.name}</span>
                  <span className="tabular font-display font-semibold">{usd(row?.total ?? 0)}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-line overflow-hidden">
                  <div
                    className={`ribbon-seg h-full rounded-full ${tone.bar}`}
                    style={{ width: `${((row?.total ?? 0) / max) * 100}%`, transition: "width 0.9s cubic-bezier(0.22,1,0.36,1)" }}
                  />
                </div>
                <p className="text-xs text-muted mt-1">
                  {row ? `${row.orders} order${row.orders === 1 ? "" : "s"}` : "No orders yet"}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
