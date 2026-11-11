import { getCheckout } from "@/lib/ucp-merchant";
import { errorResponse } from "@/lib/http";

// UCP: GET /checkout-sessions/{id}
export async function GET(_req: Request, ctx: RouteContext<"/api/ucp/[merchant]/checkout-sessions/[id]">) {
  try {
    const { merchant, id } = await ctx.params;
    return Response.json(await getCheckout(merchant, id));
  } catch (e) {
    return errorResponse(e);
  }
}
