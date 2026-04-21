/**
 * BI Carteira / Tabelas combinadas — schema `bi`, periodo em `data_referencia` (= validade na base analitica).
 */

export const BI_TABELAS_COMBINADAS_CONFIG = {
  /** Coluna de periodo (filtro obrigatorio from/to). */
  dateColumn: "data_referencia",
  baseView: "bi.vw_tabelas_combinadas_base",
  filters: {
    vendedor: "vendedor",
    statusAtual: "status_atual",
    cliente: "cliente",
  },
  tableDefaultLimit: 80,
  tableMaxLimit: 500,
  /** Limite de linhas na exportação XLSX (mesma query da tabela, sem paginação). */
  exportMaxRows: 15_000,
  topClientesLimit: 12,
} as const;

/** Colunas da tabela “Carteira detalhada” (chaves = retorno da API / SELECT). */
export const TC_CARTEIRA_TABELA_COLUNAS: readonly { key: string; label: string }[] = [
  { key: "status_atual", label: "Status" },
  { key: "proxima_acao", label: "Próxima ação" },
  { key: "dias_p_vencer", label: "Dias p/ vencer" },
  { key: "cliente", label: "Cliente" },
  { key: "tabela", label: "Tabela" },
  { key: "ultima_compra", label: "Última compra" },
  { key: "ltv_valor", label: "LTV" },
  { key: "qtd_ctes", label: "Qtd. CTEs" },
  { key: "total_volumes", label: "Volumes" },
  { key: "media_ticket", label: "Ticket médio" },
  { key: "vendedor", label: "Vendedora" },
] as const;
