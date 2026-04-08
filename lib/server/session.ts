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

function isProductionNodeEnv() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

/**
 * Em produção usa apenas AUTH_SESSION_SECRET (não reutilize o token do webhook).
 * Fora de produção: AUTH_SESSION_SECRET, senão EVOLUTION_WEBHOOK_TOKEN, senão segredo fixo de dev.
 */
export function resolveSessionSecret(): string | null {
  const auth = String(process.env.AUTH_SESSION_SECRET || "").trim();
  if (isProductionNodeEnv()) {
    return auth || null;
  }
  if (auth) return auth;
  const evo = String(process.env.EVOLUTION_WEBHOOK_TOKEN || "").trim();
  if (evo) return evo;
  return "dev-session-secret";
}

/** True quando o deploy está em produção sem AUTH_SESSION_SECRET (login e cookies devem falhar). */
export function authSessionSecretMissingInProduction(): boolean {
  return isProductionNodeEnv() && !String(process.env.AUTH_SESSION_SECRET || "").trim();
}

function hmacSign(secret: string, payloadBase64: string) {
  return createHmac("sha256", secret).update(payloadBase64).digest("base64url");
}

function signOrThrow(payloadBase64: string) {
  const secret = resolveSessionSecret();
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET ausente em produção");
  }
  return hmacSign(secret, payloadBase64);
}

export function encodeSession(payload: Omit<SessionPayload, "iat">) {
  const fullPayload: SessionPayload = {
    ...payload,
    iat: Date.now(),
  };
  const payloadBase64 = toBase64Url(JSON.stringify(fullPayload));
  const signature = signOrThrow(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function decodeSession(cookieValue?: string | null): SessionPayload | null {
  if (!cookieValue || typeof cookieValue !== "string") return null;
  const secret = resolveSessionSecret();
  if (!secret) return null;
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [payloadBase64, signature] = parts;
  if (!payloadBase64 || !signature) return null;

  const expectedSignature = hmacSign(secret, payloadBase64);
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
