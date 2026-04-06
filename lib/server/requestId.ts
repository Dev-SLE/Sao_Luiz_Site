import { randomUUID } from "crypto";

export function getRequestId(req: Request): string {
  const h = req.headers.get("x-request-id") || req.headers.get("x-correlation-id");
  const v = String(h || "").trim();
  if (v) return v.slice(0, 120);
  return randomUUID();
}
