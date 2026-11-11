import { UcpError } from "./ucp-merchant";

export function errorResponse(e: unknown) {
  if (e instanceof UcpError) return Response.json({ code: e.code, message: e.message }, { status: e.status });
  const message = e instanceof Error ? e.message : String(e);
  console.error("[walley]", message);
  return Response.json({ code: "internal_error", message }, { status: 500 });
}
