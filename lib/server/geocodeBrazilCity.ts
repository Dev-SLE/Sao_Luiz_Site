/**
 * Geocodificação por nome de cidade (Brasil) para mapas operacionais.
 * Photon (Komoot) + fallback Nominatim (OSM). Só cacheia acertos — nunca
 * cachear `null` (evita mapa vazio durante dias após uma falha transitória).
 */

const CACHE_HIT = new Map<string, { lat: number; lng: number }>();
const CACHE_HIT_META = new Map<string, number>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias — só entradas com coordenadas

/** Nominatim exige ≥1 pedido/segundo e User-Agent identificável. */
let lastNominatimMs = 0;

function cacheKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isFreshHit(key: string): boolean {
  const t = CACHE_HIT_META.get(key);
  if (t == null) return false;
  return Date.now() - t < CACHE_TTL_MS;
}

/** Gera textos de pesquisa a partir do valor vindo da base (muitas vezes "CIDADE/UF", "X - Y", etc.). */
/** "SAO PAULO" / "CURITIBA" (malha em caps) → "Sao Paulo", "Curitiba" para o geocoder. */
function titleFromAllCapsWords(s: string): string | null {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 3) return null;
  const words = t.split(/\s+/);
  const ok =
    words.every((w) => /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ.]+$/.test(w) && w.replace(/\./g, "").length >= 2) &&
    words.some((w) => w.replace(/\./g, "").length >= 4);
  if (!ok) return null;
  return words.map((w) => w.charAt(0) + w.slice(1).toLowerCase().replace(/\./g, "")).join(" ");
}

function citySearchVariants(raw: string): string[] {
  const t = raw.replace(/\s+/g, " ").trim();
  const out: string[] = [];
  const add = (s: string) => {
    const x = s.replace(/\s+/g, " ").trim();
    if (x.length >= 2 && !out.includes(x)) out.push(x);
  };
  if (!t) return [];
  add(t);
  // "CURITIBA / PR" ou "Maringá/PR"
  const slash = t.split(/\s*\/\s*/)[0]?.trim();
  if (slash && slash !== t) add(slash);
  // "São Paulo - SP" → tentar só a parte antes do hífen
  const dash = t.split(/\s*-\s*/)[0]?.trim();
  if (dash && dash !== t) add(dash);
  // Último segmento após vírgula (ex.: "BR, Curitiba")
  const parts = t.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const longest = [...parts].sort((a, b) => b.length - a.length)[0];
    if (longest && longest !== t) add(longest);
  }
  // Base muitas vezes grava MUNICÍPIO EM MAIÚSCULAS
  const pretty = titleFromAllCapsWords(t);
  if (pretty) add(pretty);
  if (slash) {
    const prettySlash = titleFromAllCapsWords(slash);
    if (prettySlash) add(prettySlash);
  }
  if (dash) {
    const prettyDash = titleFromAllCapsWords(dash);
    if (prettyDash) add(prettyDash);
  }
  return out;
}

async function geocodePhotonSingle(search: string): Promise<{ lat: number; lng: number } | null> {
  const tries = [`${search}, Brasil`, `${search}, Brazil`, search];
  for (const q of tries) {
    const url = `https://photon.komoot.io/api?q=${encodeURIComponent(q)}&limit=1`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12_000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "SaoLuizExpress-RotasBI/1.0 (https://github.com/sao-luiz-express)",
        },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        features?: Array<{ geometry?: { type?: string; coordinates?: number[] } }>;
      };
      const c0 = data.features?.[0]?.geometry?.coordinates;
      if (!c0 || c0.length < 2) continue;
      const [lng, lat] = c0 as [number, number];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      return { lat, lng };
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function waitNominatimSlot(): Promise<void> {
  const minGap = 1100;
  const now = Date.now();
  const wait = minGap - (now - lastNominatimMs);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimMs = Date.now();
}

async function geocodeNominatimSingle(search: string): Promise<{ lat: number; lng: number } | null> {
  await waitNominatimSlot();
  const q = `${search}, Brazil`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 14_000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "SaoLuizExpress-RotasBI/1.0 (rotas-operacionais; contacto via suporte interno)",
      },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    if (!Array.isArray(arr) || !arr[0]) return null;
    const lat = parseFloat(String(arr[0].lat ?? ""));
    const lon = parseFloat(String(arr[0].lon ?? ""));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lng: lon };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveOneLabel(label: string): Promise<{ lat: number; lng: number } | null> {
  const variants = citySearchVariants(label);
  for (const v of variants) {
    const hit = await geocodePhotonSingle(v);
    if (hit) return hit;
  }
  for (const v of variants) {
    const hit = await geocodeNominatimSingle(v);
    if (hit) return hit;
  }
  return null;
}

/** Uma cidade; devolve null se não encontrar. Não grava cache em falhas. */
export async function geocodeBrazilCityName(raw: string): Promise<{ lat: number; lng: number } | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = cacheKey(trimmed);
  if (CACHE_HIT.has(key) && isFreshHit(key)) {
    return CACHE_HIT.get(key)!;
  }
  const hit = await resolveOneLabel(trimmed);
  if (hit) {
    CACHE_HIT.set(key, hit);
    CACHE_HIT_META.set(key, Date.now());
  }
  return hit;
}

const BATCH_GAP_MS = 220;

/**
 * Resolve várias cidades (deduplicadas). Chaves de saída = nome original pedido.
 * Intervalo entre rótulos para respeitar Nominatim quando o fallback for usado.
 */
export async function geocodeBrazilCityNamesStable(
  names: string[],
  opts?: { max?: number },
): Promise<Record<string, { lat: number; lng: number } | null>> {
  const max = Math.min(opts?.max ?? 48, 60);
  const ordered = names.map((n) => n.trim()).filter(Boolean);
  const unique = [...new Set(ordered.map((n) => n))].slice(0, max);
  const out: Record<string, { lat: number; lng: number } | null> = {};
  for (let i = 0; i < unique.length; i++) {
    const name = unique[i];
    if (i > 0) await new Promise((r) => setTimeout(r, BATCH_GAP_MS));
    out[name] = await geocodeBrazilCityName(name);
  }
  return out;
}
