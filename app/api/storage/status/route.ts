import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/server/authorization";
import { isSharePointGraphConfigured, storageDefaultIsSharePoint } from "@/lib/server/sharepointConfig";

export const runtime = "nodejs";

/** Estado da integração de storage (para o client decidir fluxo pós-login). */
export async function GET(req: Request) {
  const session = await getSessionContext(req);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  return NextResponse.json({
    sharepointConfigured: isSharePointGraphConfigured(),
    defaultProviderSharePoint: storageDefaultIsSharePoint(),
  });
}
