export type PlanejamentoReadyRow = {
  agencia: string;
  agencia_normalizada: string;
  ano: number;
  mes_referencia: string;
  mes_num: number;
  mes_nome: string;
  qtd_ctes: number;
  faturamento_realizado: number;
  dias_uteis_ano_base: number;
  dias_uteis_ano_meta: number;
  media_diaria_ano_base: number;
  peso_sazonal_agencia: number;
};

export type PlanejamentoAtualRow = {
  agencia: string;
  mes_num: number;
  mes_nome: string;
  mes_referencia: string;
  qtd_ctes: number;
  faturamento_atual: number;
};
