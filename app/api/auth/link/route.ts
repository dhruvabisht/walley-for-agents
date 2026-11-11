import { createSession, redeemSignInLink, sessionCookie } from "@/lib/auth";
import { ensureDemoAccounts } from "@/lib/demo";

// One-time sign-in link an agent hands to its person: GET /api/auth/link?token=wl_...
// Signs them in and opens the dashboard, where they can save an email and password.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  await ensureDemoAccounts();
  const accountId = token ? await redeemSignInLink(token) : null;
  if (!accountId) return Response.redirect(`${url.origin}/login?link=invalid`, 303);
  const { token: session, expires } = await createSession(accountId);
  return new Response(null, {
    status: 303,
    headers: { Location: `${url.origin}/?welcome=agent`, "Set-Cookie": sessionCookie(session, expires) },
  });
}
