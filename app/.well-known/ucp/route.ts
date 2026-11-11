import { MERCHANTS } from "@/lib/merchants";

// UCP discovery: which merchants live here and where their checkout endpoints are.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return Response.json({
    ucp: { version: "2026-04-08" },
    merchants: MERCHANTS.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      services: { checkout: { rest: { endpoint: `${origin}/api/ucp/${m.id}` } } },
      payment_handlers: [{ name: "com.stripe.shared_payment_token" }],
    })),
  });
}
