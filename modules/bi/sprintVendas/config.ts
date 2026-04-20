/**
 * BI Sprint de Vendas & Incentivos (schema `bi`, Neon).
 * Nomes de views ficam só aqui; a UI usa rótulos executivos.
 */

export const BI_SPRINT_VENDAS_CONFIG = {
  /** Filtro na query string (espelha coluna lógica `vendedor`). */
  filters: {
    vendedor: "vendedor",
  },
  views: {
    mensal: "bi.vw_sprint_vendas_mensal",
    ranking: "bi.vw_sprint_vendas_ranking",
    tabela: "bi.vw_sprint_vendas_tabela",
    semanal: "bi.vw_sprint_vendas_semanal",
    calendario: "bi.vw_calendario_semana_mes_robusta",
    metaCampanha: "bi.meta_campanha_vendedor",
    filters: "bi.vw_sprint_vendas_filters",
  },
} as const;

/** Slots dos cards (chaves = aliases retornados pela API de KPIs). */
export const SPRINT_KPI_SLOTS = [
  { key: "dias_uteis_restantes", label: "Dias úteis restantes", format: "integer" as const },
  { key: "premios_totais", label: "Prêmios totais", format: "currency" as const },
  { key: "premios_ja_garantidos", label: "Prêmios já garantidos", format: "currency" as const },
  { key: "percentual_conclusao_meta", label: "% conclusão da meta", format: "percent" as const },
  { key: "meta_diaria_padrao", label: "Meta diária (padrão)", format: "currency" as const },
  { key: "alvo_diario_recuperacao", label: "Alvo diário (recuperação)", format: "currency" as const },
  { key: "meta_semana_alvo", label: "Meta da semana (alvo)", format: "currency" as const },
  { key: "gap_diario", label: "Gap diário (déficit)", format: "currency" as const },
] as const;
