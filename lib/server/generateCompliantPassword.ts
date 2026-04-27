import { randomInt } from "crypto";
import { validateStrongPassword } from "./passwordPolicy";

const LOWER = "abcdefghjkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*-_=+";
const ALL = LOWER + UPPER + DIGITS + SPECIAL;

function shuffleInPlace(chars: string[]): void {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    const t = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = t;
  }
}

/**
 * Senha aleatória que passa em `validateStrongPassword` (e opcionalmente não contém o username).
 * Uso servidor — depende de `crypto.randomInt`.
 */
export function generateRandomCompliantPassword(usernameHint?: string): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const len = 12 + randomInt(0, 5);
    const parts: string[] = [
      LOWER[randomInt(0, LOWER.length)]!,
      UPPER[randomInt(0, UPPER.length)]!,
      DIGITS[randomInt(0, DIGITS.length)]!,
      SPECIAL[randomInt(0, SPECIAL.length)]!,
    ];
    while (parts.length < len) {
      parts.push(ALL[randomInt(0, ALL.length)]!);
    }
    shuffleInPlace(parts);
    const pwd = parts.join("");
    const policy = validateStrongPassword(pwd, usernameHint);
    if (policy.ok) return pwd;
  }
  throw new Error("Não foi possível gerar uma senha compatível com a política.");
}
