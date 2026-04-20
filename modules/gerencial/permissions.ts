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
} as const;
