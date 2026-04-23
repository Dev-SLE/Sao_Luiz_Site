export type StorageProviderName = "sharepoint";

export type PathTemplateContext = {
  year: string;
  month: string;
  entity_id?: string;
  dossier_id?: string;
  cte?: string;
  serie?: string;
  subtype?: string;
  category_slug?: string;
  content_slug?: string;
  /** CRM WhatsApp mídia: conversa + tipo + provedor (slug seguro). */
  conversation_id?: string;
  media_type?: string;
  provider_slug?: string;
};

export type StorageRuleRow = {
  id: string;
  module: string;
  entity: string;
  provider: string;
  site_name: string | null;
  library_name: string | null;
  sharepoint_site_id: string | null;
  sharepoint_drive_id: string | null;
  path_template: string;
  allowed_extensions: string | null;
  max_file_size_mb: number | null;
  visibility_scope: string;
  is_active: boolean;
};

export type FileRow = {
  id: string;
  provider_id: string;
  module: string;
  entity: string;
  entity_id: string | null;
  title: string | null;
  original_name: string;
  file_name: string;
  mime_type: string;
  file_size: string | number;
  extension: string | null;
  sharepoint_site_id: string | null;
  sharepoint_drive_id: string | null;
  sharepoint_item_id: string | null;
  sharepoint_path: string | null;
  thumbnail_path: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  is_active: boolean;
  visibility_scope: string;
  metadata_json: Record<string, unknown>;
};
