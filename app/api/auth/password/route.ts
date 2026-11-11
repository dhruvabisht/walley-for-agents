import { AuthError, cleanEmail, cleanPassword, requireAccount, setCredentials } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

// Save an email and password on an account an agent created, so its person can sign in again.
// POST /api/auth/password { email?, password }  (signed-in person only)
export async function POST(req: Request) {
  try {
    const account = await requireAccount(req, { sessionOnly: true });
    if (account.is_demo) throw new AuthError(403, "demo_account", "Demo accounts are shared, so their login can't be changed.");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const email = account.email ? null : cleanEmail(body.email);
    await setCredentials(account.id, email, cleanPassword(body.password));
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
