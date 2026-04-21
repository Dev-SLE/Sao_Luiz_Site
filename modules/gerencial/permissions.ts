/** Gerencial BI: permissoes por setor e por aba (cliente e servidor). */
export const MODULE_KEY = "module.gerencial.view" as const;

export const GERENCIAL_BI_TAB = {
  setorComercial: "tab.gerencial.setor.comercial.view",
  setorFinanceiro: "tab.gerencial.setor.financeiro.view",
  setorOperacao: "tab.gerencial.setor.operacao.view",
  comissoes: "tab.gerencial.comissoes.view",
  funil: "tab.gerencial.funil.view",
  sprint: "tab.gerencial.sprint.view",
  metas: "tab.gerencial.metas.view",
  carteiraRenovacao: "tab.gerencial.carteira_renovacao.view",
  /** Monitor de fluxo logistico (setor Operacao). */
  fluxoMonitor: "tab.gerencial.fluxo.view",
  /** Gestao de taxas / servicos extras (setor Operacao). */
  taxasGerencial: "tab.gerencial.taxas.view",
  /** Comercial 360: cinco telas com permissoes independentes. */
  comercial360Cockpit: "tab.gerencial.360.cockpit.view",
  comercial360Executiva: "tab.gerencial.360.executiva.view",
  comercial360Risco: "tab.gerencial.360.risco.view",
  comercial360Gap: "tab.gerencial.360.gap.view",
  comercial360Radar: "tab.gerencial.360.radar.view",
} as const;
