// Demo accounts anyone can use to try Walley. Their credentials are public (shown on /login),
// so they only ever hold test money: "Demo credit" rows, no card is charged.
import { randomUUID } from "node:crypto";
import { q } from "./db";
import { hashPassword, sha256 } from "./auth";

import { DEMO_ACCOUNTS, DEMO_API_KEY, DEMO_PASSWORD } from "./demo-public";

export { DEMO_ACCOUNTS, DEMO_API_KEY, DEMO_PASSWORD };

const FLOOR_CENTS = 5_000; // refill a demo wallet when it drops below $50
const REFILL_TO_CENTS = 15_000; // back up to $150

// Tops a demo wallet back up with test money so visitors always have something to spend.
export async function refillDemo(accountId: string) {
  if (!DEMO_ACCOUNTS.some((d) => d.id === accountId)) return;
  const [row] = await q<{ available: string }>(
    `select coalesce(sum(amount) filter (where kind = 'topup' and status = 'settled'), 0)
          + coalesce(sum(amount) filter (where kind = 'purchase' and status in ('pending','settled')), 0) as available
     from ledger_entries where account_id = $1`,
    [accountId],
  );
  const available = Number(row?.available ?? 0);
  if (available >= FLOOR_CENTS) return;
  await q(
    `insert into ledger_entries (id, account_id, kind, status, amount, description, settled_at)
     values ($1, $2, 'topup', 'settled', $3, 'Demo credit (test money, no card charged)', now())`,
    [randomUUID(), accountId, REFILL_TO_CENTS - available],
  );
}

let ready: Promise<void> | null = null;

// Idempotent, once per server start: creates the demo accounts, gives the pre-accounts ledger
// history to Maya, and makes sure both demo wallets have test money.
export function ensureDemoAccounts() {
  if (!ready) {
    ready = (async () => {
      const existing = await q<{ id: string }>(`select id from accounts where id = any($1)`, [DEMO_ACCOUNTS.map((d) => d.id)]);
      for (const d of DEMO_ACCOUNTS) {
        if (existing.some((e) => e.id === d.id)) continue;
        await q(
          `insert into accounts (id, kind, name, email, password_hash, is_demo) values ($1, $2, $3, $4, $5, true)
           on conflict do nothing`,
          [d.id, d.kind, d.name, d.email, await hashPassword(DEMO_PASSWORD)],
        );
      }
      await q(
        `insert into api_keys (id, account_id, key_hash, prefix, label) values ('key_demo_scout', 'acct_demo_scout', $1, $2, 'Public demo key')
         on conflict do nothing`,
        [sha256(DEMO_API_KEY), DEMO_API_KEY.slice(0, 12)],
      );
      // Walley had one shared wallet before accounts existed. That history now belongs to Maya.
      await q(`update ledger_entries set account_id = 'acct_demo_maya' where account_id is null`);
      for (const d of DEMO_ACCOUNTS) await refillDemo(d.id);
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}
