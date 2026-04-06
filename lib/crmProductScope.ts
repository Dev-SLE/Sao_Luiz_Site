/**
 * Escopo comercial do CRM: o funil exposto na UI é operacional (rastreio/logística).
 * Pipeline de vendas clássico (valor, probabilidade, forecast) permanece fora do produto
 * até decisão explícita de produto.
 */
export const CRM_SALES_PIPELINE_SCOPE = "operational_only" as const;
