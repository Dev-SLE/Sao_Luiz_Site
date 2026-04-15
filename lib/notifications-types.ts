export type NotificationKind =
  | 'operational'
  | 'corporate'
  | 'approval'
  | 'comunicado'
  | 'gerencial'
  | 'task';

export type UnifiedNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  subtitle?: string | null;
  createdAt: string | null;
  href?: string | null;
  read?: boolean;
  /** Metadados específicos por fonte */
  meta?: Record<string, unknown>;
};
