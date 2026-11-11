import { getSummary, listEntries, spendByMerchant } from "@/lib/ledger";
import { connection } from "next/server";
import { errorResponse } from "@/lib/http";
import { requireAccount } from "@/lib/auth";

// Everything the dashboard needs for the caller's wallet: balance summary, ledger, spend per merchant.
export async function GET(req: Request) {
  await connection(); // always read the live ledger, never prerender
  try {
    const account = await requireAccount(req);
    const [summary, entries, byMerchant] = await Promise.all([
      getSummary(account.id),
      listEntries(account.id),
      spendByMerchant(account.id),
    ]);
    return Response.json({
      account: {
        id: account.id,
        name: account.name,
        kind: account.kind,
        email: account.email,
        is_demo: account.is_demo,
        has_password: account.has_password,
      },
      summary,
      entries,
      byMerchant: byMerchant.map((r) => ({ merchant: r.merchant_name, total: Number(r.total), orders: Number(r.orders) })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
