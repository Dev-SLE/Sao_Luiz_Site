import { moduleLabel } from '@/lib/workspace-routes';

export type WorkspaceModuleUx = {
  /** Legado — título completo do módulo (substituído por `pageTitle` no banner). */
  workspaceTitle: string;
  tagline: string;
  /** Faixa superior embutida (sem cartão flutuante). */
  headerBarClass: string;
  /** Legado — linha decorativa (não usada no banner atual). */
  headerUnderlineClass: string;
  /** Legado — navegação de módulo está no sidebar; abas horizontais só em vistas locais. */
  tabActiveClass: string;
  tabInactiveClass: string;
  /** Fundo da área de conteúdo sob o header */
  contentPanelClass: string;
};

const operacional: WorkspaceModuleUx = {
  workspaceTitle: 'Central Operacional',
  tagline: '',
  headerBarClass:
    'relative border-b border-border bg-transparent px-0 py-2 md:py-2.5',
  headerUnderlineClass: 'from-transparent to-transparent',
  tabActiveClass: 'bg-sl-navy text-white shadow-sm',
  tabInactiveClass: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  contentPanelClass: 'rounded-xl border border-border bg-card/90',
};

const crm: WorkspaceModuleUx = {
  workspaceTitle: 'CRM',
  tagline: '',
  headerBarClass:
    'relative border-b border-border bg-transparent px-0 py-2 md:py-2.5',
  headerUnderlineClass: 'from-transparent to-transparent',
  tabActiveClass: 'bg-sl-navy text-white shadow-sm',
  tabInactiveClass: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  contentPanelClass: 'rounded-xl border border-border bg-card/90',
};

const comercial: WorkspaceModuleUx = {
  workspaceTitle: 'Comercial',
  tagline: '',
  headerBarClass:
    'relative border-b border-border bg-transparent px-0 py-2 md:py-2.5',
  headerUnderlineClass: 'from-transparent to-transparent',
  tabActiveClass: 'bg-sl-navy text-white shadow-sm',
  tabInactiveClass: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  contentPanelClass: 'rounded-xl border border-border bg-card/90',
};

const hubDefault: WorkspaceModuleUx = {
  workspaceTitle: 'Módulo',
  tagline: '',
  headerBarClass:
    'relative border-b border-border bg-transparent px-0 py-2 md:py-2.5',
  headerUnderlineClass: 'from-transparent to-transparent',
  tabActiveClass: 'bg-sl-navy text-white shadow-sm',
  tabInactiveClass: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  contentPanelClass: 'rounded-xl border border-border bg-card/90',
};

const hubByKey: Partial<Record<string, Partial<WorkspaceModuleUx>>> = {
  financeiro: {
    tagline: 'Títulos, conciliação e fluxo de caixa',
    headerBarClass:
      'relative border-b border-border bg-transparent px-0 py-2 md:py-2.5',
  },
  patrimonio: {
    tagline: 'Ativos, rastreabilidade e responsabilidade',
    headerBarClass:
      'relative border-b border-border bg-transparent px-0 py-2 md:py-2.5',
  },
  gerencial: {
    tagline: 'Indicadores e decisão',
    headerBarClass:
      'relative border-b border-border bg-transparent px-0 py-2 md:py-2.5',
  },
  auditoria: {
    tagline: 'Trilhas, conformidade e controles',
    headerBarClass:
      'relative border-b border-border bg-transparent px-0 py-2 md:py-2.5',
  },
};

export function getWorkspaceModuleUx(moduleKey: string): WorkspaceModuleUx {
  const key = moduleKey || 'operacional';
  if (key === 'operacional') return operacional;
  if (key === 'crm') return crm;
  if (key === 'comercial') return comercial;
  const title = moduleLabel(key);
  const overrides = hubByKey[key];
  const base = { ...hubDefault, workspaceTitle: title } as WorkspaceModuleUx;
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    workspaceTitle: title,
  };
}
