import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "sle_session";

type SessionPayload = {
  username: string;
  role: string;
  origin?: string | null;
  dest?: string | null;
  iat: number;
};

function toBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET || process.env.EVOLUTION_WEBHOOK_TOKEN || "dev-session-secret";
}

function sign(payloadBase64: string) {
  return createHmac("sha256", getSessionSecret()).update(payloadBase64).digest("base64url");
}

export function encodeSession(payload: Omit<SessionPayload, "iat">) {
  const fullPayload: SessionPayload = {
    ...payload,
    iat: Date.now(),
  };
  const payloadBase64 = toBase64Url(JSON.stringify(fullPayload));
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function decodeSession(cookieValue?: string | null): SessionPayload | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [payloadBase64, signature] = parts;
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = sign(payloadBase64);
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (signatureBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(signatureBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payloadBase64)) as SessionPayload;
    if (!parsed?.username || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}
