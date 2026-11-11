# Walley: a wallet your AI agent shops with

You add money to Walley through Stripe. Your AI agent shops for you over the **Universal Commerce Protocol (UCP)** and can only pay from that wallet, with a **Stripe Shared Payment Token (SPT)** that is scoped to one seller, capped at the exact order total and expires in 15 minutes. Every top-up, purchase and blocked attempt lands in a ledger you can audit: what was bought, from which shop, for how much, when, and the full Stripe trail.

## How a purchase works

```
You: "Buy me a merino beanie"
  │
  ▼
Agent (Claude via OpenRouter, tool calling)
  ├─ search_products ─────────────► merchant catalogs
  ├─ create_checkout ─────────────► POST /api/ucp/{merchant}/checkout-sessions        (UCP)
  └─ complete_checkout ───────────► Wallet
                                      1. hold funds on the ledger (atomic; refuses if balance is too low)
                                      2. mint an SPT: max_amount = order total, 15 min expiry
                                      3. POST /api/ucp/{merchant}/checkout-sessions/{id}/complete
                                         { payment_data: { token: "spt_…", provider: "stripe" } }
                                           └─ merchant: PaymentIntent with
                                              payment_method_data[shared_payment_granted_token]
                                      4. settle the ledger entry (or release the hold on failure)
```

The agent never sees a card. Merchants only ever see a single-use, capped, expiring token.

### Where the money comes from (Approach A: prepaid wallet)

- **Top-ups** are real Stripe Checkout payments. The wallet is credited only after the server re-reads the Checkout Session and sees `payment_status = paid`.
- **Spending** draws on the wallet's own funding card. In the sandbox that is a Stripe test card; in production it would be a **Stripe Issuing** virtual card funded by the top-ups, so the user's money really backs every SPT.
- **SPT issuing path.** The wallet first tries the agent-side API `POST /v1/shared_payment/issued_tokens`. That needs a Stripe profile on the account; without one (a fresh sandbox), it falls back to `POST /v1/test_helpers/shared_payment/granted_tokens`, which simulates the token arriving at the seller with the same usage limits. Each ledger entry records which path was used (`spt_mode`).

## Accounts and demo wallets

Every account has its own wallet and ledger.

- **People** sign up at `/signup` and sign in at `/login` (email and password; scrypt hashes, HTTP-only session cookie).
- **Agents** send an API key on every call: `Authorization: Bearer wk_test_…`. A person creates one key per agent on the dashboard ("Connect an agent") and can revoke it at any time. An agent can also open a wallet itself with `POST /api/agents/signup`, which returns an API key plus a one-time sign-in link for its person.
- **Demo wallets** are listed on `/login` with one-tap sign-in: Maya (`maya@demo.walley.dev`) and Scout, an agent account (`scout@demo.walley.dev`), both with password `walley-demo`. Agents can try the API with the public key `wk_test_demo_scout_public`. Demo wallets hold test money only and top themselves back up.

Agent guide: [`/llms.txt`](https://walley-ten.vercel.app/llms.txt) and [`/docs`](https://walley-ten.vercel.app/docs).

## What's in the box

| Path | What it does |
|---|---|
| `app/page.tsx`, `components/*` | Dashboard: wallet card with the "where your money went" ribbon, add money, spend by shop, activity ledger, agent chat. Mobile gets a bottom tab bar. |
| `lib/wallet.ts` | Funding card, SPT issuing, `payForCheckout` (hold → SPT → UCP complete → settle/release) |
| `lib/ledger.ts` | Neon Postgres ledger: balances, holds, top-ups, declined attempts |
| `lib/ucp-merchant.ts` | Seller side of UCP checkout: create, get, complete (charges the SPT), cancel |
| `lib/merchants.ts` | Three demo shops: Alpine Supply Co., Night Owl Coffee Roasters, Paperleaf Books |
| `lib/agent.ts` | Shopping agent with four tools; asks before paying unless you clearly said "buy" |
| `lib/auth.ts`, `lib/demo.ts`, `proxy.ts` | Accounts, sessions, API keys, one-time sign-in links, demo wallets; `/` redirects to `/login` without a session |
| `app/login`, `app/signup`, `app/api/auth/*`, `app/api/keys`, `app/api/agents/signup` | Sign-in screens and the account API |
| `app/.well-known/ucp` | UCP discovery for the demo shops |
| `app/api/wallet/topup` | Starts Stripe Checkout; `/confirm` verifies and credits |
| `app/api/webhooks/stripe` | Optional webhook (`checkout.session.completed`) |

Guardrails: the ledger hold is atomic (the agent can't overspend), there is a per-order limit (`WALLEY_MAX_ORDER_CENTS`, default $500), each SPT is capped at the exact total and expires in 15 minutes, and refused attempts are logged as **Blocked**.

## Services (provisioned with Stripe Projects)

```bash
stripe projects add stripe/sandbox          # STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY
stripe projects add neon/free && stripe projects add neon/postgres   # NEON_POSTGRES_CONNECTION_STRING
stripe projects add openrouter/pay_as_you_go                          # OPENROUTER_API_KEY
stripe projects add vercel/hobby && stripe projects add vercel/project
stripe projects env --pull                   # writes .env (git-ignored)
stripe projects spend                        # see what the project costs
```

The Stripe sandbox key is a restricted key. It needs **Write** on Shared Payment Tokens and Shared Payment Token Test Helpers, plus Payment Intents, Payment Methods, Customers and Checkout Sessions.

### Environment variables

| Variable | Source | Required |
|---|---|---|
| `STRIPE_SECRET_KEY` | stripe/sandbox | yes |
| `NEON_POSTGRES_CONNECTION_STRING` | neon/postgres | yes |
| `OPENROUTER_API_KEY` | openrouter plan | yes |
| `OPENROUTER_MODEL` | you | no (default `anthropic/claude-sonnet-5.5`) |
| `WALLEY_STRIPE_SECRET_KEY` | you | no, overrides `STRIPE_SECRET_KEY` |
| `WALLEY_SELLER_PROFILE` | you | no, your Stripe profile id to use issued SPTs directly |
| `WALLEY_MAX_ORDER_CENTS` | you | no (default 50000) |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` | no |

## Run it

```bash
npm install
stripe projects env --pull
npm run dev -- -p 3100        # http://localhost:3100
```

Add money with test card `4242 4242 4242 4242`, any future date and CVC, then ask the agent to buy something. The ledger tables are created automatically on first request.

## Secrets

`.env`, `.env.*`, the whole `.projects/` folder (Stripe Projects state, vault and cache), `.vercel` and key files are git-ignored. Nothing in this repo contains a credential.
