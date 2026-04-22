export type DesempenhoAgenciasFacets = {
  agencias: string[];
  rotas: string[];
  tiposFrete: string[];
};

export type DesempenhoAgenciasKpis = {
  total_ctes: number;
  total_volumes: number;
  qtd_coletas: number;
  qtd_entregas: number;
  peso_total: number;
  faturamento_total: number;
  volumes_por_cte: number;
  ticket_por_cte: number;
  pct_coleta: number;
  pct_entrega: number;
  pct_manifesto: number;
};

export type DesempenhoAgenciasTableRow = {
  agencia: string;
  total_ctes_origem: number;
  total_ctes_destino: number;
  total_volumes_origem: number;
  total_volumes_destino: number;
  peso_total_origem: number;
  faturamento_origem: number;
  qtd_coletas: number;
  qtd_entregas: number;
  qtd_manifestos: number;
  saldo_ctes: number;
  saldo_volumes: number;
  volumes_por_cte: number;
  peso_por_cte: number;
  ticket_por_cte: number;
};

export type DesempenhoAgenciasDataset = {
  kpis: DesempenhoAgenciasKpis;
  evolucaoMensal: {
    mes_referencia: string;
    total_ctes: number;
    total_volumes: number;
    peso_total: number;
    faturamento_total: number;
  }[];
  ranking: { agencia: string; total_ctes_origem: number; total_volumes_origem: number; faturamento_origem: number }[];
  coletasEntregas: { agencia: string; qtd_coletas: number; qtd_entregas: number }[];
  saldoMalha: { agencia: string; saldo_ctes: number; saldo_volumes: number }[];
  produtividade: { agencia: string; volumes_por_cte: number; peso_por_cte: number; ticket_por_cte: number }[];
  table: DesempenhoAgenciasTableRow[];
};

export type DesempenhoAgenciasDrill = {
  summary: DesempenhoAgenciasTableRow | null;
  lines: Record<string, unknown>[];
};
