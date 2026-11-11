"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentStep, ChatMessage } from "@/lib/agent";
import { usd } from "./format";
import { toneFor } from "./theme";

type Turn = { role: "user" | "assistant"; text: string; steps?: AgentStep[]; error?: boolean };

const SUGGESTIONS = [
  { text: "What can you buy for me?", emoji: "🛍️" },
  { text: "Buy me a merino beanie", emoji: "⛷️" },
  { text: "Get the Ethiopia coffee beans and a cold brew concentrate", emoji: "☕" },
  { text: "Buy the Speak With Confidence book", emoji: "📚" },
];

const STEP_LABEL: Record<string, string> = {
  search_products: "Searched the shops",
  get_wallet_balance: "Checked the wallet",
  create_checkout: "Opened a UCP checkout",
  complete_checkout: "Paid with a Shared Payment Token",
};

// Light markdown: **bold** and line breaks are all the agent uses.
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line.trim() === "" ? "h-2" : ""}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j}>{part.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function Receipt({ step }: { step: AgentStep }) {
  const d = step.data || {};
  const tone = toneFor(String(step.args.merchant_id));
  return (
    <div className={`rise overflow-hidden rounded-2xl bg-panel ring-1 ${tone.ring}`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 ${tone.tile}`}>
        <span aria-hidden>{tone.emoji}</span>
        <span className={`font-semibold ${tone.text}`}>Paid {tone.name}</span>
        <span className="ml-auto text-xs font-medium text-leaf">✓ Settled</span>
      </div>
      <dl className="space-y-1 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Total</dt>
          <dd className="font-display font-semibold tabular">{usd(Number(d.total_cents || 0))}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted">Order</dt>
          <dd className="truncate font-mono text-xs">{String(d.order_id || "")}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="shrink-0 text-muted">Token</dt>
          <dd className="truncate font-mono text-xs">{String(d.shared_payment_token || "")}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function AgentChat({ onActivity, className = "" }: { onActivity: () => void; className?: string }) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    const next: ChatMessage[] = [...history, { role: "user", content: text }];
    setTurns((t) => [...t, { role: "user", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "The agent could not answer.");
      setHistory(data.messages);
      const last = [...data.messages].reverse().find((m: ChatMessage) => m.role === "assistant" && m.content);
      setTurns((t) => [...t, { role: "assistant", text: last?.content || "Done.", steps: data.steps }]);
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", text: e instanceof Error ? e.message : String(e), error: true }]);
    } finally {
      setBusy(false);
      onActivity();
    }
  }

  return (
    <section className={`flex flex-col overflow-hidden rounded-3xl border border-line bg-panel ${className}`}>
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-violet text-lg text-white" aria-hidden>
          ✦
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-leaf ring-2 ring-panel" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-tight">Your shopping agent</h2>
          <p className="truncate text-xs text-muted">Buys only what you ask for, and only from this wallet</p>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5" aria-live="polite">
        {turns.length === 0 && (
          <div className="rise">
            <p className="mb-3 text-sm text-muted">Tell the agent what you need. It shows you the price before it pays.</p>
            <div className="grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="flex items-center gap-3 rounded-2xl border border-line px-3.5 py-3 text-left text-sm transition-colors hover:border-violet hover:bg-violet/5"
                >
                  <span className="text-lg" aria-hidden>
                    {s.emoji}
                  </span>
                  <span>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="rise flex justify-end">
              <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-violet px-4 py-2.5 text-sm text-white">{t.text}</div>
            </div>
          ) : (
            <div key={i} className="rise space-y-3">
              {t.steps && t.steps.length > 0 && (
                <ol className="relative ml-1.5 space-y-2 border-l-2 border-line pl-4">
                  {t.steps.map((s, j) => (
                    <li key={j} className="relative text-xs">
                      <span
                        className={`absolute -left-[23px] top-0.5 h-3 w-3 rounded-full ring-4 ring-panel ${s.ok ? "bg-leaf" : "bg-rose"}`}
                        aria-hidden
                      />
                      <span className="font-semibold">
                        {!s.ok && s.tool === "complete_checkout" ? "Payment blocked by the wallet" : STEP_LABEL[s.tool] || s.tool}
                      </span>
                      <span className="block break-words text-muted">{s.summary}</span>
                    </li>
                  ))}
                </ol>
              )}
              {t.steps
                ?.filter((s) => s.tool === "complete_checkout" && s.ok && s.data?.status === "completed")
                .map((s, j) => <Receipt key={j} step={s} />)}
              <div
                className={`max-w-[92%] rounded-3xl rounded-bl-lg px-4 py-3 text-sm leading-relaxed ${
                  t.error ? "bg-rose/10 text-rose" : "bg-paper"
                }`}
              >
                <RichText text={t.text} />
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted" role="status">
            <span className="flex gap-1" aria-hidden>
              <span className="h-2 w-2 animate-bounce rounded-full bg-violet [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-glacier [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-amber" />
            </span>
            The agent is shopping
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <label htmlFor="agent-input" className="sr-only">
          Message the agent
        </label>
        <input
          id="agent-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell the agent what to buy"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 py-3 text-base outline-none focus:border-violet sm:text-sm"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-2xl bg-violet px-5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
