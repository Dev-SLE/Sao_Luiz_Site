import { NextResponse } from "next/server";
import { getApiRouteMeterSnapshot, resetApiRouteMeter } from "@/lib/server/apiHitMeter";
import { requireApiPermissions } from "@/lib/server/apiAuth";

export const runtime = "nodejs";

/**
 * GET /api/diagnostics/route-meter — contadores de uso (rotas explícitas + readThroughCache).
 * Requer MANAGE_SETTINGS. Query ?reset=1 zera contadores (útil após deploy).
 */
export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_SETTINGS"]);
    if (guard.denied) return guard.denied;

    const { searchParams } = new URL(req.url);
    if (searchParams.get("reset") === "1") {
      resetApiRouteMeter();
      return NextResponse.json({ ok: true, reset: true });
    }

    return NextResponse.json(getApiRouteMeterSnapshot());
  } catch (e) {
    console.error("[diagnostics.route-meter]", e);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
