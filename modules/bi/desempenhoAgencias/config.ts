/** Views oficiais (fase_8) — aplicar em produção com `scripts/sql/bi_desempenho_agencias_views.sql`. */
export const BI_DESEMPENHO_AGENCIAS = {
  views: {
    /** Grão por CTE + filtros de data; a API usa sempre esta relação para período/facet. */
    base: "bi.vw_desempenho_agencias_base",
    filters: "bi.vw_desempenho_agencias_filters",
    kpis: "bi.vw_desempenho_agencias_kpis",
    evolucaoMensal: "bi.vw_desempenho_agencias_evolucao_mensal",
    origem: "bi.vw_desempenho_agencias_origem",
    destino: "bi.vw_desempenho_agencias_destino",
    matriz: "bi.vw_desempenho_agencias_matriz",
    ranking: "bi.vw_desempenho_agencias_ranking",
    drill: "bi.vw_desempenho_agencias_drill",
  },
} as const;

export function defaultDesempenhoAgenciasRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - 2, 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
