import { cleanEmail, cleanName, cleanPassword, createAccount, createSession, sessionCookie } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

// A person creates a Walley account (and with it, an empty wallet) and is signed in.
// POST /api/auth/signup { name, email, password }
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const account = await createAccount({
      kind: "human",
      name: cleanName(body.name),
      email: cleanEmail(body.email),
      password: cleanPassword(body.password),
    });
    const { token, expires } = await createSession(account.id);
    return Response.json({ account }, { status: 201, headers: { "Set-Cookie": sessionCookie(token, expires) } });
  } catch (e) {
    return errorResponse(e);
  }
}
