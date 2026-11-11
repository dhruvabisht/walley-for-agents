import { checkPassword, createSession, sessionCookie } from "@/lib/auth";
import { refillDemo } from "@/lib/demo";
import { errorResponse } from "@/lib/http";

// POST /api/auth/login { email, password } -> sets the session cookie.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const account = await checkPassword(body.email, body.password);
    if (account.is_demo) await refillDemo(account.id); // demo wallets never run dry
    const { token, expires } = await createSession(account.id);
    return Response.json({ account }, { headers: { "Set-Cookie": sessionCookie(token, expires) } });
  } catch (e) {
    return errorResponse(e);
  }
}
