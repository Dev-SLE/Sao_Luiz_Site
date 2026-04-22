/**
 * Escopo de dados para rotas BI do Gerencial (agência / vendedora).
 * Servidor aplica sobre a query string para impedir bypass no cliente.
 */
import type { SessionContext } from "@/lib/server/authorization";
import { can } from "@/lib/server/authorization";
import { isAdminSuperRole } from "@/lib/adminSuperRoles";
import { BI_COMISSOES_CONFIG } from "@/modules/bi/comissoes/config";
import { BI_FUNIL_VENDAS_CONFIG } from "@/modules/bi/funilVendas/config";
import { BI_SPRINT_VENDAS_CONFIG } from "@/modules/bi/sprintVendas/config";
import { BI_METAS_PERFORMANCE_CONFIG } from "@/modules/bi/metasPerformance/config";
import { BI_TABELAS_COMBINADAS_CONFIG } from "@/modules/bi/tabelasCombinadas/config";
import { BI_FLUXO_CONFIG } from "@/modules/bi/fluxo/config";
import { BI_TAXAS_CONFIG } from "@/modules/bi/taxas/config";

export type GerencialBiModule =
  | "comissoes"
  | "funil"
  | "sprint"
  | "metas"
  | "carteira"
  | "fluxo"
  | "taxas"
  | "desempenhoAgencias"
  | "rotasOperacionais";

export type GerencialBiScope = {
  /** `upper(trim(...))` da unidade para bater com `agencia_normalizada` em metas. */
  agenciaNormalizada: string | null;
  /** Nome da vendedora conforme cadastro no BI (trim); força filtro em comissões / funil / sprint. */
  vendedorRestrito: string | null;
};

export function resolveGerencialBiScope(session: SessionContext | null): GerencialBiScope {
  if (!session) {
    return { agenciaNormalizada: null, vendedorRestrito: null };
  }
  if (isAdminSuperRole(session.role)) {
    return { agenciaNormalizada: null, vendedorRestrito: null };
  }
  const bv = String(session.biVendedora ?? "").trim();
  const vendedorRestrito = bv.length > 0 ? bv : null;

  const hasOperacionalAll = can(session, "scope.operacional.all");
  let agenciaNormalizada: string | null = null;
  if (!hasOperacionalAll) {
    const unit = String(session.dest ?? "").trim() || String(session.origin ?? "").trim();
    if (unit) agenciaNormalizada = unit.toUpperCase();
  }

  return { agenciaNormalizada, vendedorRestrito };
}

/** Injeta filtros obrigatórios na URL antes das leituras BI (muta `url`). */
export function applyGerencialBiScopeToUrl(url: URL, session: SessionContext | null, module: GerencialBiModule): void {
  const scope = resolveGerencialBiScope(session);

  if (scope.vendedorRestrito) {
    const key =
      module === "comissoes"
        ? BI_COMISSOES_CONFIG.filters.vendedor
        : module === "funil"
          ? BI_FUNIL_VENDAS_CONFIG.filters.vendedor
          : module === "carteira"
            ? BI_TABELAS_COMBINADAS_CONFIG.filters.vendedor
            : BI_SPRINT_VENDAS_CONFIG.filters.vendedor;
    url.searchParams.delete(key);
    url.searchParams.append(key, scope.vendedorRestrito);
  }

  if (scope.agenciaNormalizada && module === "metas") {
    const ak = BI_METAS_PERFORMANCE_CONFIG.filters.agencia;
    url.searchParams.delete(ak);
    url.searchParams.append(ak, scope.agenciaNormalizada);
  }

  if (scope.agenciaNormalizada && module === "fluxo") {
    const ak = BI_FLUXO_CONFIG.filters.agencia;
    url.searchParams.delete(ak);
    url.searchParams.append(ak, scope.agenciaNormalizada);
  }

  if (scope.agenciaNormalizada && module === "taxas") {
    const ak = BI_TAXAS_CONFIG.filters.agencia;
    url.searchParams.delete(ak);
    url.searchParams.append(ak, scope.agenciaNormalizada);
  }

  if (scope.agenciaNormalizada && module === "desempenhoAgencias") {
    url.searchParams.delete("agencia");
    url.searchParams.append("agencia", scope.agenciaNormalizada);
  }

  if (scope.agenciaNormalizada && module === "rotasOperacionais") {
    url.searchParams.delete("agencia");
    url.searchParams.append("agencia", scope.agenciaNormalizada);
  }
}
