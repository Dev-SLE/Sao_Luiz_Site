/**
 * BI Metas & Performance por agência (schema `bi`, Neon).
 * Nomes de views ficam só aqui; a UI usa rótulos executivos.
 */

export const BI_METAS_PERFORMANCE_CONFIG = {
  dateColumn: "data_referencia",
  filters: {
    /** Agência oficial = coluna `coleta` na base (exposta como `agencia`). */
    agencia: "agencia",
  },
  views: {
    base: "bi.vw_metas_performance_base",
    filters: "bi.vw_metas_performance_filters",
    agenciaMes: "bi.vw_metas_performance_agencia_mes",
    metaOficial: "bi.vw_metas_performance_meta_oficial",
    tabelaBase: "bi.vw_metas_performance_tabela_base",
    calendario: "bi.dim_calendario",
  },
} as const;

export const METAS_KPI_SLOTS = [
  { key: "meta_oficial", label: "Meta oficial", format: "currency" as const },
  { key: "ja_vendido", label: "Já vendido (faturamento)", format: "currency" as const },
  { key: "previsao_fechamento", label: "Previsão de fechamento", format: "currency" as const },
  { key: "falta_vender", label: "Falta vender", format: "currency" as const },
  { key: "pct_atingimento_proj", label: "% atingimento (projetado)", format: "percent" as const },
] as const;

export const METAS_TABELA_COLUNAS = [
  { key: "agencia", label: "Agência" },
  { key: "meta_mes", label: "Meta mês (R$)" },
  { key: "realizado", label: "Realizado (R$)" },
  { key: "pct_projetado", label: "% projetado" },
  { key: "projecao_smart", label: "Projeção de fechamento" },
  { key: "faturamento_ly", label: "Faturamento (ano passado)" },
  { key: "pct_crescimento", label: "% crescimento" },
  { key: "meta_diaria", label: "Meta diária" },
] as const;
