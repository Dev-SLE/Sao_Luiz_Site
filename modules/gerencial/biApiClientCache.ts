/**
 * Cache em memória + dedupe para GET JSON do BI no cliente.
 * Evita refazer dezenas de chamadas ao voltar para um painel já visitado.
 */
export const BI_API_CLIENT_STALE_MS = 120_000;

const store = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_KEYS = 128;

function cacheKey(pathWithQuery: string): string {
  return pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
}

function trimStore(): void {
  while (store.size > MAX_KEYS) {
    let oldestAt = Infinity;
    let oldestKey = '';
    for (const [k, v] of store) {
      if (v.at < oldestAt) {
        oldestAt = v.at;
        oldestKey = k;
      }
    }
    if (oldestKey) store.delete(oldestKey);
    else break;
  }
}

function clone<T>(v: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(v);
    } catch {
      /* JSON abaixo */
    }
  }
  return JSON.parse(JSON.stringify(v)) as T;
}

async function doFetchJson(pathWithQuery: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(pathWithQuery, {
    ...init,
    credentials: 'include',
    method: 'GET',
    cache: init?.cache ?? 'default',
  });
  const j: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err =
      typeof (j as { error?: unknown })?.error === 'string'
        ? (j as { error: string }).error
        : `HTTP ${res.status}`;
    throw new Error(err);
  }
  return j;
}

/** GET JSON em `/api/bi/*` com cache + dedupe (no browser). */
export async function biGetJson<T = unknown>(pathWithQuery: string, init?: RequestInit): Promise<T> {
  if (typeof window === 'undefined') {
    return (await doFetchJson(pathWithQuery, init)) as T;
  }
  const k = cacheKey(pathWithQuery);
  if (!k.includes('/api/bi/')) {
    return (await doFetchJson(pathWithQuery, init)) as T;
  }

  const now = Date.now();
  const cached = store.get(k);
  if (cached && now - cached.at < BI_API_CLIENT_STALE_MS) {
    return clone(cached.data) as T;
  }

  let p = inflight.get(k);
  if (!p) {
    p = (async () => {
      try {
        const data = await doFetchJson(pathWithQuery, init);
        store.set(k, { at: Date.now(), data });
        trimStore();
        return data;
      } finally {
        inflight.delete(k);
      }
    })();
    inflight.set(k, p);
  }

  const data = await p;
  return clone(data) as T;
}

export type BiGetJsonSafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; data?: unknown };

/** Mesmo cache/dedupe que {@link biGetJson}, mas não lança em HTTP de erro (útil para Promise.all parcial). */
export async function biGetJsonSafe<T = unknown>(
  pathWithQuery: string,
  init?: RequestInit,
): Promise<BiGetJsonSafeResult<T>> {
  try {
    const data = await biGetJson<T>(pathWithQuery, init);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
