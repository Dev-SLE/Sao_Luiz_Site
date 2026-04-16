import { NextResponse } from "next/server";
import { requireApiPermissions, verifyCronSecret } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import { fetchLifeTrackingRows } from "../../../../lib/server/lifeTracking";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      const guard = await requireApiPermissions(req, ["MANAGE_RASTREIO_OPERACIONAL"]);
      if (guard.denied) return guard.denied;
    }

    await ensureOperationalTrackingTables();
    const pool = getPool();
    const rows = await fetchLifeTrackingRows();
    let inserted = 0;
    let latestUpserts = 0;

    for (const r of rows) {
      await pool.query(
        `
          INSERT INTO pendencias.operational_vehicle_positions (
            provider, vehicle_id, plate, lat, lng, speed, heading, ignition, odometer_km, position_at, received_at, raw_payload
          )
          VALUES ('LIFE', $1, $2, $3, $4, NULL, NULL, NULL, $5, $6, NOW(), $7::jsonb)
          ON CONFLICT DO NOTHING
        `,
        [
          r.vehicleId,
          r.plate,
          r.lat,
          r.lng,
          r.odometerKm,
          r.positionAt,
          JSON.stringify({
            ...r.raw,
            area: r.area,
            subArea: r.subArea,
          }),
        ]
      );
      inserted += 1;

      const plateForKey = r.plate || `VEHICLE:${String(r.vehicleId || "DESCONHECIDO")}`;
      await pool.query(
        `
          INSERT INTO pendencias.operational_vehicle_position_latest (
            provider, vehicle_id, plate, lat, lng, speed, heading, ignition, odometer_km, position_at, received_at, raw_payload, updated_at
          )
          VALUES ('LIFE', $1, $2, $3, $4, NULL, NULL, NULL, $5, $6, NOW(), $7::jsonb, NOW())
          ON CONFLICT (provider, plate)
          DO UPDATE SET
            vehicle_id = EXCLUDED.vehicle_id,
            lat = EXCLUDED.lat,
            lng = EXCLUDED.lng,
            speed = EXCLUDED.speed,
            heading = EXCLUDED.heading,
            ignition = EXCLUDED.ignition,
            odometer_km = EXCLUDED.odometer_km,
            position_at = EXCLUDED.position_at,
            received_at = EXCLUDED.received_at,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
          WHERE pendencias.operational_vehicle_position_latest.position_at <= EXCLUDED.position_at
        `,
        [
          r.vehicleId,
          plateForKey,
          r.lat,
          r.lng,
          r.odometerKm,
          r.positionAt,
          JSON.stringify({
            ...r.raw,
            area: r.area,
            subArea: r.subArea,
          }),
        ]
      );
      latestUpserts += 1;
    }

    return NextResponse.json({ success: true, fetched: rows.length, inserted, latestUpserts });
  } catch (error) {
    console.error("OperationalTracking sync POST error:", error);
    return NextResponse.json({ error: "Erro ao sincronizar rastreio Life" }, { status: 500 });
  }
}

