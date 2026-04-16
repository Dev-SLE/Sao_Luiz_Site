import { Page } from '@/types';

export type ComercialTab = {
  slug: string;
  label: string;
  page: Page;
  /** Permissão exigida para ver a aba no menu e a rota. */
  permission: string;
};

export const COMERCIAL_TABS: ComercialTab[] = [
  { slug: 'metas', label: 'Metas e auditoria', page: Page.COMERCIAL_AUDITORIA, permission: 'VIEW_COMERCIAL_AUDITORIA' },
  {
    slug: 'robo-supremo',
    label: 'Robô Supremo',
    page: Page.COMERCIAL_ROBO_SUPREMO,
    permission: 'VIEW_COMERCIAL_ROBO_SUPREMO',
  },
];

export function comercialPath(slug: string) {
  return `/app/comercial/${slug}`;
}
