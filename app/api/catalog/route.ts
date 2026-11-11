import { MERCHANTS, searchProducts } from "@/lib/merchants";

// Public: search what agents can buy. GET /api/catalog?q=coffee&merchant=night-owl-coffee
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const merchant = url.searchParams.get("merchant") || undefined;
  return Response.json({
    currency: "usd",
    amounts_in: "cents",
    merchants: MERCHANTS.map((m) => ({ id: m.id, name: m.name, category: m.category })),
    products: searchProducts(q, merchant),
  });
}
