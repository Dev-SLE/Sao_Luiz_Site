import { NextResponse } from "next/server";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import { formatDateTime } from "../../../../lib/server/datetime";

export const runtime = "nodejs";

type TimelineItem = {
  id: string;
  source: "NOTA" | "EVENTO_MANUAL" | "PROCESS_CONTROL";
  kind: string;
  time: string;
  _timeMs?: number;
  user?: string | null;
  option?: string | null;
  observation?: string | null;
  bus_name?: string | null;
  stop_name?: string | null;
  location_text?: string | null;
  photos?: string[];
};

function parsePhotos(linkImagem: any): string[] {
  if (!linkImagem) return [];
  if (Array.isArray(linkImagem)) return linkImagem.map((x) => String(x)).filter(Boolean);
  const s = String(linkImagem || "");
  if (!s.trim()) return [];
  // NoteModal salva como string com separador " , "
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  try {
    await ensureOperationalTrackingTables();
    const { searchParams } = new URL(req.url);
    const cte = String(searchParams.get("cte") || "").trim();
    const serie = String(searchParams.get("serie") || "").trim();

    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });
    if (!serie) return NextResponse.json({ error: "serie obrigatório" }, { status: 400 });

    const pool = getPool();

    const itemRes = await pool.query(
      `
        SELECT
          c.cte::text AS cte,
          c.serie::text AS serie,
          c.coleta::text AS coleta,
          c.entrega::text AS entrega,
          c.destinatario::text AS destinatario,
          c.frete_pago::text AS frete_pago,
          c.valor_cte::numeric AS valor_cte,
          i.status_calculado AS status_calculado
        FROM pendencias.cte_view_index i
        JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
        WHERE i.view = 'em_busca'
          AND c.cte = $1
          AND c.serie = $2
      `,
      [cte, serie]
    );

    const itemRow = itemRes.rows?.[0];
    if (!itemRow) return NextResponse.json({ error: "CTE não encontrado na aba em_busca" }, { status: 404 });

    const [notesRes, manualRes, processRes] = await Promise.all([
      pool.query(
        `
          SELECT
            n.data AS data,
            n.usuario AS usuario,
            n.texto AS texto,
            n.status_busca AS status_busca,
            n.link_imagem AS link_imagem
          FROM pendencias.notes n
          WHERE n.cte = $1
            AND (n.serie = $2 OR ltrim(n.serie, '0') = ltrim($2, '0'))
          ORDER BY n.data DESC
          LIMIT 50
        `,
        [cte, serie]
      ),
      pool.query(
        `
          SELECT
            e.event_time AS event_time,
            e.created_by AS created_by,
            e.event_type AS event_type,
            e.option_key AS option_key,
            e.observation AS observation,
            e.bus_name AS bus_name,
            e.stop_name AS stop_name,
            e.location_text AS location_text,
            e.photos AS photos
          FROM pendencias.operacional_tracking_events e
          WHERE e.cte = $1
            AND (e.serie = $2 OR ltrim(e.serie, '0') = ltrim($2, '0'))
          ORDER BY e.event_time DESC
          LIMIT 50
        `,
        [cte, serie]
      ),
      pool.query(
        `
          SELECT
            p.data AS data,
            p.user_name AS user_name,
            p.status AS status,
            p.description AS description,
            p.link AS link
          FROM pendencias.process_control p
          WHERE p.cte = $1
            AND (p.serie = $2 OR ltrim(p.serie, '0') = ltrim($2, '0'))
          ORDER BY p.data DESC
          LIMIT 50
        `,
        [cte, serie]
      ),
    ]);

    const timeline: TimelineItem[] = [];

    for (const n of notesRes.rows || []) {
      const tMs = n.data ? new Date(n.data).getTime() : 0;
      timeline.push({
        id: `NOTE-${String(n.data)}-${String(n.usuario || "")}`,
        source: "NOTA",
        kind: String(n.status_busca || "NOTA"),
        time: formatDateTime(n.data),
        _timeMs: Number.isFinite(tMs) ? tMs : 0,
        user: n.usuario ? String(n.usuario) : null,
        option: n.status_busca ? String(n.status_busca) : null,
        observation: n.texto ? String(n.texto) : null,
        photos: parsePhotos(n.link_imagem),
      });
    }

    for (const e of manualRes.rows || []) {
      const tMs = e.event_time ? new Date(e.event_time).getTime() : 0;
      timeline.push({
        id: `MANUAL-${String(e.event_time)}-${String(e.created_by || "")}`,
        source: "EVENTO_MANUAL",
        kind: String(e.event_type || "MANUAL"),
        time: formatDateTime(e.event_time),
        _timeMs: Number.isFinite(tMs) ? tMs : 0,
        user: e.created_by ? String(e.created_by) : null,
        option: e.option_key ? String(e.option_key) : null,
        observation: e.observation ? String(e.observation) : null,
        bus_name: e.bus_name ? String(e.bus_name) : null,
        stop_name: e.stop_name ? String(e.stop_name) : null,
        location_text: e.location_text ? String(e.location_text) : null,
        photos: Array.isArray(e.photos) ? e.photos.map((x: any) => String(x)) : [],
      });
    }

    for (const p of processRes.rows || []) {
      const tMs = p.data ? new Date(p.data).getTime() : 0;
      timeline.push({
        id: `PROC-${String(p.data)}-${String(p.user_name || "")}`,
        source: "PROCESS_CONTROL",
        kind: String(p.status || "PROCESS"),
        time: formatDateTime(p.data),
        _timeMs: Number.isFinite(tMs) ? tMs : 0,
        user: p.user_name ? String(p.user_name) : null,
        option: p.status ? String(p.status) : null,
        observation: p.description ? String(p.description) : null,
        photos: p.link ? parsePhotos(p.link) : [],
      });
    }

    // Ordena por timestamp real (não pela string formatada).
    timeline.sort((a, b) => (b._timeMs || 0) - (a._timeMs || 0));

    // Remove campo interno de ordenação do payload.
    const timelineOut = timeline.map(({ _timeMs: _ignore, ...rest }) => rest as TimelineItem);

    // Stops derived from manual events (paradas registradas)
    const stops = (manualRes.rows || [])
      .filter((e: any) => e.stop_name != null && String(e.stop_name).trim() !== "")
      .map((e: any) => ({
        stop_name: String(e.stop_name),
        bus_name: e.bus_name ? String(e.bus_name) : null,
        location_text: e.location_text ? String(e.location_text) : null,
        at: formatDateTime(e.event_time),
      }));

    const item = {
      CTE: itemRow.cte,
      SERIE: itemRow.serie,
      COLETA: itemRow.coleta || "",
      ENTREGA: itemRow.entrega || "",
      DESTINATARIO: itemRow.destinatario || "",
      FRETE_PAGO: itemRow.frete_pago || "",
      VALOR_CTE: itemRow.valor_cte != null ? String(itemRow.valor_cte) : "",
      STATUS_CALCULADO: itemRow.status_calculado || "",
    };

    return NextResponse.json({ item, timeline: timelineOut, stops });
  } catch (error) {
    console.error("OperationalTracking item GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

