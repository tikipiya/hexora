import { jsonSafe } from "../binary/serialize.ts";

export function jsonResponse(data: unknown, status = 200, corsOrigin?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (corsOrigin) {
    headers["Access-Control-Allow-Origin"] = corsOrigin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return new Response(JSON.stringify(jsonSafe(data)), { status, headers });
}

export function errorResponse(
  status: number,
  message: string,
  corsOrigin?: string,
): Response {
  return jsonResponse({ ok: false, error: message }, status, corsOrigin);
}

export function allowedCorsOrigin(
  request: Request,
  env?: { ALLOWED_ORIGIN?: string },
): string | undefined {
  const allowed = env?.ALLOWED_ORIGIN;
  if (!allowed) return undefined;
  const origin = request.headers.get("Origin");
  if (origin === allowed) return origin;
  return undefined;
}
