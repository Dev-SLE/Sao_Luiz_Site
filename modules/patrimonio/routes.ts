import { Page } from '@/types';

export type PatrimonioTab = {
  slug: string;
  label: string;
  permission: string;
};

/** Abas internas do módulo Patrimônio (`/app/patrimonio/{slug}`). */
export const PATRIMONIO_TABS: PatrimonioTab[] = [
  { slug: 'ativos', label: 'Ativos', permission: 'module.patrimonio.view' },
  { slug: 'movimentacoes', label: 'Movimentações', permission: 'module.patrimonio.view' },
  { slug: 'manutencoes', label: 'Manutenções', permission: 'module.patrimonio.view' },
  { slug: 'baixas', label: 'Baixas', permission: 'module.patrimonio.view' },
  { slug: 'conferencia', label: 'Conferência', permission: 'module.patrimonio.view' },
  { slug: 'configuracoes', label: 'Configurações', permission: 'module.patrimonio.view' },
];

export function patrimonioPath(slug: string) {
  return `/app/patrimonio/${slug}`;
}

export function patrimonioSlugFromPathname(pathname: string): string {
  const p = pathname.replace(/\/+$/, '') || '/';
  const parts = p.split('/').filter(Boolean);
  if (parts[0] !== 'app' || parts[1] !== 'patrimonio') return 'ativos';
  const slug = (parts[2] || 'ativos').toLowerCase();
  const known = new Set(PATRIMONIO_TABS.map((t) => t.slug));
  return known.has(slug) ? slug : 'ativos';
}

export function patrimonioPageFromPath(pathname: string): Page {
  return Page.MODULE_PATRIMONIO;
}
