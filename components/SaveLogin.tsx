"use client";

import { useState } from "react";

// Shown on wallets an agent opened: the person saves an email and password so they can sign in again.
export default function SaveLogin({ needsEmail, onSaved }: { needsEmail: boolean; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: needsEmail ? email : undefined, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rise rounded-3xl border border-violet/30 bg-violet/8 p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold">Your agent opened this wallet for you</h2>
      <p className="mt-1 text-sm text-muted">
        That sign-in link only works once. Save {needsEmail ? "an email and password" : "a password"} so you can come back.
      </p>
      <form onSubmit={save} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        {needsEmail && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            aria-label="Email"
            className="rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm outline-none focus:border-violet"
          />
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (8+ characters)"
          autoComplete="new-password"
          aria-label="Password"
          className={`rounded-2xl border border-line bg-panel px-4 py-2.5 text-sm outline-none focus:border-violet ${needsEmail ? "" : "sm:col-span-2"}`}
        />
        <button
          disabled={busy}
          className="rounded-2xl bg-violet px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save login"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm font-medium text-rose">{error}</p>}
    </section>
  );
}
