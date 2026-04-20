/**
 * Fase 6 — Gerencial / BI / Auditoria: consumir `pendencias.audit_log`, views analíticas (`lib/analytics.ts`)
 * e agregar dados read-only a partir do schema transacional.
 * BI comissões (fase_1_bi): schema `bi` via COMERCIAL_DATABASE_URL — `/app/gerencial/comercial/comissoes`.
 */
export const FASE6_ENTRY_ROUTES = ['/app/gerencial', '/app/gerencial/comercial/comissoes', '/app/auditoria'] as const;
