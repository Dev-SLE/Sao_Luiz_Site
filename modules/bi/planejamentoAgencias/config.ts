/**
 * Planejamento estratégico por agência — views `bi` (alinhado a `vw_planejamento_agencias_ready`).
 * Ano base da curva = 2025; dias úteis “meta” e série atual seguem o calendário definido no BI (2026).
 */
export const BI_PLANEJAMENTO_AGENCIAS_CONFIG = {
  views: {
    ready: "bi.vw_planejamento_agencias_ready",
    mensal: "bi.vw_planejamento_agencias_mensal",
    filters: "bi.vw_planejamento_agencias_filters",
    anual: "bi.vw_planejamento_agencias_anual",
  },
  /** Ano das linhas em `ready` (faturamento referência / média diária). */
  anoBase: 2025,
  /** Ano usado em `dias_uteis_ano_meta` na view `ready` (schema atual). */
  anoMetaDias: 2026,
  /** Ano do faturamento “realizado atual” em `vw_planejamento_agencias_mensal` (deve refletir o BI em produção). */
  anoRealizadoAtual: 2026,
} as const;

export const PLANEJAMENTO_DEFAULT_FROM = "2025-01-01";
export const PLANEJAMENTO_DEFAULT_TO = "2025-12-01";
