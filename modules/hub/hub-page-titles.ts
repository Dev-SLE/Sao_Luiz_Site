import { Page } from '@/types';

export const HUB_PAGE_TITLES: Partial<Record<Page, string>> = {
  [Page.MODULE_MANIFESTOS]: 'Manifestos e CTEs',
  [Page.MODULE_CLIENTES]: 'Clientes e tabelas de preço',
  [Page.MODULE_PATRIMONIO]: 'Patrimônio',
  [Page.MODULE_FINANCEIRO]: 'Financeiro',
  [Page.MODULE_FISCAL]: 'Fiscal',
  [Page.MODULE_RH]: 'DP / RH',
  [Page.MODULE_COMPRAS]: 'Compras e suprimentos',
  [Page.MODULE_JURIDICO]: 'Jurídico / Compliance',
  [Page.MODULE_GERENCIAL]: 'Gerencial',
  [Page.GERENCIAL_COMISSOES_BI]: 'Comissões (BI)',
  [Page.GERENCIAL_COMISSOES_HOLERITE]: 'Holerite de comissões',
  [Page.MODULE_AUDITORIA_APP]: 'Auditoria e controle',
};
