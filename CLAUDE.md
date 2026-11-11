look at AGENTS.md for your rules

# Walley

A prepaid wallet AI agents spend for a person: the person adds money with Stripe Checkout, the agent pays merchants over UCP, and Walley pays each order with a Stripe Shared Payment Token (SPT) capped at the total. Every account has its own wallet and ledger. Stripe sandbox only: no real money.

- Live: https://walley-ten.vercel.app · Repo: https://github.com/dhruvabisht/walley-for-agents (public)
- Running history and decisions: `/Applications/Dhruva/Projects/Stripe/context.md` (append-only; Walley is Entries 10, 11 and 13)
- Separate project, do not touch from here: `../dev-coffee` (MPP hackathon, Entry 12)

## Map

- `lib/auth.ts`: accounts, sessions (cookie `walley_session`), API keys (`wk_test_…`), one-time sign-in links. `requireAccount(req)` accepts a Bearer key or a session; `{ sessionOnly: true }` for things only a person may do.
- `lib/demo.ts` / `lib/demo-public.ts`: demo accounts Maya and Scout (password `walley-demo`), public key `wk_test_demo_scout_public`, test-money refills.
- `lib/ledger.ts`: every query takes an `accountId`. `placeHold` is the only way money leaves a wallet (atomic balance check).
- `lib/wallet.ts`: hold → SPT → UCP complete → settle or release. `lib/agent.ts`: the OpenRouter tool loop.
- `lib/db.ts`: schema, created on first query (`create … if not exists`, `alter … add column if not exists`).
- `proxy.ts`: redirects `/` to `/login` when there is no session cookie. Real checks live in the API routes.
- Agent-facing docs: `public/llms.txt` and `app/docs/page.tsx`. Update both when an endpoint changes.

## Rules

- Never commit secrets. `.env`, `.env.*`, `.vercel` and `.projects/*` are ignored, except `.projects/state.json` and `.projects/state.local.json`, which the projects.dev submission needs. `.git/hooks/pre-commit` blocks the rest. `stripe projects` commands rewrite `.gitignore`: check `git diff .gitignore` after running them.
- Errors that reach a client go through `lib/http.ts` (`errorResponse`, `redact`). Never return raw exception text.
- Store only hashes of passwords, session tokens, API keys and sign-in links.
- Only test-mode Stripe keys. Demo wallets get labelled "Demo credit" rows, never fake Stripe payments.
- Dev server: `npx next dev -p 3100` (port 3000 belongs to the workshop starter kit). Local dev shares the production Neon database, so test data you create is live: delete it afterwards.
- Next.js 16 with `cacheComponents`: use `connection()` instead of `export const dynamic`; `RouteContext<"/path">` for route params (run `npx next typegen`).
- Deploys run from the CLI with the Vercel credentials in `.env` (the repo is not connected to Vercel's Git integration).
