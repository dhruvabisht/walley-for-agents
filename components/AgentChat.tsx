"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentStep, ChatMessage } from "@/lib/agent";

type Turn = { role: "user" | "assistant"; text: string; steps?: AgentStep[] };

const SUGGESTIONS = [
  "What can you buy for me?",
  "Buy me a merino beanie",
  "Get the Ethiopia coffee beans and a cold brew concentrate",
  "Buy the Speak With Confidence book",
];

const TOOL_LABEL: Record<string, string> = {
  search_products: "Searched catalogs",
  get_wallet_balance: "Checked wallet",
  create_checkout: "UCP checkout created",
  complete_checkout: "Paid with Shared Payment Token",
};

export default function AgentChat({ onActivity }: { onActivity: () => void }) {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [turns, busy]);

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
      if (!res.ok) throw new Error(data.message || "Agent error");
      setHistory(data.messages);
      const last = [...data.messages].reverse().find((m: ChatMessage) => m.role === "assistant" && m.content);
      setTurns((t) => [...t, { role: "assistant", text: last?.content || "(no reply)", steps: data.steps }]);
      if (data.steps?.some((s: AgentStep) => s.tool === "complete_checkout")) onActivity();
    } catch (e) {
      setTurns((t) => [...t, { role: "assistant", text: `⚠️ ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setBusy(false);
      onActivity();
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel flex flex-col h-[640px] lg:h-[calc(100vh-7rem)] lg:sticky lg:top-6">
      <header className="px-5 py-4 border-b border-line">
        <h2 className="font-semibold">Shopping agent</h2>
        <p className="text-sm text-muted">Shops over UCP, pays only through the wallet.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted">Try:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-line hover:border-accent hover:text-accent"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            {t.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink text-panel px-3.5 py-2 text-sm">{t.text}</div>
            ) : (
              <div className="space-y-2">
                {t.steps && t.steps.length > 0 && (
                  <ol className="space-y-1">
                    {t.steps.map((s, j) => (
                      <li key={j} className="flex gap-2 text-xs">
                        <span className={s.ok ? "text-credit" : "text-danger"}>{s.ok ? "●" : "✕"}</span>
                        <span>
                          <span className="font-medium">{TOOL_LABEL[s.tool] || s.tool}</span>
                          <span className="text-muted"> · {s.summary}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{t.text}</div>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="text-sm text-muted animate-pulse">Agent is working…</div>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="p-3 border-t border-line flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the agent to buy something…"
          className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-lg bg-accent text-white px-4 text-sm font-medium disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </section>
  );
}
