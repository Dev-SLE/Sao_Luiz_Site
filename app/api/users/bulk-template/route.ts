import { NextResponse } from "next/server";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { serverLog } from "../../../../lib/server/appLog";
import { buildUsersBulkTemplateBuffer } from "../../../../lib/server/usersBulkExcel";
import { fetchUsersBulkTemplateLists } from "../../../../lib/server/usersBulkLists";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_USERS"]);
    if (guard.denied) return guard.denied;

    const lists = await fetchUsersBulkTemplateLists();
    const buffer = await buildUsersBulkTemplateBuffer(lists);

    const filename = "modelo_importacao_usuarios.xlsx";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const msg = (error as Error)?.message || String(error);
    console.error("Erro ao gerar modelo de utilizadores:", error);
    await serverLog({
      level: "ERROR",
      event: "API_USERS_BULK_TEMPLATE_ERROR",
      data: { message: msg },
    });
    if (msg.includes("Não há perfis cadastrados")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao gerar o modelo" }, { status: 500 });
  }
}
