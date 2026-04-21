/**
 * BI Gestão de taxas (schema `bi`, Neon). Nomes de views só no servidor.
 */

export const BI_TAXAS_CONFIG = {
  dateColumn: "mes_referencia",
  baseView: "bi.vw_taxas_base",
  agenciaResumoView: "bi.vw_taxas_agencia_resumo",
  drillView: "bi.vw_taxas_drill_agencia",
  filtersView: "bi.vw_taxas_filters",
  tableDefaultLimit: 60,
  tableMaxLimit: 400,
  filters: {
    agencia: "agencia",
    perfilCobranca: "perfil_cobranca",
    /** Alinha a `selecao_taxas` em `bi.vw_taxas_filters` (Coleta, Entrega, …). */
    servicoExtra: "servico_extra",
  },
} as const;
