// Central place for configuration. Values come from .env (written by `stripe projects env --pull`).
// Nothing here is ever sent to the browser.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Run \`stripe projects env --pull\`.`);
  return value;
}

export const config = {
  stripeSecretKey: () =>
    required("STRIPE_SECRET_KEY", process.env.WALLEY_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY),
  databaseUrl: () => required("NEON_POSTGRES_CONNECTION_STRING", process.env.NEON_POSTGRES_CONNECTION_STRING),
  openRouterKey: () => required("OPENROUTER_API_KEY", process.env.OPENROUTER_API_KEY),
  openRouterModel: () => process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5.5",
  webhookSecret: () => process.env.STRIPE_WEBHOOK_SECRET,
  // Stripe preview version that exposes Shared Payment Tokens.
  stripePreviewVersion: "2026-09-30.preview",
  // Seller's Stripe profile the SPT is scoped to. Sandbox default is Stripe's documented test seller profile.
  sellerProfile: () =>
    process.env.WALLEY_SELLER_PROFILE || "profile_test_61TU90nIeGjU7NNVXA6TU90m7ISQWsBxpcx9lASWWXTk",
  currency: "usd",
  // Hard ceiling per agent order, in cents. The agent can never authorise more than this in one purchase.
  maxOrderAmount: () => Number(process.env.WALLEY_MAX_ORDER_CENTS || 50000),
  // How long an SPT stays valid after the wallet issues it.
  sptTtlSeconds: 15 * 60,
};
