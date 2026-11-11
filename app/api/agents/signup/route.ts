import { AuthError, cleanEmail, cleanName, cleanPassword, createAccount, createApiKey, createSignInLink } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

// An agent opens a Walley wallet for itself (or for its person) in one call.
// POST /api/agents/signup { agent_name, email?, password? }
// Returns an API key (shown once) and a one-time sign-in link the agent gives its person,
// so they can see the ledger and add money.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = cleanName(body.agent_name ?? body.name);
    const email = body.email ? cleanEmail(body.email) : null;
    const password = body.password ? cleanPassword(body.password) : null;
    if (password && !email) throw new AuthError(400, "invalid_email", "Send an email with the password, or leave both out.");
    const account = await createAccount({ kind: "agent", name, email, password });
    const key = await createApiKey(account.id, `${name} (created at sign-up)`);
    const origin = new URL(req.url).origin;
    const link = await createSignInLink(account.id, origin);
    return Response.json(
      {
        account: { id: account.id, name: account.name, kind: account.kind, email: account.email },
        api_key: key.key,
        sign_in_link: link.url,
        sign_in_link_expires_at: link.expires.toISOString(),
        next_steps: [
          "Store api_key securely. It is shown only once. Send it as: Authorization: Bearer <api_key>",
          "Give sign_in_link to your person. It signs them in once so they can add money and watch the ledger.",
          "The wallet starts at $0. Ask your person to add money, or call POST /api/wallet/topup for a Stripe Checkout link.",
        ],
        docs: `${origin}/llms.txt`,
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
