import { requireAccount } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

// GET /api/auth/me -> the signed-in account (cookie or API key).
export async function GET(req: Request) {
  try {
    const { via, ...account } = await requireAccount(req);
    return Response.json({ account, via });
  } catch (e) {
    return errorResponse(e);
  }
}
