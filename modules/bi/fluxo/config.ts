/**
 * BI Monitor de fluxo logístico (schema `bi`, Neon).
 * Nomes de views permanecem só no servidor — a UI usa rótulos executivos.
 */

export const BI_FLUXO_CONFIG = {
  /** Grão principal: agência × mês. */
  dateColumn: "mes_referencia",
  baseView: "bi.vw_fluxo_base",
  filters: {
    agencia: "agencia",
    /** Na base: `status_fluxo` (rótulo na UI: tipo da rede / tipo de fluxo). */
    tipoFluxo: "tipo_fluxo",
    /** Na base: `cluster_perfil`. */
    perfil: "perfil",
  },
  tableDefaultLimit: 60,
  tableMaxLimit: 400,
} as const;
