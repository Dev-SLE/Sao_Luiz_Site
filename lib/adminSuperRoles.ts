/**
 * Super-roles por `users.role` (sempre ativas, sem .env).
 * Utilizador reservado adicional: ver `CODED_MASTER_USERNAMES` (bypass pelo username).
 */
const BUILTIN_SUPER = new Set([
  "admin",
  "master",
  "superadmin",
  "administrador",
  "administrator",
  "root",
]);

/** Nomes de utilizador reservados com bypass total (igual às super-roles). Case-insensitive. */
const CODED_MASTER_USERNAMES = new Set(["sle_master", "master"]);

/**
 * Contas "modo deus" reservadas: não podem ser editadas/eliminadas/redefinidas por outros
 * (perfil admin/master normal fica abaixo disto e pode ser gerido).
 */
export function isImmutableMasterUsername(username: string | null | undefined): boolean {
  const u = String(username ?? "")
    .trim()
    .toLowerCase();
  return !!u && CODED_MASTER_USERNAMES.has(u);
}

function parseRoleCsv(raw: string | undefined | null): string[] {
  return String(raw ?? "")
    .split(/[,;|\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function parseUsernameCsv(raw: string | undefined | null): string[] {
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

/**
 * Usernames adicionais com bypass total.
 * Defina `ADMIN_USERNAME_ALIASES` no servidor e, para o cliente, `NEXT_PUBLIC_ADMIN_USERNAME_ALIASES`
 * (mesmos nomes, separados por vírgula).
 */
export function getConfiguredAdminUsernameAliases(): string[] {
  if (typeof process === "undefined" || !process.env) return [];
  const raw =
    process.env.ADMIN_USERNAME_ALIASES || process.env.NEXT_PUBLIC_ADMIN_USERNAME_ALIASES || "";
  return parseUsernameCsv(raw);
}

export function isAdminSuperRole(
  role: string | null | undefined,
  username?: string | null | undefined,
): boolean {
  const u = String(username ?? "")
    .trim()
    .toLowerCase();
  if (u && (CODED_MASTER_USERNAMES.has(u) || getConfiguredAdminUsernameAliases().includes(u))) {
    return true;
  }
  const r = String(role ?? "").trim().toLowerCase();
  if (!r) return false;
  if (BUILTIN_SUPER.has(r)) return true;
  return getConfiguredAdminRoleAliases().includes(r);
}
