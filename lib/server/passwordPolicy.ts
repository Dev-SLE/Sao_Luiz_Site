export type PasswordPolicyResult = {
  ok: boolean;
  errors: string[];
};

const COMMON_WEAK = new Set([
  "123456",
  "12345678",
  "123456789",
  "password",
  "qwerty",
  "abc123",
  "senha123",
  "admin123",
]);

function hasSequentialChars(s: string): boolean {
  const t = s.toLowerCase();
  for (let i = 0; i <= t.length - 4; i += 1) {
    const a = t.charCodeAt(i);
    const b = t.charCodeAt(i + 1);
    const c = t.charCodeAt(i + 2);
    const d = t.charCodeAt(i + 3);
    if (b === a + 1 && c === b + 1 && d === c + 1) return true;
    if (b === a - 1 && c === b - 1 && d === c - 1) return true;
  }
  return false;
}

export function validateStrongPassword(password: string, usernameHint?: string): PasswordPolicyResult {
  const p = String(password || "");
  const errors: string[] = [];
  if (p.length < 12) errors.push("A senha precisa ter no mínimo 12 caracteres.");
  if (!/[a-z]/.test(p)) errors.push("Inclua ao menos 1 letra minúscula.");
  if (!/[A-Z]/.test(p)) errors.push("Inclua ao menos 1 letra maiúscula.");
  if (!/\d/.test(p)) errors.push("Inclua ao menos 1 número.");
  if (!/[^A-Za-z0-9]/.test(p)) errors.push("Inclua ao menos 1 caractere especial.");
  if (/\s/.test(p)) errors.push("A senha não pode conter espaços.");
  const low = p.toLowerCase();
  if (COMMON_WEAK.has(low)) errors.push("A senha é muito comum.");
  if (hasSequentialChars(p)) errors.push("Evite sequências simples (ex.: 1234 ou abcd).");
  if (usernameHint) {
    const u = String(usernameHint).trim().toLowerCase();
    if (u && low.includes(u)) errors.push("A senha não pode conter o usuário.");
  }
  return { ok: errors.length === 0, errors };
}

