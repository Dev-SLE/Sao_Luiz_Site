export type GlobalSearchGroup = {
  type: string;
  label: string;
  items: { id: string; title: string; subtitle?: string; href?: string }[];
};
