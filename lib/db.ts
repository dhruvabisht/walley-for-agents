import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { config } from "./config";

let sqlClient: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

function client() {
  if (!sqlClient) sqlClient = neon(config.databaseUrl());
  return sqlClient;
}

const SCHEMA = [
  `create table if not exists ledger_entries (
     id text primary key,
     created_at timestamptz not null default now(),
     settled_at timestamptz,
     kind text not null check (kind in ('topup','purchase')),
     status text not null check (status in ('pending','settled','failed','released')),
     amount bigint not null,              -- cents; + credit (top-up), - debit (purchase)
     currency text not null default 'usd',
     description text,
     merchant_id text,
     merchant_name text,
     merchant_url text,
     items jsonb,
     agent_request text,
     stripe_checkout_session_id text unique,
     payment_intent_id text,
     spt_id text,
     spt_mode text,
     ucp_checkout_id text,
     card text,
     error text
   )`,
  `create index if not exists ledger_created_idx on ledger_entries (created_at desc)`,
  `create table if not exists merchant_checkouts (
     id text primary key,
     merchant_id text not null,
     status text not null,
     currency text not null,
     line_items jsonb not null,
     total bigint not null,
     payment_intent_id text,
     order_id text,
     spt_id text,
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   )`,
  `create table if not exists wallet_config (key text primary key, value text not null)`,
];

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const stmt of SCHEMA) await client().query(stmt);
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

// Parameterised query helper: q("select * from t where id = $1", [id])
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  return (await client().query(text, params)) as T[];
}
