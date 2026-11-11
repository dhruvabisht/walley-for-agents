"use client";

import { useEffect, useState } from "react";
import { DEMO_ACCOUNTS, DEMO_API_KEY, DEMO_PASSWORD } from "@/lib/demo-public";

type Mode = "login" | "signup";

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Something went wrong. Try again.");
  return json;
}

function CopyChip({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      }}
      aria-label={`Copy ${label}`}
      className="rounded-lg bg-white/14 px-2 py-0.5 text-[11px] font-semibold transition-colors hover:bg-white/25"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function AuthScreen({ mode }: { mode: Mode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://walley-ten.vercel.app");

  useEffect(() => {
    const t = setTimeout(() => {
      setOrigin(window.location.origin);
      const p = new URLSearchParams(window.location.search);
      if (p.get("link") === "invalid") setError("That sign-in link has already been used or has expired. Sign in with your email instead.");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      window.location.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "signup") run("form", () => post("/api/auth/signup", { name, email, password }));
    else run("form", () => post("/api/auth/login", { email, password }));
  }

  const signup = mode === "signup";
  const agentCurl = `curl -X POST ${origin}/api/agents/signup \\
  -H 'Content-Type: application/json' \\
  -d '{"agent_name":"Ava (Claude)"}'`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:pt-10">
      <header className="flex items-center justify-between gap-3">
        <a href="/login" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet font-display text-xl font-bold text-white shadow-[0_8px_20px_-8px_var(--violet)]">
            W
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">Walley</span>
        </a>
        <div className="flex items-center gap-2">
          <a href="/docs" className="rounded-full bg-violet/10 px-3 py-1.5 text-xs font-semibold text-violet hover:bg-violet/20">
            For agents
          </a>
          <span className="rounded-full bg-amber/15 px-3 py-1.5 text-xs font-semibold text-amber">Test mode</span>
        </div>
      </header>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:mt-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
        <section className="rise min-w-0">
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            {signup ? "Open a wallet for your agent" : "Welcome back"}
          </h1>
          <p className="mt-3 max-w-md text-muted">
            {signup
              ? "Add money once. Your AI agent shops with it, and every purchase lands in your ledger."
              : "Sign in to see what your agent bought, add money, or hand it a new key."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4 rounded-3xl border border-line bg-panel p-5 sm:p-6" noValidate>
            {signup && (
              <label className="block">
                <span className="text-sm font-semibold">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none transition-colors focus:border-violet"
                />
              </label>
            )}
            <label className="block">
              <span className="text-sm font-semibold">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
                className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none transition-colors focus:border-violet"
              />
            </label>
            <label className="block">
              <span className="flex items-center justify-between text-sm font-semibold">
                Password
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-xs font-semibold text-violet"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={8}
                required
                className="mt-1.5 w-full rounded-2xl border border-line bg-paper px-4 py-3 outline-none transition-colors focus:border-violet"
              />
              {signup && <span className="mt-1.5 block text-xs text-muted">At least 8 characters.</span>}
            </label>

            {error && (
              <p role="alert" className="rounded-2xl bg-rose/12 px-4 py-3 text-sm font-medium text-rose">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy !== null}
              className="w-full rounded-2xl bg-violet py-3.5 font-semibold text-white shadow-[0_12px_28px_-14px_var(--violet)] transition-transform active:scale-[0.98] disabled:opacity-60"
            >
              {busy === "form" ? (signup ? "Creating your wallet…" : "Signing in…") : signup ? "Create account" : "Sign in"}
            </button>
            <p className="text-center text-sm text-muted">
              {signup ? "Already have an account? " : "New to Walley? "}
              <a href={signup ? "/login" : "/signup"} className="font-semibold text-violet">
                {signup ? "Sign in" : "Create an account"}
              </a>
            </p>
          </form>
        </section>

        <section className="rise min-w-0 space-y-4" style={{ animationDelay: "80ms" }} aria-labelledby="demo-title">
          <div>
            <h2 id="demo-title" className="font-display text-2xl font-semibold tracking-tight">
              Try a demo wallet
            </h2>
            <p className="mt-1 text-sm text-muted">
              Shared accounts loaded with test money. Nothing here charges a real card, and they top themselves back up.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((d) => (
              <article
                key={d.id}
                className={`${d.kind === "agent" ? "wallet-card-agent" : "wallet-card"} flex flex-col rounded-[24px] p-5 text-white shadow-[0_22px_50px_-26px_rgba(76,52,200,0.7)]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl font-semibold leading-tight">{d.name}</p>
                    <p className="mt-1 text-sm text-white/70">{d.blurb}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold">
                    {d.kind === "agent" ? "Agent account" : "Person"}
                  </span>
                </div>
                <dl className="mt-5 space-y-2 rounded-2xl bg-black/15 p-3 font-mono text-[13px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="sr-only">Email</dt>
                    <dd className="truncate">{d.email}</dd>
                    <CopyChip text={d.email} label="email" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="sr-only">Password</dt>
                    <dd>{DEMO_PASSWORD}</dd>
                    <CopyChip text={DEMO_PASSWORD} label="password" />
                  </div>
                </dl>
                <button
                  onClick={() => run(d.id, () => post("/api/auth/login", { email: d.email, password: DEMO_PASSWORD }))}
                  disabled={busy !== null}
                  className="mt-4 w-full rounded-2xl bg-white py-3 font-semibold text-[#2d2366] transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {busy === d.id ? "Opening wallet…" : `Sign in as ${d.name.split(" ")[0]}`}
                </button>
              </article>
            ))}
          </div>

          <div className="rounded-3xl border border-line bg-panel p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold">Are you an agent?</h3>
            <p className="mt-1 text-sm text-muted">
              Open a wallet with one request. You get an API key, plus a one-time link that signs your person in to watch
              the ledger and add money.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-paper p-3 font-mono text-xs leading-relaxed">{agentCurl}</pre>
            <p className="mt-3 text-sm text-muted">
              Just trying the API? Use the demo key{" "}
              <code className="rounded-md bg-violet/10 px-1.5 py-0.5 font-mono text-xs text-violet">{DEMO_API_KEY}</code>.
              Full guide in{" "}
              <a href="/docs" className="font-semibold text-violet">
                the docs
              </a>{" "}
              and{" "}
              <a href="/llms.txt" className="font-semibold text-violet">
                llms.txt
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
