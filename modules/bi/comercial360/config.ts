/**
 * BI Comercial 360 — schema `bi` (Neon). Nomes de views só no servidor.
 */

export const BI_COMERCIAL_360_CONFIG = {
  baseView: "bi.vw_360_base",
  oportunidadesView: "bi.vw_360_oportunidades",
  drillView: "bi.vw_360_drill_cliente",
  filtersView: "bi.vw_360_filters",
  tableDefaultLimit: 60,
  tableMaxLimit: 200,
  filters: {
    mensalista: "mensalista",
    temContrato: "tem_contrato",
    cidadeUf: "cidade",
    statusAtividade: "status_atividade",
    categoria: "categoria",
    tipoDocumento: "tipo_documento",
    atuouTomador: "atuou_tomador",
    atuouRemetente: "atuou_remetente",
    atuouDestinatario: "atuou_destinatario",
  },
} as const;
