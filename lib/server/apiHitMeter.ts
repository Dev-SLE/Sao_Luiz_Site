/**
 * Contadores em memória (por processo Node) para estimar pressão por rota / família de cache.
 * Desative com API_ROUTE_METER=0. Útil para decidir próximos TTLs ou materialized views.
 */

type CacheStat = { hits: number; misses: number };

const routeHits = new Map<string, number>();
const readThroughStats = new Map<string, CacheStat>();

function enabled() {
  return process.env.API_ROUTE_METER !== "0";
}

/** Incrementa contador de uma rota lógica (ex.: GET /api/crm/board). */
export function bumpApiRoute(routeLabel: string) {
  if (!enabled()) return;
  routeHits.set(routeLabel, (routeHits.get(routeLabel) || 0) + 1);
}

/** Registra hit/miss do readThroughCache (família = primeiros segmentos da chave). */
export function bumpReadThroughCacheMeter(cacheKey: string, hit: boolean) {
  if (!enabled()) return;
  const family = cacheKey.split(":").slice(0, 3).join(":") || cacheKey;
  const cur = readThroughStats.get(family) || { hits: 0, misses: 0 };
  if (hit) cur.hits += 1;
  else cur.misses += 1;
  readThroughStats.set(family, cur);
}

export function getApiRouteMeterSnapshot(routeLimit = 40, cacheLimit = 40) {
  const routes = [...routeHits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, routeLimit)
    .map(([route, hits]) => ({ route, hits }));

  const readThroughCache = [...readThroughStats.entries()]
    .map(([family, v]) => ({
      family,
      hits: v.hits,
      misses: v.misses,
      total: v.hits + v.misses,
      hitRatePct: v.hits + v.misses > 0 ? Math.round((v.hits / (v.hits + v.misses)) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, cacheLimit);

  return {
    note: "Contadores desde o último cold start deste processo. Em serverless há um mapa por instância.",
    routes,
    readThroughCache,
  };
}

export function resetApiRouteMeter() {
  routeHits.clear();
  readThroughStats.clear();
}
