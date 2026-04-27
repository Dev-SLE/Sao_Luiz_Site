import ExcelJS from "exceljs";
import { generateRandomCompliantPassword } from "./generateCompliantPassword";
import type { UsersBulkTemplateLists } from "./usersBulkLists";

export const USERS_BULK_DATA_SHEET = "Importar_usuarios";
export const USERS_BULK_LIST_SHEET = "_Listas";
const PREFILL_ROWS = 500;
const DATA_RANGE_END = PREFILL_ROWS + 1;

const HEADERS = [
  "usuario",
  "senha_inicial",
  "perfil",
  "unidade_origem",
  "unidade_destino",
  "vendedora_bi",
] as const;

export type ParsedBulkUserRow = {
  sheetRow: number;
  username: string;
  password: string;
  role: string;
  linkedOriginUnit: string;
  linkedDestUnit: string;
  linkedBiVendedora: string;
};

function listRange(sheetName: string, col: string, startRow: number, endRow: number): string {
  const safe = sheetName.replace(/'/g, "''");
  const quoted = /^[A-Za-z0-9_]+$/.test(safe) && !/^\d/.test(safe) ? safe : `'${safe}'`;
  return `=${quoted}!$${col}$${startRow}:$${col}$${endRow}`;
}

export async function buildUsersBulkTemplateBuffer(lists: UsersBulkTemplateLists): Promise<Buffer> {
  if (!lists.profiles.length) {
    throw new Error("Não há perfis cadastrados. Crie pelo menos um perfil antes de gerar o modelo.");
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Pendências";

  const profiles = lists.profiles;
  const units = lists.units;
  const vendedoras = lists.vendedoras;

  const listWs = wb.addWorksheet(USERS_BULK_LIST_SHEET, { state: "hidden" });

  profiles.forEach((p, i) => {
    listWs.getCell(`A${2 + i}`).value = p;
  });
  units.forEach((u, i) => {
    listWs.getCell(`B${2 + i}`).value = u;
  });
  vendedoras.forEach((v, i) => {
    listWs.getCell(`C${2 + i}`).value = v;
  });

  const lastProfile = 1 + profiles.length;
  const lastUnit = 1 + units.length;
  const lastVend = 1 + vendedoras.length;

  const dataWs = wb.addWorksheet(USERS_BULK_DATA_SHEET, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  HEADERS.forEach((h, i) => {
    const c = dataWs.getCell(1, i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
  });
  dataWs.getColumn(1).width = 22;
  dataWs.getColumn(2).width = 22;
  dataWs.getColumn(3).width = 28;
  dataWs.getColumn(4).width = 22;
  dataWs.getColumn(5).width = 22;
  dataWs.getColumn(6).width = 22;

  for (let r = 2; r <= DATA_RANGE_END; r += 1) {
    dataWs.getCell(r, 2).value = generateRandomCompliantPassword();
  }

  const profileFormula = listRange(USERS_BULK_LIST_SHEET, "A", 2, lastProfile);

  const dvCommon = {
    type: "list" as const,
    allowBlank: true,
    showErrorMessage: true,
    errorStyle: "error" as const,
    errorTitle: "Valor inválido",
    error: "Escolha um item da lista.",
  };

  const dv = dataWs as ExcelJS.Worksheet & {
    dataValidations: { add: (range: string, rule: ExcelJS.DataValidation) => void };
  };
  dv.dataValidations.add(`C2:C${DATA_RANGE_END}`, {
    ...dvCommon,
    formulae: [profileFormula],
  });
  if (units.length) {
    const unitFormula = listRange(USERS_BULK_LIST_SHEET, "B", 2, lastUnit);
    dv.dataValidations.add(`D2:D${DATA_RANGE_END}`, {
      ...dvCommon,
      formulae: [unitFormula],
    });
    dv.dataValidations.add(`E2:E${DATA_RANGE_END}`, {
      ...dvCommon,
      formulae: [unitFormula],
    });
  }
  if (vendedoras.length) {
    const vendFormula = listRange(USERS_BULK_LIST_SHEET, "C", 2, lastVend);
    dv.dataValidations.add(`F2:F${DATA_RANGE_END}`, {
      ...dvCommon,
      formulae: [vendFormula],
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normalizeHeaderKey(raw: string): string {
  return stripDiacritics(String(raw || "").trim().toLowerCase())
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function resolveHeaderMap(headerRow: ExcelJS.Row): Map<string, number> {
  const aliasToCanonical: Record<string, string> = {
    usuario: "usuario",
    utilizador: "usuario",
    user: "usuario",
    username: "usuario",
    login: "usuario",
    senha_inicial: "senha_inicial",
    senha: "senha_inicial",
    password: "senha_inicial",
    perfil: "perfil",
    role: "perfil",
    papel: "perfil",
    unidade_origem: "unidade_origem",
    origem: "unidade_origem",
    unidade_destino: "unidade_destino",
    destino: "unidade_destino",
    vendedora_bi: "vendedora_bi",
    vendedora: "vendedora_bi",
    bi_vendedora: "vendedora_bi",
  };

  const colByCanonical = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const key = normalizeHeaderKey(String(cell.value ?? ""));
    if (!key) return;
    const canonical = aliasToCanonical[key];
    if (canonical && !colByCanonical.has(canonical)) {
      colByCanonical.set(canonical, colNumber);
    }
  });
  return colByCanonical;
}

function cellText(row: ExcelJS.Row, col: number | undefined): string {
  if (!col) return "";
  const cell = row.getCell(col) as ExcelJS.Cell;
  const t = cell.text;
  if (t != null && String(t).length > 0) return String(t).trim();
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && v !== null && "result" in v) {
    const r = (v as { result?: unknown }).result;
    return r === null || r === undefined ? "" : String(r).trim();
  }
  return String(v).trim();
}

export async function parseUsersBulkImportWorkbook(buffer: Uint8Array): Promise<ParsedBulkUserRow[]> {
  const wb = new ExcelJS.Workbook();
  // Tipos do Buffer (Node) vs exceljs divergem em alguns TS; o runtime aceita Buffer.
  await (wb.xlsx as unknown as { load: (data: Buffer) => Promise<unknown> }).load(Buffer.from(buffer));
  const ws =
    wb.getWorksheet(USERS_BULK_DATA_SHEET) ||
    wb.worksheets.find((w) => /importar/i.test(String(w.name || "")));
  if (!ws) {
    throw new Error(`Folha "${USERS_BULK_DATA_SHEET}" não encontrada no ficheiro.`);
  }

  const headerRow = ws.getRow(1);
  const colMap = resolveHeaderMap(headerRow);
  const need = ["usuario", "perfil"] as const;
  for (const k of need) {
    if (!colMap.has(k)) {
      const found = [...colMap.keys()].join(", ") || "(nenhuma)";
      throw new Error(`Cabeçalho obrigatório em falta: "${k}". Colunas reconhecidas: ${found}`);
    }
  }
  const cUser = colMap.get("usuario");
  const cPass = colMap.get("senha_inicial");
  const cRole = colMap.get("perfil");
  const cOrig = colMap.get("unidade_origem");
  const cDest = colMap.get("unidade_destino");
  const cVend = colMap.get("vendedora_bi");

  const out: ParsedBulkUserRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const username = cellText(row, cUser);
    if (!username) return;
    out.push({
      sheetRow: rowNumber,
      username,
      password: cPass ? cellText(row, cPass) : "",
      role: cellText(row, cRole),
      linkedOriginUnit: cOrig ? cellText(row, cOrig) : "",
      linkedDestUnit: cDest ? cellText(row, cDest) : "",
      linkedBiVendedora: cVend ? cellText(row, cVend) : "",
    });
  });

  return out;
}
