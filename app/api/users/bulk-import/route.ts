import { NextResponse } from "next/server";
import { isImmutableMasterUsername } from "../../../../lib/adminSuperRoles";
import { upsertAppUser } from "../../../../lib/server/appUserUpsert";
import { requireApiPermissions } from "../../../../lib/server/apiAuth";
import { serverLog } from "../../../../lib/server/appLog";
import { getPool } from "../../../../lib/server/db";
import { generateRandomCompliantPassword } from "../../../../lib/server/generateCompliantPassword";
import { parseUsersBulkImportWorkbook } from "../../../../lib/server/usersBulkExcel";
import { fetchUsersBulkTemplateLists } from "../../../../lib/server/usersBulkLists";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_ROWS = 1500;

type RowResult =
  | { sheetRow: number; username: string; status: "ok" }
  | { sheetRow: number; username: string; status: "error"; message: string };

function normalizeKey(s: string): string {
  return String(s || "")
    .trim()
    .toLowerCase();
}

export async function POST(req: Request) {
  try {
    const guard = await requireApiPermissions(req, ["MANAGE_USERS"]);
    if (guard.denied) return guard.denied;
    const actor = String(guard.session?.username || "").trim();
    const ct = String(req.headers.get("content-type") || "");
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ error: "Envie o ficheiro em multipart/form-data (campo file)." }, { status: 400 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Campo file obrigatório." }, { status: 400 });
    }

    const ab = await (file as File).arrayBuffer();
    if (ab.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Ficheiro demasiado grande (máx. 4 MB)." }, { status: 400 });
    }

    const buffer = Buffer.from(ab);
    let rows: Awaited<ReturnType<typeof parseUsersBulkImportWorkbook>>;
    try {
      rows = await parseUsersBulkImportWorkbook(buffer);
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_ROWS} linhas com utilizador preenchido por ficheiro.` },
        { status: 400 },
      );
    }

    const lists = await fetchUsersBulkTemplateLists();
    const vendByLower = new Map<string, string>();
    for (const v of lists.vendedoras) {
      vendByLower.set(normalizeKey(v), v);
    }

    const pool = getPool();
    const seenUser = new Set<string>();
    const results: RowResult[] = [];

    for (const r of rows) {
      const uKey = normalizeKey(r.username);
      if (seenUser.has(uKey)) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: "Utilizador duplicado no ficheiro (mantenha uma linha por login).",
        });
        continue;
      }
      seenUser.add(uKey);

      if (isImmutableMasterUsername(r.username)) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: "Conta reservada do sistema não pode ser alterada por importação.",
        });
        continue;
      }
      if (actor && normalizeKey(r.username) === normalizeKey(actor)) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: "Não é permitido importar alterações sobre o próprio utilizador da sessão.",
        });
        continue;
      }

      if (!r.role) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: "Perfil obrigatório.",
        });
        continue;
      }
      const roleCanon = lists.profiles.find((p) => normalizeKey(p) === normalizeKey(r.role));
      if (!roleCanon) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: `Perfil desconhecido: "${r.role}".`,
        });
        continue;
      }

      const originRaw = String(r.linkedOriginUnit || "").trim();
      const destRaw = String(r.linkedDestUnit || "").trim();
      if (originRaw && !lists.units.length) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: "Não há unidades (coleta/entrega) na base para validar a origem.",
        });
        continue;
      }
      if (destRaw && !lists.units.length) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: "Não há unidades (coleta/entrega) na base para validar o destino.",
        });
        continue;
      }
      const originCanon = originRaw
        ? lists.units.find((u) => normalizeKey(u) === normalizeKey(originRaw)) || null
        : "";
      const destCanon = destRaw
        ? lists.units.find((u) => normalizeKey(u) === normalizeKey(destRaw)) || null
        : "";
      if (originRaw && !originCanon) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: `Unidade de origem inválida: "${originRaw}".`,
        });
        continue;
      }
      if (destRaw && !destCanon) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: `Unidade de destino inválida: "${destRaw}".`,
        });
        continue;
      }
      const origin = originCanon || "";
      const dest = destCanon || "";

      let vend = String(r.linkedBiVendedora || "").trim();
      if (vend) {
        const canon = vendByLower.get(normalizeKey(vend));
        if (!canon) {
          results.push({
            sheetRow: r.sheetRow,
            username: r.username,
            status: "error",
            message: `Vendedora BI inválida: "${vend}".`,
          });
          continue;
        }
        vend = canon;
      }

      let password = String(r.password || "").trim();
      if (!password) {
        password = generateRandomCompliantPassword(r.username);
      }

      const out = await upsertAppUser(pool, {
        username: r.username,
        password,
        role: roleCanon,
        linkedOriginUnit: origin,
        linkedDestUnit: dest,
        linkedBiVendedora: vend,
      });

      if (!out.ok) {
        results.push({
          sheetRow: r.sheetRow,
          username: r.username,
          status: "error",
          message: out.error,
        });
        continue;
      }

      results.push({ sheetRow: r.sheetRow, username: r.username, status: "ok" });
    }

    const okCount = results.filter((x) => x.status === "ok").length;
    const failCount = results.filter((x) => x.status === "error").length;

    await serverLog({
      level: failCount ? "WARN" : "INFO",
      event: "API_USERS_BULK_IMPORT",
      data: { actor, ok: okCount, failed: failCount },
    });

    return NextResponse.json({
      imported: okCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    console.error("Erro na importação em massa de utilizadores:", error);
    await serverLog({
      level: "ERROR",
      event: "API_USERS_BULK_IMPORT_ERROR",
      data: { message: (error as any)?.message || String(error) },
    });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
