import { NextResponse } from "next/server";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import { formatDateTime } from "../../../../lib/server/datetime";
import { parseLinhaTempoSigai, parseVeiculosHistorico } from "../../../../lib/server/ctesTrackingJson";

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
  latitude?: number | null;
  longitude?: number | null;
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
    const guard = await requireApiPermissions(req, ["VIEW_RASTREIO_OPERACIONAL", "MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
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
          c.status::text AS status_logistica,
          c.data_emissao AS data_emissao,
          c.codigo::text AS codigo,
          c.mdfe_numero::text AS mdfe_numero,
          c.mdfe_serie::text AS mdfe_serie,
          c.mdfe_chave::text AS mdfe_chave,
          c.linha_tempo_json AS linha_tempo_json,
          c.veiculos_json AS veiculos_json,
          c.updated_at AS ctes_updated_at,
          i.status_calculado AS status_calculado,
          lnk.vehicle_id AS vehicle_id,
          lnk.plate AS plate,
          lnk.mdf AS mdf,
          pos.lat AS last_lat,
          pos.lng AS last_lng,
          pos.position_at AS last_position_at
        FROM pendencias.cte_view_index i
        JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
        LEFT JOIN LATERAL (
          SELECT ll.vehicle_id, ll.plate, ll.mdf
          FROM pendencias.operational_load_links ll
          WHERE ll.cte = c.cte
            AND ll.serie = c.serie
            AND ll.ends_at IS NULL
          ORDER BY ll.starts_at DESC
          LIMIT 1
        ) lnk ON true
        LEFT JOIN LATERAL (
          SELECT p.lat, p.lng, p.position_at
          FROM pendencias.operational_vehicle_position_latest p
          WHERE p.provider = 'LIFE'
            AND (
              (lnk.plate IS NOT NULL AND p.plate = lnk.plate)
              OR (lnk.vehicle_id IS NOT NULL AND p.vehicle_id = lnk.vehicle_id)
            )
          ORDER BY p.position_at DESC
          LIMIT 1
        ) pos ON true
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
            e.latitude AS latitude,
            e.longitude AS longitude,
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
        latitude: e.latitude != null ? Number(e.latitude) : null,
        longitude: e.longitude != null ? Number(e.longitude) : null,
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
        latitude: e.latitude != null ? Number(e.latitude) : null,
        longitude: e.longitude != null ? Number(e.longitude) : null,
        at: formatDateTime(e.event_time),
      }));

    const linksRes = await pool.query(
      `
        SELECT id, cte, serie, mdf, vehicle_id, plate, starts_at, ends_at, source, changed_by, notes
        FROM pendencias.operational_load_links
        WHERE cte = $1
          AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
        ORDER BY starts_at DESC
        LIMIT 50
      `,
      [cte, serie]
    );
    const activeLink = (linksRes.rows || []).find((x: any) => !x.ends_at) || null;
    const trailRes = await pool.query(
      `
        WITH active AS (
          SELECT vehicle_id, plate, starts_at
          FROM pendencias.operational_load_links
          WHERE cte = $1
            AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
            AND ends_at IS NULL
          ORDER BY starts_at DESC
          LIMIT 1
        )
        SELECT p.lat, p.lng, p.position_at, p.vehicle_id, p.plate, p.odometer_km
        FROM pendencias.operational_vehicle_positions p
        JOIN active a ON (
          (a.plate IS NOT NULL AND p.plate = a.plate)
          OR (a.vehicle_id IS NOT NULL AND p.vehicle_id = a.vehicle_id)
        )
        ORDER BY p.position_at DESC
        LIMIT 500
      `,
      [cte, serie]
    );

    const formatEmissao = (d: any) => {
      if (!d) return "";
      const x = new Date(d);
      if (Number.isNaN(x.getTime())) return String(d);
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
    };

    const item = {
      CTE: itemRow.cte,
      SERIE: itemRow.serie,
      COLETA: itemRow.coleta || "",
      ENTREGA: itemRow.entrega || "",
      DESTINATARIO: itemRow.destinatario || "",
      FRETE_PAGO: itemRow.frete_pago || "",
      VALOR_CTE: itemRow.valor_cte != null ? String(itemRow.valor_cte) : "",
      STATUS_CALCULADO: itemRow.status_calculado || "",
      STATUS_LOGISTICA: itemRow.status_logistica ? String(itemRow.status_logistica) : "",
      DATA_EMISSAO: formatEmissao(itemRow.data_emissao),
      CODIGO: itemRow.codigo ? String(itemRow.codigo) : "",
      MDFE_NUMERO: itemRow.mdfe_numero != null ? String(itemRow.mdfe_numero) : "",
      MDFE_SERIE: itemRow.mdfe_serie != null ? String(itemRow.mdfe_serie) : "",
      MDFE_CHAVE: itemRow.mdfe_chave != null ? String(itemRow.mdfe_chave) : "",
      CTES_UPDATED_AT: itemRow.ctes_updated_at ? formatDateTime(itemRow.ctes_updated_at) : "",
      VEHICLE_ID: itemRow.vehicle_id || "",
      PLATE: itemRow.plate || "",
      MDF: itemRow.mdf || "",
      LAST_LAT: itemRow.last_lat != null ? Number(itemRow.last_lat) : null,
      LAST_LNG: itemRow.last_lng != null ? Number(itemRow.last_lng) : null,
      LAST_POSITION_AT: itemRow.last_position_at ? formatDateTime(itemRow.last_position_at) : "",
    };

    const sigaiLinhaTempo = parseLinhaTempoSigai(itemRow.linha_tempo_json);
    const veiculosHistorico = parseVeiculosHistorico(itemRow.veiculos_json);

    return NextResponse.json({
      item,
      sigaiLinhaTempo,
      veiculosHistorico,
      timeline: timelineOut,
      stops,
      activeLink,
      links: linksRes.rows || [],
      trail: (trailRes.rows || []).map((r: any) => ({
        lat: Number(r.lat),
        lng: Number(r.lng),
        at: formatDateTime(r.position_at),
        position_at: r.position_at,
        vehicle_id: r.vehicle_id || null,
        plate: r.plate || null,
        odometer_km: r.odometer_km != null ? Number(r.odometer_km) : null,
      })),
    });
  } catch (error) {
    console.error("OperationalTracking item GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

