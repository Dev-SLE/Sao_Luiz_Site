/** Parseia JSONB / string JSON vinda de `pendencias.ctes` (ETL Python / SIGAI). */

export function parseJsonbArray(raw: unknown): unknown[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t || t === "[]") return [];
    try {
      const v = JSON.parse(t);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** `dd/mm/aaaa HH:mm:ss` ou só `dd/mm/aaaa` (meio-dia local). */
export function parseBrDateTimeMs(s: string): number {
  const t = String(s || "").trim();
  const full = t.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (full) {
    const [, d, mo, y, h, mi, se] = full;
    return new Date(+y, +mo - 1, +d, +h, +mi, +se).getTime();
  }
  const day = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (day) {
    const [, d, mo, y] = day;
    return new Date(+y, +mo - 1, +d, 12, 0, 0).getTime();
  }
  return 0;
}

export function normalizePlate(p: string | null | undefined): string {
  return String(p || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export type LinhaTempoSigaiRow = {
  data_evento: string;
  evento: string;
  operador: string;
};

export type VeiculoHistoricoRow = {
  data_v?: string;
  placa?: string;
  modelo?: string;
  tipo?: string;
  data_viagem?: string;
  hora_viagem?: string;
  veiculo?: string | number;
};

function rowMsViagem(r: VeiculoHistoricoRow): number {
  const datePart = String(r.data_v || r.data_viagem || "").trim();
  const timePart = String(r.hora_viagem || "12:00:00").trim();
  if (datePart.includes("/")) {
    if (timePart.match(/^\d{2}:\d{2}/)) {
      const [h, m, s] = timePart.split(":").map((x) => parseInt(x, 10) || 0);
      const base = parseBrDateTimeMs(datePart);
      if (!base) return 0;
      const d = new Date(base);
      d.setHours(h, m, s || 0, 0);
      return d.getTime();
    }
    return parseBrDateTimeMs(datePart);
  }
  return 0;
}

export function parseVeiculosHistorico(raw: unknown): VeiculoHistoricoRow[] {
  const arr = parseJsonbArray(raw);
  const rows: VeiculoHistoricoRow[] = [];
  for (const x of arr) {
    if (x && typeof x === "object") rows.push(x as VeiculoHistoricoRow);
  }
  return rows.sort((a, b) => rowMsViagem(a) - rowMsViagem(b));
}

export function parseLinhaTempoSigai(raw: unknown): LinhaTempoSigaiRow[] {
  const arr = parseJsonbArray(raw);
  const rows: LinhaTempoSigaiRow[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    rows.push({
      data_evento: String(o.data_evento ?? ""),
      evento: String(o.evento ?? ""),
      operador: String(o.operador ?? ""),
    });
  }
  return rows.sort((a, b) => parseBrDateTimeMs(a.data_evento) - parseBrDateTimeMs(b.data_evento));
}

/** Última placa conhecida no histórico de veículos (para vínculo Life). */
export function latestPlateFromVeiculosJson(raw: unknown): string | null {
  const sorted = parseVeiculosHistorico(raw);
  if (!sorted.length) return null;
  const last = sorted[sorted.length - 1];
  const p = normalizePlate(last.placa ?? null);
  return p || null;
}

/** MDF curto para coluna `operational_load_links.mdf` a partir do snapshot CT-e. */
export function mdfLabelFromCtes(mdfeNumero: string | null, mdfeSerie: string | null): string | null {
  const n = String(mdfeNumero || "").trim();
  const s = String(mdfeSerie || "").trim();
  if (!n && !s) return null;
  if (/^\d+$/.test(n) && s) return `${n}/${s}`;
  if (/^\d+$/.test(n)) return n;
  if (n.length > 120) return `${n.slice(0, 117)}...`;
  return n || null;
}
