import { requireAccount, revokeApiKey } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

// DELETE /api/keys/{id} -> revokes the key; agents using it stop working immediately.
export async function DELETE(req: Request, ctx: RouteContext<"/api/keys/[id]">) {
  try {
    const account = await requireAccount(req, { sessionOnly: true });
    const { id } = await ctx.params;
    const ok = await revokeApiKey(account.id, id);
    if (!ok) return Response.json({ code: "not_found", message: "No active key with that id on this account." }, { status: 404 });
    return Response.json({ revoked: id });
  } catch (e) {
    return errorResponse(e);
  }
}
