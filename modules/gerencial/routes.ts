import { GERENCIAL_BI_TAB } from '@/modules/gerencial/permissions';

export type GerencialSectorSlug = 'comercial' | 'financeiro' | 'operacao';

export type GerencialSectorDef = {
  slug: GerencialSectorSlug;
  label: string;
  permission: string;
};

export const GERENCIAL_SECTORS: GerencialSectorDef[] = [
  { slug: 'comercial', label: 'Comercial', permission: GERENCIAL_BI_TAB.setorComercial },
  { slug: 'financeiro', label: 'Financeiro', permission: GERENCIAL_BI_TAB.setorFinanceiro },
  { slug: 'operacao', label: 'Operação', permission: GERENCIAL_BI_TAB.setorOperacao },
];

export type GerencialComercialPanelDef = {
  slug: string;
  label: string;
  permission: string;
};

/** Abas do setor Financeiro (BI). */
export const GERENCIAL_FINANCEIRO_PANELS: GerencialComercialPanelDef[] = [
  { slug: 'bi-inicial', label: 'Financeiro Inicial', permission: GERENCIAL_BI_TAB.setorFinanceiro },
  {
    slug: 'tesouraria-fluxo',
    label: 'Tesouraria e Fluxo de Caixa',
    permission: GERENCIAL_BI_TAB.setorFinanceiro,
  },
];

/** Abas internas do setor Operação (BI logístico). */
export const GERENCIAL_OPERACAO_PANELS: GerencialComercialPanelDef[] = [
  {
    slug: 'visao-geral-operacional',
    label: 'Visão geral operacional',
    permission: GERENCIAL_BI_TAB.setorOperacao,
  },
  { slug: 'monitor-fluxo', label: 'Monitor de fluxo', permission: GERENCIAL_BI_TAB.fluxoMonitor },
  { slug: 'gestao-taxas', label: 'Gestão de taxas', permission: GERENCIAL_BI_TAB.taxasGerencial },
  {
    slug: 'desempenho-agencias',
    label: 'Desempenho agências',
    /** Quem entra no setor Operação (BI) vê o painel; o detalhe continua filtrado por permissões do hub. */
    permission: GERENCIAL_BI_TAB.setorOperacao,
  },
  {
    slug: 'rotas-operacionais',
    label: 'Rotas operacionais',
    permission: GERENCIAL_BI_TAB.setorOperacao,
  },
];

/** Abas internas do setor Comercial (BI já entregue). */
export const GERENCIAL_COMERCIAL_PANELS: GerencialComercialPanelDef[] = [
  { slug: 'comissoes', label: 'Comissões (BI)', permission: GERENCIAL_BI_TAB.comissoes },
  {
    slug: 'carteira-renovacao',
    label: 'Carteira & renovação',
    permission: GERENCIAL_BI_TAB.carteiraRenovacao,
  },
  { slug: 'performance-vendas', label: 'Performance de vendas', permission: GERENCIAL_BI_TAB.funil },
  { slug: 'sprint-incentivos', label: 'Sprint & incentivos', permission: GERENCIAL_BI_TAB.sprint },
  { slug: 'metas-performance', label: 'Metas & performance', permission: GERENCIAL_BI_TAB.metas },
  {
    slug: 'simulador-metas-vendedoras',
    label: 'Simulador metas vendedoras',
    permission: GERENCIAL_BI_TAB.metas,
  },
  {
    slug: 'planejamento-agencias',
    label: 'Planejamento agências',
    permission: GERENCIAL_BI_TAB.metas,
  },
  { slug: 'cockpit-comercial-360', label: 'Cockpit Comercial 360', permission: GERENCIAL_BI_TAB.comercial360Cockpit },
  { slug: 'central-360-executiva', label: 'Central 360 Executiva', permission: GERENCIAL_BI_TAB.comercial360Executiva },
  { slug: 'monitor-risco-360', label: 'Monitor de risco 360', permission: GERENCIAL_BI_TAB.comercial360Risco },
  { slug: 'potencial-gap-360', label: 'Potencial e GAP 360', permission: GERENCIAL_BI_TAB.comercial360Gap },
  { slug: 'radar-prospeccao-360', label: 'Radar de prospecção 360', permission: GERENCIAL_BI_TAB.comercial360Radar },
];

/** Caminho canônico: `/app/gerencial/{setor}` ou `/app/gerencial/{setor}/{painel}` ou `.../holerite`. */
export function gerencialHubPath(sector: string, panel?: string, extraSegment?: string) {
  const sec = String(sector || 'comercial')
    .trim()
    .toLowerCase();
  const base = `/app/gerencial/${sec}`;
  if (!panel) return base;
  const p = String(panel).trim().toLowerCase();
  if (extraSegment) return `${base}/${p}/${String(extraSegment).replace(/^\/+/, '')}`;
  return `${base}/${p}`;
}

/**
 * Compat: rotas antigas `/app/gerencial/comissoes` → comercial.
 * `slug` painel do setor Comercial (ex.: `comissoes`, `performance-vendas`).
 */
export function gerencialPath(slug?: string) {
  const s = String(slug || '')
    .trim()
    .toLowerCase();
  if (!s || s === 'visao') return gerencialHubPath('comercial');
  return gerencialHubPath('comercial', s);
}

/** Holerite de comissões — mesmo filtro da tela BI via query string. */
export function gerencialComissoesHoleritePath(query?: string) {
  const base = gerencialHubPath('comercial', 'comissoes', 'holerite');
  const q = query?.replace(/^\?/, '').trim();
  return q ? `${base}?${q}` : base;
}

/** Detecta se o primeiro segmento após `/app/gerencial` é um setor canônico. */
export function isGerencialSectorSlug(s: string): s is GerencialSectorSlug {
  return s === 'comercial' || s === 'financeiro' || s === 'operacao';
}

/** Se `seg` for painel legado (sem setor na URL), devolve `comercial`. */
export function inferSectorFromFirstSegment(seg: string): GerencialSectorSlug {
  const s = String(seg || '').toLowerCase();
  if (isGerencialSectorSlug(s)) return s;
  return 'comercial';
}
