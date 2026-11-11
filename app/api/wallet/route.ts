import { getSummary, listEntries, spendByMerchant } from "@/lib/ledger";
import { connection } from "next/server";
import { errorResponse } from "@/lib/http";

// Everything the dashboard needs: balance summary, ledger, spend per merchant.
export async function GET() {
  await connection(); // always read the live ledger, never prerender
  try {
    const [summary, entries, byMerchant] = await Promise.all([getSummary(), listEntries(), spendByMerchant()]);
    return Response.json({
      summary,
      entries,
      byMerchant: byMerchant.map((r) => ({ merchant: r.merchant_name, total: Number(r.total), orders: Number(r.orders) })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
