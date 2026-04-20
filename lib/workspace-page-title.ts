import { parseWorkspacePath, moduleLabel } from '@/lib/workspace-routes';
import { CRM_TABS } from '@/modules/crm/routes';
import { COMERCIAL_TABS } from '@/modules/comercial/routes';
import { GERENCIAL_COMERCIAL_PANELS, isGerencialSectorSlug } from '@/modules/gerencial/routes';
import { OPERACIONAL_TABS, OPERACIONAL_UTILITY_TABS } from '@/modules/operacional/routes';

/** Título curto só da vista atual (barra superior embutida). */
export function getWorkspacePageTitle(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const { module, rest } = parseWorkspacePath(clean);
  const m = module ?? 'operacional';
  const r0 = (rest[0] || '').toLowerCase();

  if (m === 'operacional') {
    const util = OPERACIONAL_UTILITY_TABS.find((t) => clean.endsWith(`/operacional/${t.slug}`));
    if (util) {
      if (util.slug === 'configuracoes') return 'Configurações';
      if (util.slug === 'relatorios') return 'Relatórios';
      if (util.slug === 'sofia-config') return 'Sofia';
      if (util.slug === 'mudar-senha') return 'Alterar senha';
    }
    const slug = !r0 || r0 === 'dashboard' ? 'visao-geral' : r0;
    const tab = OPERACIONAL_TABS.find((t) => t.slug === slug);
    if (tab) return tab.label;
    return 'Operacional';
  }

  if (m === 'crm') {
    const slug = !r0 || r0 === 'dashboard' ? 'dashboard' : r0;
    const hit = CRM_TABS.find((t) => t.slug === slug);
    if (hit) return hit.label;
    return 'CRM';
  }

  if (m === 'comercial') {
    const slug = !r0 || r0 === 'auditoria' ? 'metas' : r0;
    const hit = COMERCIAL_TABS.find((t) => t.slug === slug);
    if (hit) return hit.label;
    return 'Comercial';
  }

  if (m === 'gerencial') {
    const r1 = rest[1]?.toLowerCase() ?? '';
    const r2 = rest[2]?.toLowerCase() ?? '';
    let sector = r0;
    let panel = r1;
    let extra = r2;
    if (!isGerencialSectorSlug(sector)) {
      panel = r0;
      extra = r1;
      sector = 'comercial';
    }
    if (sector === 'financeiro') return 'Financeiro (BI)';
    if (sector === 'operacao') return 'Operação (BI)';
    if (panel === 'comissoes' && extra === 'holerite') return 'Holerite de comissões';
    const hit = GERENCIAL_COMERCIAL_PANELS.find((t) => t.slug === panel);
    if (hit) return hit.label;
    if (sector === 'comercial') return 'Comercial (BI)';
    return 'Gerencial';
  }

  return moduleLabel(m);
}
