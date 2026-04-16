const BUILTIN_SUPER = new Set([
  "admin",
  "superadmin",
  "administrador",
  "administrator",
  "root",
]);

function parseRoleCsv(raw: string | undefined | null): string[] {
  return String(raw ?? "")
    .split(/[,;|\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Roles adicionais (valor de `users.role`) tratados como administrador total.
 * Defina `ADMIN_ROLE_ALIASES` no servidor e, para o cliente, `NEXT_PUBLIC_ADMIN_ROLE_ALIASES`
 * (mesmos nomes, separados por vírgula).
 */
export function getConfiguredAdminRoleAliases(): string[] {
  if (typeof process === "undefined" || !process.env) return [];
  const raw = process.env.ADMIN_ROLE_ALIASES || process.env.NEXT_PUBLIC_ADMIN_ROLE_ALIASES || "";
  return parseRoleCsv(raw);
}

export function isAdminSuperRole(role: string | null | undefined): boolean {
  const r = String(role ?? "").trim().toLowerCase();
  if (!r) return false;
  if (BUILTIN_SUPER.has(r)) return true;
  return getConfiguredAdminRoleAliases().includes(r);
}
