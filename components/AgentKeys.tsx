"use client";

import { useCallback, useEffect, useState } from "react";
import CopyButton from "./CopyButton";

type Key = { id: string; prefix: string; label: string; created_at: string; last_used_at: string | null };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "never";

// Lets a person give their own agents access to this wallet, one key per agent, and cut one off.
export default function AgentKeys({ onError }: { onError: (msg: string) => void }) {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<{ key: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/keys", { cache: "no-store" });
    const json = await res.json();
    if (res.ok) setKeys(json.keys);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setOrigin(window.location.origin);
      load();
    }, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label || "My agent" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      setFresh({ key: json.key, label: json.label });
      setLabel("");
      load();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(k: Key) {
    const res = await fetch(`/api/keys/${k.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) onError(json.message || "Couldn't revoke that key.");
    load();
  }

  return (
    <section className="rounded-3xl border border-line bg-panel p-5 sm:p-6" aria-labelledby="keys-title">
      <h2 id="keys-title" className="font-display text-xl font-semibold">
        Connect an agent
      </h2>
      <p className="mt-1 text-sm text-muted">
        Give each agent its own key. It can check the balance and pay from this wallet, and you can cut it off at any time.
      </p>

      <form onSubmit={create} className="mt-4 flex gap-2">
        <label className="sr-only" htmlFor="key-label">
          Agent name
        </label>
        <input
          id="key-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Agent name, e.g. Claude Code"
          maxLength={60}
          className="min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm outline-none focus:border-violet"
        />
        <button
          disabled={busy}
          className="shrink-0 rounded-2xl bg-violet px-4 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create key"}
        </button>
      </form>

      {fresh && (
        <div className="rise mt-4 rounded-2xl bg-leaf/12 p-4">
          <p className="text-sm font-semibold text-leaf">Key for {fresh.label} created. Copy it now: it won&apos;t be shown again.</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-panel px-3 py-2 font-mono text-xs">{fresh.key}</code>
            <CopyButton text={fresh.key} />
          </div>
          <p className="mt-3 text-xs text-muted">Tell your agent:</p>
          <pre className="mt-1 whitespace-pre-wrap break-all rounded-xl bg-panel p-3 font-mono text-[11px] leading-relaxed">{`Read ${origin}/llms.txt and pay with Walley.
Send this header on every call:
Authorization: Bearer ${fresh.key}`}</pre>
          <button onClick={() => setFresh(null)} className="mt-2 text-xs font-semibold text-muted">
            Done, I saved it
          </button>
        </div>
      )}

      <ul className="mt-4 divide-y divide-line">
        {keys === null && <li className="py-3 text-sm text-muted">Loading keys…</li>}
        {keys?.length === 0 && <li className="py-3 text-sm text-muted">No agents connected yet. Create a key above.</li>}
        {keys?.map((k) => (
          <li key={k.id} className="flex items-center gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet/12 text-violet" aria-hidden>
              ✦
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{k.label}</span>
              <span className="block truncate font-mono text-xs text-muted">
                {k.prefix}… · last used {when(k.last_used_at)}
              </span>
            </span>
            {k.id !== "key_demo_scout" && (
              <button
                onClick={() => revoke(k)}
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold text-rose hover:bg-rose/10"
              >
                Revoke
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
