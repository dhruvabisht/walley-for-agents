import { clearedSessionCookie, endSession, readCookie, SESSION_COOKIE } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

// POST /api/auth/logout -> ends the session and clears the cookie.
export async function POST(req: Request) {
  try {
    await endSession(readCookie(req, SESSION_COOKIE));
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearedSessionCookie() } });
  } catch (e) {
    return errorResponse(e);
  }
}
