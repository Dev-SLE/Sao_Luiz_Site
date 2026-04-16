import { NextResponse } from "next/server";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_RASTREIO_OPERACIONAL"]);
    if (guard.denied) return guard.denied;
    await ensureOperationalTrackingTables();
    const pool = getPool();

    const body = await req.json().catch(() => ({}));
    const cte = String(body?.cte || "").trim();
    const serie = String(body?.serie || "0").trim() || "0";
    const mdf = String(body?.mdf || "").trim() || null;
    const vehicleId = String(body?.vehicleId || "").trim() || null;
    const plate = String(body?.plate || "").trim().toUpperCase() || null;
    const reason = String(body?.reason || "BALDEACAO").trim();
    const notes = String(body?.notes || "").trim() || null;

    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });
    if (!vehicleId && !plate) {
      return NextResponse.json({ error: "Informe vehicleId ou plate" }, { status: 400 });
    }

    const actor = String(guard.session?.username || "Sistema");

    const prevRes = await pool.query(
      `
        SELECT * FROM pendencias.operational_load_links
        WHERE cte = $1 AND serie = $2 AND ends_at IS NULL
        ORDER BY starts_at DESC
        LIMIT 1
      `,
      [cte, serie]
    );
    const prev = prevRes.rows?.[0] || null;
    if (prev) {
      await pool.query(
        `
          UPDATE pendencias.operational_load_links
          SET ends_at = NOW(), updated_at = NOW(), changed_by = $3
          WHERE id = $1
            AND cte = $2
            AND ends_at IS NULL
        `,
        [prev.id, cte, actor]
      );
    }

    const insertRes = await pool.query(
      `
        INSERT INTO pendencias.operational_load_links (
          cte, serie, mdf, vehicle_id, plate, starts_at, source, changed_by, notes, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), 'MANUAL', $6, $7, NOW())
        RETURNING *
      `,
      [cte, serie, mdf, vehicleId, plate, actor, notes]
    );
    const link = insertRes.rows?.[0];

    await pool.query(
      `
        INSERT INTO pendencias.operacional_tracking_events (
          cte, serie, event_kind, event_type, option_key, observation, bus_name, stop_name, location_text, event_time, created_by
        )
        VALUES ($1, $2, 'MANUAL', 'ROTA', 'MUDOU_ONIBUS', $3, $4, NULL, NULL, NOW(), $5)
      `,
      [
        cte,
        serie,
        `Baldeação registrada (${reason}). Vínculo atualizado para veículo/placa atual.`,
        vehicleId || plate || "SEM_IDENTIFICADOR",
        actor,
      ]
    );

    return NextResponse.json({ success: true, previous: prev, current: link });
  } catch (error) {
    console.error("OperationalTracking link POST error:", error);
    return NextResponse.json({ error: "Erro ao vincular carga ao veículo" }, { status: 500 });
  }
}

