export type RotasOperacionaisFacets = {
  agencias: string[];
  cidadesDestino: string[];
  rotas: string[];
  faixasPeso: string[];
};

export type RotasOperacionaisKpis = {
  faturamento_total: number;
  ticket_medio: number;
  total_ctes: number;
  peso_total: number;
  volumes_total: number;
  peso_medio_por_cte: number;
  volumes_por_cte: number;
  faturamento_por_kg: number;
};

export type RotasRankingAgencia = {
  agencia_origem: string;
  faturamento_total: number;
  total_ctes: number;
};

export type RotasRankingCidade = {
  cidade_destino: string;
  faturamento_total: number;
  total_ctes: number;
  peso_total: number;
  volumes_total: number;
};

export type RotasMapaCidade = RotasRankingCidade;

export type RotasRankingRota = {
  rota: string;
  faturamento: number;
  ticket: number;
  volume: number;
  total_ctes: number;
};

export type RotasFaixaPeso = {
  faixa_peso: string;
  total_ctes: number;
  faturamento_total: number;
  peso_total: number;
};

export type RotasHierarquiaNode = {
  id: string;
  parentId: string | null;
  nivel: 1 | 2 | 3;
  agencia_origem: string;
  cidade_destino: string | null;
  rota: string | null;
  faturamento_total: number;
  peso_total: number;
  ticket_medio: number;
  total_ctes: number;
  volumes_total: number;
  faixa_peso: string | null;
};

export type RotasOperacionaisDataset = {
  kpis: RotasOperacionaisKpis;
  rankingAgencias: RotasRankingAgencia[];
  rankingCidades: RotasRankingCidade[];
  mapaCidades: RotasMapaCidade[];
  rankingRotas: RotasRankingRota[];
  faixaPeso: RotasFaixaPeso[];
  hierarchy: RotasHierarquiaNode[];
};

export type RotasDrillSummary = {
  agencia_origem: string;
  cidade_destino: string;
  rota: string;
  faixa_peso_predominante: string | null;
  faturamento_total: number;
  peso_total: number;
  volumes_total: number;
  total_ctes: number;
  ticket_medio: number;
  faturamento_por_kg: number;
};

export type RotasOperacionaisDrill = {
  summary: RotasDrillSummary | null;
  lines: Record<string, unknown>[];
};
