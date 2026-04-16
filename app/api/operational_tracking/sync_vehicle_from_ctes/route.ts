import { NextResponse } from "next/server";
import { requireApiPermissions, verifyCronSecret } from "../../../../lib/server/apiAuth";
import { getPool } from "../../../../lib/server/db";
import { ensureOperationalTrackingTables } from "../../../../lib/server/ensureSchema";
import {
  latestPlateFromVeiculosJson,
  mdfLabelFromCtes,
  normalizePlate,
} from "../../../../lib/server/ctesTrackingJson";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      const guard = await requireApiPermissions(req, ["MANAGE_RASTREIO_OPERACIONAL"]);
      if (guard.denied) return guard.denied;
    }

    await ensureOperationalTrackingTables();
    const pool = getPool();

    const res = await pool.query(
      `
        SELECT
          c.cte::text AS cte,
          c.serie::text AS serie,
          c.veiculos_json AS veiculos_json,
          c.mdfe_numero::text AS mdfe_numero,
          c.mdfe_serie::text AS mdfe_serie
        FROM pendencias.cte_view_index i
        JOIN pendencias.ctes c ON c.cte = i.cte AND c.serie = i.serie
        WHERE i.view = 'em_busca'
      `
    );

    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of res.rows || []) {
      const cte = String(row.cte || "").trim();
      const serie = String(row.serie || "").trim();
      if (!cte || !serie) {
        skipped++;
        continue;
      }

      try {
        const targetPlate = latestPlateFromVeiculosJson(row.veiculos_json);
        if (!targetPlate) {
          skipped++;
          continue;
        }

        const prevRes = await pool.query(
          `
            SELECT id, plate, vehicle_id, source
            FROM pendencias.operational_load_links
            WHERE cte = $1
              AND (serie = $2 OR ltrim(serie, '0') = ltrim($2, '0'))
              AND ends_at IS NULL
            ORDER BY starts_at DESC
            LIMIT 1
          `,
          [cte, serie]
        );
        const prev = prevRes.rows?.[0] || null;
        const prevPlate = normalizePlate(prev?.plate ?? null);

        if (prevPlate === targetPlate) {
          skipped++;
          continue;
        }

        const actor = "SISTEMA_CTES";
        const mdf = mdfLabelFromCtes(row.mdfe_numero, row.mdfe_serie);

        if (prev) {
          await pool.query(
            `
              UPDATE pendencias.operational_load_links
              SET ends_at = NOW(), updated_at = NOW(), changed_by = $3
              WHERE id = $1 AND cte = $2 AND ends_at IS NULL
            `,
            [prev.id, cte, actor]
          );
        }

        await pool.query(
          `
            INSERT INTO pendencias.operational_load_links (
              cte, serie, mdf, vehicle_id, plate, starts_at, source, changed_by, notes, updated_at
            )
            VALUES ($1, $2, $3, NULL, $4, NOW(), 'CTES_SYNC', $5, $6, NOW())
          `,
          [
            cte,
            serie,
            mdf,
            targetPlate,
            actor,
            prev
              ? `Placa atualizada automaticamente a partir do histórico SIGAI/ctes (antes: ${prevPlate || "—"}).`
              : "Primeiro vínculo automático a partir do histórico SIGAI/ctes (placa mais recente).",
          ]
        );

        await pool.query(
          `
            INSERT INTO pendencias.operacional_tracking_events (
              cte, serie, event_kind, event_type, option_key, observation, bus_name, stop_name, location_text, event_time, created_by
            )
            VALUES ($1, $2, 'MANUAL', 'ROTA', 'SYNC_CTES', $3, $4, NULL, NULL, NOW(), $5)
          `,
          [
            cte,
            serie,
            `Sincronização automática: vínculo Life atualizado para a placa ${targetPlate} (fonte: pendencias.ctes / veiculos_json).`,
            targetPlate,
            actor,
          ]
        );

        updated++;
      } catch (e: any) {
        errors.push(`${cte}/${serie}: ${e?.message || String(e)}`);
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: (res.rows || []).length,
      updated,
      skipped,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("sync_vehicle_from_ctes error:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
