import { completeCheckout } from "@/lib/ucp-merchant";
import { errorResponse } from "@/lib/http";

// UCP: POST /checkout-sessions/{id}/complete — body carries payment_data.token = spt_…
export async function POST(req: Request, ctx: RouteContext<"/api/ucp/[merchant]/checkout-sessions/[id]/complete">) {
  try {
    const { merchant, id } = await ctx.params;
    return Response.json(await completeCheckout(merchant, id, await req.json()));
  } catch (e) {
    return errorResponse(e);
  }
}
