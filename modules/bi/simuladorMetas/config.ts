/**
 * Simulador de metas vendedoras — views BI (schema `bi`).
 * Base: `vw_simulador_vendedoras_ready` (ano 2025 + dias úteis 2025/2026 + média diária).
 */
export const BI_SIMULADOR_METAS_CONFIG = {
  views: {
    ready: "bi.vw_simulador_vendedoras_ready",
    filters: "bi.vw_simulador_vendedoras_filters",
    anual: "bi.vw_simulador_vendedoras_anual",
  },
  /** Filtro opcional por tipo de comissão (não está na `ready`; cruza `tb_comissoes`). */
  comissoesTable: "tb_comissoes",
} as const;

export const SIMULADOR_METAS_DEFAULT_FROM = "2025-01-01";
export const SIMULADOR_METAS_DEFAULT_TO = "2025-12-01";
