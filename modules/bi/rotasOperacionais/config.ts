/** Faixas de peso (alinhadas à `view_bi_tela2_rotas` / malha). */
export const ROTAS_FAIXAS_PESO = [
  "1. Até 10 kg",
  "2. 11 a 30 kg",
  "3. 31 a 50 kg",
  "4. 51 a 100 kg",
  "5. Acima de 100 kg",
] as const;

export function defaultRotasOperacionaisRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - 2, 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/** Nomes oficiais das views (fase_8) — a API usa `tb_nf_saidas_consolidada` direto por compatibilidade de ambiente. */
export const BI_ROTAS_OPERACIONAIS_VIEWS = {
  base: "bi.vw_rotas_operacionais_base",
  filters: "bi.vw_rotas_operacionais_filters",
  kpis: "bi.vw_rotas_operacionais_kpis",
  evolucaoMensal: "bi.vw_rotas_operacionais_evolucao_mensal",
  agencia: "bi.vw_rotas_operacionais_agencia",
  destino: "bi.vw_rotas_operacionais_destino",
  rota: "bi.vw_rotas_operacionais_rota",
  mapa: "bi.vw_rotas_operacionais_mapa",
  hierarquia: "bi.vw_rotas_operacionais_hierarquia",
  drill: "bi.vw_rotas_operacionais_drill",
} as const;
