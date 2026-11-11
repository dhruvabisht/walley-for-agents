import Stripe from "stripe";
import { config } from "./config";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) client = new Stripe(config.stripeSecretKey());
  return client;
}

// Flattens { a: { b: 1 } } into a[b]=1 for Stripe's form encoding.
function flatten(obj: Record<string, unknown>, prefix = "", out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object" && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export class StripeApiError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
  }
}

// Raw call pinned to the preview API version. Used for the Shared Payment Token endpoints,
// which the typed SDK does not cover yet.
export async function stripePreview<T = Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.stripeSecretKey()}`,
      "Stripe-Version": config.stripePreviewVersion,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? flatten(params) : undefined,
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new StripeApiError(res.status, json?.error?.code, json?.error?.message || "Stripe error");
  return json as T;
}
