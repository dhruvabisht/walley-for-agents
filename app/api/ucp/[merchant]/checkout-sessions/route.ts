import { createCheckout } from "@/lib/ucp-merchant";
import { errorResponse } from "@/lib/http";

// UCP: POST /checkout-sessions — start a checkout with line items.
export async function POST(req: Request, ctx: RouteContext<"/api/ucp/[merchant]/checkout-sessions">) {
  try {
    const { merchant } = await ctx.params;
    return Response.json(await createCheckout(merchant, await req.json()), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
