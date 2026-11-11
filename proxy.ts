import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: send visitors without a session cookie straight to /login.
// The real check happens in every API route (lib/auth.ts requireAccount).
export function proxy(request: NextRequest) {
  if (!request.cookies.has("walley_session")) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/"] };
