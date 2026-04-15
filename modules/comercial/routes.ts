import { Page } from '@/types';

export type ComercialTab = {
  slug: string;
  label: string;
  page: Page;
};

export const COMERCIAL_TABS: ComercialTab[] = [
  { slug: 'metas', label: 'Metas e auditoria', page: Page.COMERCIAL_AUDITORIA },
  { slug: 'robo-supremo', label: 'Robô Supremo', page: Page.COMERCIAL_ROBO_SUPREMO },
];

export function comercialPath(slug: string) {
  return `/app/comercial/${slug}`;
}
