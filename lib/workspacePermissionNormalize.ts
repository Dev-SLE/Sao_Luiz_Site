/**
 * Coerência camada "Módulo Operacional" vs abas legadas/tab.*.
 * - Sem `module.operacional.view` no perfil: remove órfãos (tabs sem módulo).
 * - Perfis antigos só com VIEW_* / ações operacionais: inferem o módulo na sessão (não altera DB).
 */

export const OPERACIONAL_MODULE_KEY = "module.operacional.view";

/**
 * Chaves que, na ausência explícita do módulo, ainda indicam acesso operacional legado
 * (utilizadores já criados antes da camada de módulo).
 */
export const OPERACIONAL_LEGACY_IMPLICIT_MODULE_KEYS = new Set<string>([
  "VIEW_DASHBOARD",
  "VIEW_PENDENCIAS",
  "VIEW_CRITICOS",
  "VIEW_EM_BUSCA",
  "VIEW_OCORRENCIAS",
  "VIEW_TAD",
  "VIEW_RASTREIO_OPERACIONAL",
  "VIEW_CONCLUIDOS",
  "VIEW_DOSSIE",
  "ASSIGN_OPERATIONAL_PENDING",
  "RETURN_OPERATIONAL_PENDING",
  "operacional.assignment.assign",
  "operacional.assignment.unassign",
  "operacional.notes.edit",
  "dossie.financeiro.attach",
  "MANAGE_RASTREIO_OPERACIONAL",
  "EDIT_NOTES",
]);

function dedupeTrim(perms: string[]): string[] {
  return [...new Set(perms.map((s) => String(s).trim()).filter(Boolean))];
}

export function shouldStripOperacionalKeyWithoutModule(key: string): boolean {
  const k = String(key).trim();
  if (!k) return false;
  if (k.startsWith("tab.operacional.")) return true;
  if (k.startsWith("scope.operacional.")) return true;
  return OPERACIONAL_LEGACY_IMPLICIT_MODULE_KEYS.has(k);
}

/** Quando o perfil não inclui o módulo, remove tudo que depende dele (tabs + legado + escopo operacional). */
export function stripOperacionalPermissionsWithoutModule(perms: string[]): string[] {
  const raw = dedupeTrim(perms);
  if (raw.includes("*") || raw.includes("admin.*")) return raw;
  if (raw.includes(OPERACIONAL_MODULE_KEY)) return raw;
  return raw.filter((p) => !shouldStripOperacionalKeyWithoutModule(p));
}

/**
 * Normalização para checagem de sessão / cliente:
 * - Órfão: só `tab.operacional.*` sem módulo e sem legado → remove as tabs.
 * - Legado ou tabs+módulo inferido: garante `module.operacional.view` no conjunto efetivo.
 */
export function normalizeOperacionalPermissionsForSession(perms: string[]): string[] {
  const raw = dedupeTrim(perms);
  if (raw.includes("*") || raw.includes("admin.*")) return raw;

  const hasMod = raw.includes(OPERACIONAL_MODULE_KEY);
  const tabOp = raw.some((p) => p.startsWith("tab.operacional."));
  const legacyOp = raw.some((p) => OPERACIONAL_LEGACY_IMPLICIT_MODULE_KEYS.has(p));
  const operacionalTabKeys = raw.filter((p) => p.startsWith("tab.operacional."));

  if (hasMod) return raw;

  if (tabOp && !legacyOp) {
    const onlyDossieTab =
      operacionalTabKeys.length === 1 && operacionalTabKeys[0] === "tab.operacional.dossie.view";
    if (onlyDossieTab) {
      return dedupeTrim([...raw, OPERACIONAL_MODULE_KEY]);
    }
    return raw.filter((p) => !p.startsWith("tab.operacional."));
  }

  if (legacyOp || tabOp) {
    return dedupeTrim([...raw, OPERACIONAL_MODULE_KEY]);
  }

  return raw;
}
