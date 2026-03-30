import { NextResponse } from "next/server";
import { rebuildCteViewIndexAll } from "../../../lib/server/cteIndex";

export const runtime = "nodejs";

export async function POST() {
  try {
    await rebuildCteViewIndexAll();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao rebuild index:", error);
    return NextResponse.json({ success: false, error: "Erro interno" }, { status: 500 });
  }
}

