// Demo sellers. Each one exposes UCP checkout endpoints at /api/ucp/{merchantId}/checkout-sessions.
// In production these would be separate businesses on their own Stripe accounts.

export type Product = { id: string; title: string; description: string; price: number }; // price in cents

export type Merchant = {
  id: string;
  name: string;
  url: string;
  category: string;
  products: Product[];
};

export const MERCHANTS: Merchant[] = [
  {
    id: "alpine-supply",
    name: "Alpine Supply Co.",
    url: "https://alpine-supply.example",
    category: "Outdoor & ski gear",
    products: [
      { id: "ALP-WAX", title: "All-temp ski wax", description: "Universal hot wax, 100g", price: 1800 },
      { id: "ALP-BEANIE", title: "Merino beanie", description: "Midweight merino wool, charcoal", price: 3200 },
      { id: "ALP-GLOVES", title: "Insulated ski gloves", description: "Waterproof, touchscreen tips", price: 4500 },
      { id: "ALP-GOGGLES", title: "Low-light ski goggles", description: "Rose lens, helmet compatible", price: 8900 },
      { id: "ALP-WARMERS", title: "Hand warmers (10 pack)", description: "Up to 10 hours of heat", price: 1200 },
    ],
  },
  {
    id: "night-owl-coffee",
    name: "Night Owl Coffee Roasters",
    url: "https://night-owl-coffee.example",
    category: "Coffee",
    products: [
      { id: "NOC-ETH", title: "Ethiopia Yirgacheffe, 250g", description: "Light roast, jasmine and citrus", price: 1900 },
      { id: "NOC-ESP", title: "House espresso blend, 1kg", description: "Medium-dark, chocolate and caramel", price: 3800 },
      { id: "NOC-COLD", title: "Cold brew concentrate, 1L", description: "Makes 8 servings", price: 1400 },
      { id: "NOC-KIT", title: "Pour-over starter kit", description: "Dripper, filters and gooseneck kettle", price: 5400 },
    ],
  },
  {
    id: "paperleaf-books",
    name: "Paperleaf Books",
    url: "https://paperleaf-books.example",
    category: "Books",
    products: [
      { id: "PLB-SPEAK", title: "Speak With Confidence", description: "Paperback, practical public speaking", price: 2200 },
      { id: "PLB-SYS", title: "Designing Data Systems", description: "Hardcover, distributed systems primer", price: 4600 },
      { id: "PLB-NOTE", title: "Dot-grid notebook, A5", description: "160 pages, lay-flat binding", price: 1500 },
    ],
  },
];

export function getMerchant(id: string): Merchant | undefined {
  return MERCHANTS.find((m) => m.id === id);
}

export function searchProducts(query?: string, merchantId?: string) {
  const words = (query || "").toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  return MERCHANTS.filter((m) => !merchantId || m.id === merchantId).flatMap((m) =>
    m.products
      .filter((p) => {
        const hay = `${p.title} ${p.description} ${m.name} ${m.category}`.toLowerCase();
        return !words.length || words.some((w) => hay.includes(w));
      })
      .map((p) => ({ merchant_id: m.id, merchant_name: m.name, ...p })),
  );
}
