"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LedgerEntry } from "@/lib/ledger";
import WalletCard, { type MerchantSpend as MerchantRow, type Summary } from "./WalletCard";
import TopUp from "./TopUp";
import MerchantSpend from "./MerchantSpend";
import Activity from "./Activity";
import AgentChat from "./AgentChat";
import AgentKeys from "./AgentKeys";
import SaveLogin from "./SaveLogin";

type Account = { id: string; name: string; kind: "human" | "agent"; email: string | null; is_demo: boolean; has_password: boolean };
type WalletData = { account: Account; summary: Summary; entries: LedgerEntry[]; byMerchant: MerchantRow[] };
type Tab = "wallet" | "activity" | "agent";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "wallet",
    label: "Wallet",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M16 13h2M3 10h18M7 6V5a2 2 0 0 1 2-2h8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "activity",
    label: "Activity",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" strokeLinejoin="round" />
        <path d="M9 8h6M9 12h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "agent",
    label: "Agent",
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z" strokeLinejoin="round" />
        <path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default function Dashboard() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [tab, setTab] = useState<Tab>("wallet");
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [unseen, setUnseen] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  const tabRef = useRef<Tab>("wallet");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/wallet", { cache: "no-store" });
      if (res.status === 401) {
        // Session expired or revoked: clear the cookie and go sign in.
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        window.location.replace("/login");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      const next = json as WalletData;
      // Highlight rows (and badge the Activity tab) when something new or changed arrives.
      const keys = new Set(next.entries.map((e) => `${e.id}:${e.status}`));
      if (seen.current) {
        const fresh = next.entries.filter((e) => !seen.current!.has(`${e.id}:${e.status}`)).map((e) => e.id);
        if (fresh.length) {
          setFreshIds(new Set(fresh));
          if (tabRef.current !== "activity") setUnseen((n) => n + fresh.length);
        }
      }
      seen.current = keys;
      setData(next);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => {
      load();
      const p = new URLSearchParams(window.location.search).get("topup");
      if (p === "success") setNotice({ text: "Money added. Your agent can spend it now.", tone: "good" });
      if (p === "cancelled") setNotice({ text: "Top-up cancelled. No money was taken.", tone: "bad" });
      if (p === "unpaid") setNotice({ text: "Stripe hasn't confirmed that payment yet.", tone: "bad" });
      const welcome = new URLSearchParams(window.location.search).get("welcome");
      if (welcome === "agent") setNotice({ text: "You're in. This is the wallet your agent opened for you.", tone: "good" });
      if (p || welcome) window.history.replaceState({}, "", "/");
    }, 0);
    const poll = setInterval(load, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  function go(next: Tab) {
    setTab(next);
    tabRef.current = next;
    if (next === "activity") setUnseen(0);
    window.scrollTo({ top: 0 });
  }

  const show = (t: Tab) => (tab === t ? "block" : "hidden") + " lg:block";
  const account = data?.account;

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.replace("/login");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
      <header className="mb-5 flex items-center justify-between gap-3 lg:mb-8">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet font-display text-xl font-bold text-white shadow-[0_8px_20px_-8px_var(--violet)]">
            W
          </span>
          <div>
            <h1 className="font-display text-2xl font-semibold leading-none tracking-tight">Walley</h1>
            <p className="mt-1 hidden text-sm text-muted sm:block">The wallet your AI agent shops with</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/docs"
            className="hidden rounded-full bg-violet/10 px-3 py-1.5 text-xs font-semibold text-violet hover:bg-violet/20 sm:inline"
          >
            For agents
          </a>
          <span className="rounded-full bg-amber/15 px-3 py-1.5 text-xs font-semibold text-amber">Test mode</span>
          {account && (
            <details className="relative">
              <summary
                className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-panel py-1 pl-1 pr-3 text-sm font-semibold [&::-webkit-details-marker]:hidden"
                aria-label={`Account: ${account.name}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white ${
                    account.kind === "agent" ? "bg-glacier" : "bg-violet"
                  }`}
                  aria-hidden
                >
                  {account.kind === "agent" ? "✦" : account.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden max-w-[10rem] truncate sm:inline">{account.name}</span>
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border border-line bg-panel p-2 shadow-[0_18px_40px_-20px_rgba(28,24,56,0.45)]">
                <div className="px-3 py-2">
                  <p className="truncate font-semibold">{account.name}</p>
                  <p className="truncate text-xs text-muted">{account.email ?? "No email saved yet"}</p>
                  <p className="mt-1 text-xs text-muted">
                    {account.kind === "agent" ? "Agent account" : "Personal account"}
                    {account.is_demo ? " · shared demo" : ""}
                  </p>
                </div>
                <a href="/docs" className="block rounded-xl px-3 py-2 text-sm hover:bg-paper sm:hidden">
                  For agents
                </a>
                <button onClick={signOut} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose hover:bg-rose/10">
                  Sign out
                </button>
              </div>
            </details>
          )}
        </div>
      </header>

      {notice && (
        <div
          role="status"
          className={`rise mb-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-medium ${
            notice.tone === "good" ? "bg-leaf/15 text-leaf" : "bg-rose/12 text-rose"
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-lg leading-none">
            ×
          </button>
        </div>
      )}
      {loadError && (
        <div className="mb-5 rounded-2xl bg-rose/12 px-4 py-3 text-sm text-rose">
          Couldn&apos;t load the wallet: {loadError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-6">
          <div className={`space-y-6 ${show("wallet")}`}>
            {account && !account.has_password && <SaveLogin needsEmail={!account.email} onSaved={load} />}
            <WalletCard summary={data?.summary ?? null} byMerchant={data?.byMerchant ?? []} />
            <div className="grid gap-6 md:grid-cols-2">
              <TopUp onError={(text) => setNotice({ text, tone: "bad" })} />
              <MerchantSpend rows={data?.byMerchant ?? []} />
            </div>
            <AgentKeys onError={(text) => setNotice({ text, tone: "bad" })} />
            <button
              onClick={() => go("agent")}
              className="flex w-full items-center gap-3 rounded-3xl bg-violet/10 px-5 py-4 text-left lg:hidden"
            >
              <span className="text-2xl text-violet" aria-hidden>
                ✦
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-violet">Ask your agent to buy something</span>
                <span className="text-sm text-muted">It pays from this wallet and logs every step</span>
              </span>
            </button>
          </div>
          <div className={show("activity")}>
            <Activity entries={data?.entries ?? []} freshIds={freshIds} />
          </div>
        </div>

        <aside className={`min-w-0 ${show("agent")}`}>
          <AgentChat
            onActivity={load}
            className="h-[calc(100dvh-10.5rem)] min-h-[420px] lg:sticky lg:top-6 lg:h-[min(820px,calc(100dvh-8.5rem))]"
          />
        </aside>
      </div>

      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-3">
          {TABS.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => go(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors ${
                  tab === t.id ? "text-violet" : "text-muted"
                }`}
              >
                <span className={`rounded-full px-4 py-1 transition-colors ${tab === t.id ? "bg-violet/12" : ""}`}>{t.icon}</span>
                {t.label}
                {t.id === "activity" && unseen > 0 && (
                  <span className="absolute right-[26%] top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1 text-[11px] text-white">
                    {unseen}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
