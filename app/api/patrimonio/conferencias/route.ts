import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { createConferencia, listConferencias } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const url = new URL(req.url);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
  const pool = getPool();
  const rows = await listConferencias(pool, limit);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const pool = getPool();
    const r = await createConferencia(pool, body, g.session!.username);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ conferencia: r.row });
  } catch (e) {
    console.error("POST /api/patrimonio/conferencias", e);
    return NextResponse.json({ error: "Erro ao iniciar conferência." }, { status: 500 });
  }
}
