/**
 * APIs administrativas existentes no monólito (referência Fase 5):
 * - Indenizações / jurídico: `/api/indemnifications`
 * - Diversas rotas em `app/api/` por domínio
 * Os módulos `modules/financeiro`, `modules/fiscal`, etc. devem consumir essas rotas gradualmente.
 */
export const FASE5_EXISTING_API_PREFIXES = ['/api/indemnifications', '/api/dossie', '/api/profiles'] as const;
