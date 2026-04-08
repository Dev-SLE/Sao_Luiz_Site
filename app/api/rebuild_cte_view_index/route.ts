import { NextResponse } from "next/server";
import { requireApiPermissions, verifyCronSecret } from "../../../lib/server/apiAuth";
import { rebuildCteViewIndexAll } from "../../../lib/server/cteIndex";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    if (!verifyCronSecret(req)) {
      const guard = await requireApiPermissions(req, ["MANAGE_SETTINGS"]);
      if (guard.denied) return guard.denied;
    }

    await rebuildCteViewIndexAll();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao rebuild index:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

