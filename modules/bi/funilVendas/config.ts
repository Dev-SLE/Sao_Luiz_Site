/**
 * BI Performance de Vendas — funil (schema `bi`, Neon).
 * Nomes de views ficam só aqui; a UI usa rótulos executivos.
 */

export const BI_FUNIL_VENDAS_CONFIG = {
  dateColumn: "data_referencia",
  filters: {
    statusFunil: "status_funil",
    vendedor: "vendedor",
    /** Filtro textual (ILIKE) na query string — coluna física `cot_id_pesquisa_sistema`. */
    cotIdPesquisaSistema: "cot_id_pesquisa_sistema",
    /** Filtro textual (ILIKE) — coluna `cte_serie`. */
    cteSerie: "cte_serie",
    /** Filtro textual (ILIKE) — coluna `cte_numero`. */
    cteNumero: "cte_numero",
  },
  /** Coluna física na base analítica para `status_funil` na query string. */
  baseStatusColumn: "status_funil_padronizado",
  views: {
    base: "bi.vw_funil_vendas_base",
    filters: "bi.vw_funil_vendas_filters",
    kpis: "bi.vw_funil_vendas_kpis",
    funilStatus: "bi.vw_funil_vendas_funil_status",
    conversaoVendedor: "bi.vw_funil_vendas_conversao_vendedor",
    valorFechadoVendedor: "bi.vw_funil_vendas_valor_fechado_vendedor",
    qtdFechadaVendedor: "bi.vw_funil_vendas_quantidade_fechada_vendedor",
    tabela: "bi.vw_funil_vendas_tabela",
    drillVendedor: "bi.vw_funil_vendas_drill_vendedor",
    evolucaoMensal: "bi.vw_funil_vendas_evolucao_mensal",
  },
} as const;

/** KPIs exibidos na primeira linha (chaves = aliases do SELECT server-side). */
export const FUNIL_KPI_SLOTS_PRIMARY = [
  { key: "qtd_cotacoes_totais", label: "Qtd. cotações totais", format: "integer" as const },
  { key: "em_negociacao", label: "Em negociação", format: "integer" as const },
  { key: "qtd_vendas_fechadas", label: "Qtd. vendas fechadas", format: "integer" as const },
  { key: "conversao_global", label: "% conversão global", format: "percent" as const },
] as const;

export const FUNIL_KPI_SLOTS_SECONDARY = [
  { key: "valor_cotado_total", label: "Valor cotado total", format: "currency" as const },
  { key: "valor_fechado_total", label: "Valor fechado total", format: "currency" as const },
] as const;

/** Ordem e cores do funil (etapa = texto padronizado na base). */
export const FUNIL_ETAPA_ORDER: readonly { etapa: string; color: string }[] = [
  { etapa: "EM NEGOCIACAO", color: "#b45309" },
  { etapa: "VENDA FECHADA", color: "#0f766e" },
  { etapa: "PERDIDO (EXPIRADO)", color: "#64748b" },
  { etapa: "VENDA CANCELADA", color: "#c41e3a" },
  { etapa: "OUTROS", color: "#4f46e5" },
] as const;

/** Colunas da tabela detalhada (rótulos na UI; chaves = retorno da API). */
export const FUNIL_TABELA_COLUNAS: readonly { key: string; label: string }[] = [
  { key: "cot_id_pesquisa_sistema", label: "Orçamento" },
  { key: "numero_cte", label: "N. CTE" },
  { key: "cte_serie", label: "Série CT-e" },
  { key: "data_cotacao", label: "Data da cotação" },
  { key: "cliente", label: "Cliente" },
  { key: "vendedor", label: "Vendedor" },
  { key: "nome_tabela", label: "Nome da tabela" },
  { key: "valor_cotacao", label: "Valor da cotação" },
  { key: "status", label: "Status" },
] as const;

export type FunilKpiSlotPrimary = (typeof FUNIL_KPI_SLOTS_PRIMARY)[number];
export type FunilKpiSlotSecondary = (typeof FUNIL_KPI_SLOTS_SECONDARY)[number];
