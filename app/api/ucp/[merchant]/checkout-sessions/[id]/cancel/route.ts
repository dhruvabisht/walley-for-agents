import { cancelCheckout } from "@/lib/ucp-merchant";
import { errorResponse } from "@/lib/http";

// UCP: POST /checkout-sessions/{id}/cancel
export async function POST(_req: Request, ctx: RouteContext<"/api/ucp/[merchant]/checkout-sessions/[id]/cancel">) {
  try {
    const { merchant, id } = await ctx.params;
    return Response.json(await cancelCheckout(merchant, id));
  } catch (e) {
    return errorResponse(e);
  }
}
