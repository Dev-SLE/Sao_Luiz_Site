export type CrmTab = { slug: string; label: string; permission: string };

export const CRM_TABS: CrmTab[] = [
  { slug: 'dashboard', label: 'Dashboard', permission: 'VIEW_CRM_DASHBOARD' },
  { slug: 'funil', label: 'Funil', permission: 'VIEW_CRM_FUNIL' },
  { slug: 'chat', label: 'Chat IA', permission: 'VIEW_CRM_CHAT' },
  { slug: 'tarefas', label: 'Minhas pendências', permission: 'VIEW_CRM_CHAT' },
  { slug: 'contato-360', label: 'Contato 360', permission: 'VIEW_CRM_CHAT' },
  { slug: 'relatorios', label: 'Relatórios', permission: 'VIEW_CRM_DASHBOARD' },
  { slug: 'operacao', label: 'Operação CRM', permission: 'MANAGE_CRM_OPS' },
  { slug: 'privacidade', label: 'Privacidade', permission: 'MANAGE_CRM_OPS' },
];

export function crmPath(slug: string) {
  return `/app/crm/${slug}`;
}
