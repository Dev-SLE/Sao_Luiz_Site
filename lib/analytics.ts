/**
 * Convenção transacional vs analítico (fase_1.md).
 * Leituras de BI e painéis gerenciais devem preferir views/schemas analíticos,
 * nunca escrever diretamente em tabelas derivadas.
 */
export const ANALYTICS_SCHEMA = 'pendencias_analytics';

/** Prefixo sugerido para views materializadas / agregações (criação gradual nas fases 5–6). */
export const ANALYTICS_VIEW_PREFIX = 'vw_sle_';
