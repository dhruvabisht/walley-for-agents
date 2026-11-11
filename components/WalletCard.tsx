"use client";

import { useEffect, useRef, useState } from "react";
import { usd } from "./format";
import { toneByName } from "./theme";

export type Summary = { toppedUp: number; spent: number; held: number; available: number; purchases: number };
export type MerchantSpend = { merchant: string; total: number; orders: number };

// Counts smoothly to a new value so balance changes are noticeable.
function useAnimatedNumber(target: number) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const begin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / 700);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(begin + (target - begin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export default function WalletCard({ summary, byMerchant }: { summary: Summary | null; byMerchant: MerchantSpend[] }) {
  const available = useAnimatedNumber(summary?.available ?? 0);
  const total = summary?.toppedUp ?? 0;

  const segments = [
    ...byMerchant.map((m) => ({ key: m.merchant, label: m.merchant, value: m.total, cls: toneByName(m.merchant).bar })),
    ...(summary?.held ? [{ key: "held", label: "On hold", value: summary.held, cls: "hold-stripes" }] : []),
    { key: "available", label: "Still available", value: summary?.available ?? 0, cls: "bg-white" },
  ].filter((s) => s.value > 0);

  return (
    <section className="wallet-card rounded-[28px] p-6 sm:p-8 text-white shadow-[0_24px_60px_-28px_rgba(76,52,200,0.65)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white/70 text-sm">Available for your agent</p>
          <p className="font-display tabular text-5xl sm:text-6xl font-semibold tracking-tight mt-1">
            {summary ? usd(available) : "—"}
          </p>
          <p className="text-white/70 text-sm mt-2">
            {summary
              ? summary.purchases
                ? `${usd(summary.spent)} spent over ${summary.purchases} purchase${summary.purchases === 1 ? "" : "s"}`
                : "Your agent hasn't spent anything yet"
              : "Loading your wallet"}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl bg-white/12 px-3 py-2 text-right backdrop-blur">
          <p className="text-[11px] text-white/60">Added in total</p>
          <p className="font-display tabular text-lg font-semibold">{summary ? usd(total) : "—"}</p>
        </div>
      </div>

      <div className="mt-7">
        <p className="text-white/70 text-sm mb-2">Where your money went</p>
        <div
          className="flex h-4 w-full overflow-hidden rounded-full bg-white/15 gap-[3px]"
          role="img"
          aria-label={segments.map((s) => `${s.label} ${usd(s.value)}`).join(", ") || "No money added yet"}
        >
          {total > 0 ? (
            segments.map((s) => (
              <div
                key={s.key}
                className={`ribbon-seg ${s.cls} first:rounded-l-full last:rounded-r-full`}
                style={{ flexGrow: s.value, flexBasis: 0, opacity: s.key === "available" ? 0.92 : 1 }}
              />
            ))
          ) : (
            <div className="w-full border-2 border-dashed border-white/30 rounded-full" />
          )}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${s.cls}`} />
              <span className="text-white/80">{s.label}</span>
              <span className="tabular font-medium">{usd(s.value)}</span>
            </li>
          ))}
          {summary && total === 0 && <li className="text-white/70">Add money to give your agent a budget.</li>}
        </ul>
      </div>
    </section>
  );
}
