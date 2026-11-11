// Public demo credentials. Safe to ship to the browser: these wallets only ever hold test money.
export const DEMO_PASSWORD = "walley-demo";

// A public, test-only API key for the Scout demo wallet, so an agent can try the API without signing up.
export const DEMO_API_KEY = "wk_test_demo_scout_public";

export const DEMO_ACCOUNTS = [
  {
    id: "acct_demo_maya",
    kind: "human" as const,
    name: "Maya Chen",
    email: "maya@demo.walley.dev",
    blurb: "A person whose agent already shops for her. Full purchase history.",
  },
  {
    id: "acct_demo_scout",
    kind: "agent" as const,
    name: "Scout (demo agent)",
    email: "scout@demo.walley.dev",
    blurb: "A wallet an AI agent opened for itself through the API.",
  },
];
