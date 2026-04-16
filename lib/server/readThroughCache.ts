/**
 * Cache TTL em memória (por instância Node) para leituras idempotentes.
 * Reduz round-trips ao Neon quando vários clientes / polls batem na mesma rota.
 * Não substitui Redis em cluster multi-instância; para BI em escala, avaliar Upstash Redis + invalidação.
 */

import { bumpReadThroughCacheMeter } from "./apiHitMeter";

type Entry = { expiresAt: number; value: unknown };

const store = new Map<string, Entry>();
const MAX_KEYS = 400;

function prune() {
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.expiresAt <= now) store.delete(k);
  }
  if (store.size <= MAX_KEYS) return;
  let removed = 0;
  for (const k of store.keys()) {
    store.delete(k);
    removed++;
    if (store.size <= MAX_KEYS * 0.75 || removed > 120) break;
  }
}

/** TTL padrão para agregados CRM (ms). Override: CRM_READ_CACHE_TTL_MS */
export function defaultCrmReadCacheTtlMs(): number {
  const raw = Number(process.env.CRM_READ_CACHE_TTL_MS);
  if (Number.isFinite(raw) && raw >= 500 && raw <= 120_000) return Math.floor(raw);
  return 20_000;
}

/**
 * Retorna valor em cache ou executa `fn` e armazena até expirar.
 * A chave deve incluir tudo que diferencia o resultado (ex.: query string completa).
 */
export async function readThroughCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    bumpReadThroughCacheMeter(key, true);
    return hit.value as T;
  }
  const value = await fn();
  bumpReadThroughCacheMeter(key, false);
  store.set(key, { expiresAt: now + ttlMs, value });
  prune();
  return value;
}

/** Para testes ou após mutações raras (ex.: POST em teams). */
export function invalidateReadCacheKey(key: string) {
  store.delete(key);
}

export function invalidateReadCachePrefix(prefix: string) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
