import { NextResponse } from "next/server";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import { formatDateTime } from "../../../../lib/server/datetime";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["VIEW_RASTREIO_OPERACIONAL", "MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;
    await ensureOperationalTrackingTables();

    const { searchParams } = new URL(req.url);
    const originKey = String(searchParams.get("origin_key") || "").trim().toUpperCase();
    const destKey = String(searchParams.get("dest_key") || "").trim().toUpperCase();

    if (!originKey || !destKey) {
      return NextResponse.json({ error: "Informe origin_key e dest_key" }, { status: 400 });
    }

    const pool = getPool();

    const [statsRes, polyRes, oStop, dStop] = await Promise.all([
      pool.query(
        `
          SELECT origin_key, dest_key, trip_count, duration_p50_minutes, duration_p90_minutes, last_sample_days, computed_at
          FROM pendencias.operational_route_od_stats
          WHERE origin_key = $1 AND dest_key = $2
        `,
        [originKey, destKey]
      ),
      pool.query(
        `
          SELECT seq, lat, lng
          FROM pendencias.operational_route_od_polyline
          WHERE origin_key = $1 AND dest_key = $2
          ORDER BY seq ASC
        `,
        [originKey, destKey]
      ),
      pool.query(`SELECT stop_key, label, lat, lng FROM pendencias.operational_stop_reference WHERE stop_key = $1`, [
        originKey,
      ]),
      pool.query(`SELECT stop_key, label, lat, lng FROM pendencias.operational_stop_reference WHERE stop_key = $1`, [
        destKey,
      ]),
    ]);

    const stats = statsRes.rows?.[0] || null;
    const polyline = (polyRes.rows || []).map((r: any) => ({
      seq: Number(r.seq),
      lat: Number(r.lat),
      lng: Number(r.lng),
    }));

    return NextResponse.json({
      origin_key: originKey,
      dest_key: destKey,
      originStop: oStop.rows?.[0] || null,
      destStop: dStop.rows?.[0] || null,
      stats: stats
        ? {
            trip_count: Number(stats.trip_count),
            duration_p50_minutes: Number(stats.duration_p50_minutes),
            duration_p90_minutes: Number(stats.duration_p90_minutes),
            last_sample_days: Number(stats.last_sample_days),
            computed_at: stats.computed_at ? formatDateTime(stats.computed_at) : "",
          }
        : null,
      polyline,
    });
  } catch (error) {
    console.error("route_pattern GET error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
