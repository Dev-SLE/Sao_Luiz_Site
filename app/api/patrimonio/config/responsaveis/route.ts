import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { requirePatrimonioModule } from "@/lib/server/patrimonioAuth";
import { listResponsaveis, upsertResponsavel } from "@/lib/server/patrimonioService";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const pool = getPool();
  return NextResponse.json({ rows: await listResponsaveis(pool) });
}

export async function POST(req: Request) {
  const g = await requirePatrimonioModule(req);
  if (g.denied) return g.denied;
  const body = (await req.json()) as Record<string, unknown>;
  if (!String(body.nome || "").trim()) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }
  const pool = getPool();
  const row = await upsertResponsavel(pool, body);
  return NextResponse.json({ row });
}
