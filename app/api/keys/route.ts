import { cleanName, createApiKey, listApiKeys, requireAccount } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

// API keys for the signed-in person's agents. Only a signed-in person can list or create them.
export async function GET(req: Request) {
  try {
    const account = await requireAccount(req, { sessionOnly: true });
    return Response.json({ keys: await listApiKeys(account.id) });
  } catch (e) {
    return errorResponse(e);
  }
}

// POST /api/keys { label } -> { key } (the full key is returned once)
export async function POST(req: Request) {
  try {
    const account = await requireAccount(req, { sessionOnly: true });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const created = await createApiKey(account.id, cleanName(body.label, "My agent"));
    return Response.json(created, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
