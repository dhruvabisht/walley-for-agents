import { UcpError } from "./ucp-merchant";
import { AuthError } from "./auth";

// Strips anything that could be a credential from text that may reach a browser:
// URLs with user:password@, and Stripe / OpenRouter / Neon / Vercel key shapes.
export function redact(text: string): string {
  return text
    .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s'"@/]+@[^\s'")]+/gi, "[redacted-url]")
    .replace(/\b(sk|rk|pk)_(test|live)_[A-Za-z0-9]+/g, "[redacted-key]")
    .replace(/\bsk-or-[A-Za-z0-9-]+/g, "[redacted-key]")
    .replace(/\b(npg|vca|whsec)_[A-Za-z0-9]+/g, "[redacted-key]")
    .replace(/\b(wk_test|ws|wl)_[A-Za-z0-9_-]{8,}/g, "[redacted-key]");
}

export function errorResponse(e: unknown) {
  if (e instanceof AuthError) return Response.json({ code: e.code, message: e.message }, { status: e.status });
  if (e instanceof UcpError) return Response.json({ code: e.code, message: redact(e.message) }, { status: e.status });
  // Unexpected errors: log the detail on the server only, never send it to the client.
  console.error("[walley]", redact(e instanceof Error ? e.message : String(e)));
  return Response.json({ code: "internal_error", message: "Something went wrong on the server. Check the logs." }, { status: 500 });
}
