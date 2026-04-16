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
    const username = String(guard.session?.username || body?.createdBy || "Sistema");

    const cte = body?.cte != null ? String(body.cte).trim() : "";
    const serie = body?.serie != null ? String(body.serie).trim() : "";

    if (!cte) return NextResponse.json({ error: "cte obrigatório" }, { status: 400 });
    if (!serie) return NextResponse.json({ error: "serie obrigatório" }, { status: 400 });

    const eventType = body?.eventType != null ? String(body.eventType).trim() : "";
    if (!eventType) return NextResponse.json({ error: "eventType obrigatório" }, { status: 400 });

    const optionKey = body?.optionKey != null ? String(body.optionKey).trim() : null;
    const observation = body?.observation != null ? String(body.observation).trim() : null;
    const busName = body?.busName != null ? String(body.busName).trim() : null;
    const stopName = body?.stopName != null ? String(body.stopName).trim() : null;
    const locationText = body?.locationText != null ? String(body.locationText).trim() : null;
    const latitude = body?.latitude != null && String(body.latitude).trim() !== "" ? Number(body.latitude) : null;
    const longitude = body?.longitude != null && String(body.longitude).trim() !== "" ? Number(body.longitude) : null;
    const photosRaw = body?.photos;
    const photos: string[] = Array.isArray(photosRaw)
      ? photosRaw.map((x: any) => String(x)).filter(Boolean)
      : [];

    const eventTimeRaw = body?.eventTime;
    const eventTime = eventTimeRaw ? new Date(String(eventTimeRaw)) : new Date();

    const insert = await pool.query(
      `
        INSERT INTO pendencias.operacional_tracking_events (
          cte,
          serie,
          event_kind,
          event_type,
          option_key,
          observation,
          bus_name,
          stop_name,
          location_text,
          latitude,
          longitude,
          photos,
          event_time,
          created_by
        )
        VALUES ($1,$2,'MANUAL',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING *
      `,
      [
        cte,
        serie,
        eventType,
        optionKey,
        observation,
        busName,
        stopName,
        locationText,
        Number.isFinite(latitude) ? latitude : null,
        Number.isFinite(longitude) ? longitude : null,
        photos,
        eventTime.toISOString(),
        username,
      ]
    );

    const inserted = insert.rows?.[0];

    // Log simples
    await pool.query(
      `
        INSERT INTO pendencias.app_logs (created_at, level, source, event, username, cte, serie, payload)
        VALUES (NOW(), 'INFO', 'operacional_tracking', 'EVENT_MANUAL', $1, $2, $3, $4::jsonb)
      `,
      [username, cte, serie, JSON.stringify({ eventType, optionKey, hasPhotos: photos.length > 0 })]
    );

    return NextResponse.json({ success: true, event: inserted });
  } catch (error) {
    console.error("OperationalTracking events POST error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

