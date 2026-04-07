type LifeTrackingRow = {
  vehicleId: string | null;
  plate: string | null;
  lat: number;
  lng: number;
  positionAt: string;
  odometerKm: number | null;
  area: string | null;
  subArea: string | null;
  raw: Record<string, unknown>;
};

function parseDateTime(input: unknown): string | null {
  const s = String(input || "").trim();
  if (!s) return null;
  // "YYYY-MM-DD HH:mm:ss"
  const isoCandidate = s.replace(" ", "T");
  const dt = new Date(isoCandidate);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function asNumber(input: unknown): number | null {
  if (input == null) return null;
  const n = Number(String(input).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function rowToObject(columns: string[], row: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i += 1) out[columns[i]] = row[i];
  return out;
}

export async function fetchLifeTrackingRows(): Promise<LifeTrackingRow[]> {
  const endpoint =
    String(process.env.LIFE_TRACKING_API_URL || "").trim() ||
    "http://ws.lifeonline.com.br:6010/ws/rast_online/index.php";
  const token = String(process.env.LIFE_TRACKING_TOKEN || "").trim();
  if (!token) throw new Error("LIFE_TRACKING_TOKEN não configurado");

  const payload = {
    TK: token,
    EXIBIR: "T",
    CATEGORIA: "",
    ODOMVIACAN: "T",
    EXIBIRPC: "T",
    EXIBIRAREA: "T",
  };
  const url = new URL(endpoint);
  url.searchParams.set("DATA", JSON.stringify(payload));

  const resp = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) throw new Error(`Life API HTTP ${resp.status}`);

  const json = (await resp.json()) as { COLUMNS?: unknown; DATA?: unknown };
  const cols = Array.isArray(json.COLUMNS) ? json.COLUMNS.map((x) => String(x)) : [];
  const data = Array.isArray(json.DATA) ? json.DATA : [];
  if (!cols.length || !data.length) return [];

  const idx = (name: string) => cols.findIndex((c) => c.toUpperCase() === name.toUpperCase());
  const iDate = idx("DATAHORA");
  const iVehicle = idx("VEICULO");
  const iPlate = idx("PLACA");
  const iLat = idx("LATITUDE");
  const iLng = idx("LONGITUDE");
  const iOdo = idx("ODOMETROVIACAN");
  const iArea = idx("AREA");
  const iSub = idx("SUBAREA");

  const out: LifeTrackingRow[] = [];
  for (const item of data) {
    if (!Array.isArray(item)) continue;
    const lat = asNumber(iLat >= 0 ? item[iLat] : null);
    const lng = asNumber(iLng >= 0 ? item[iLng] : null);
    const positionAt = parseDateTime(iDate >= 0 ? item[iDate] : null);
    if (lat == null || lng == null || !positionAt) continue;
    if (lat === 0 && lng === 0) continue;

    const plateRaw = String(iPlate >= 0 ? item[iPlate] || "" : "").trim().toUpperCase();
    const vehRaw = String(iVehicle >= 0 ? item[iVehicle] || "" : "").trim();
    const rawObj = rowToObject(cols, item);
    out.push({
      vehicleId: vehRaw || null,
      plate: plateRaw || null,
      lat,
      lng,
      positionAt,
      odometerKm: asNumber(iOdo >= 0 ? item[iOdo] : null),
      area: iArea >= 0 ? String(item[iArea] || "").trim() || null : null,
      subArea: iSub >= 0 ? String(item[iSub] || "").trim() || null : null,
      raw: rawObj,
    });
  }
  return out;
}

