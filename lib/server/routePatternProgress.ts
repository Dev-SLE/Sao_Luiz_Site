/**
 * Progresso ao longo de uma polyline OD (WGS84, distâncias curtas ~ planas).
 */

export type LatLng = { lat: number; lng: number };

const R_EARTH_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la = (a.lat * Math.PI) / 180;
  const lb = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

function segLengthKm(poly: LatLng[]): number {
  let t = 0;
  for (let i = 1; i < poly.length; i++) t += haversineKm(poly[i - 1], poly[i]);
  return t;
}

/** Bearing 0–360° do segmento (norte = 0). */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

export type RouteProgressResult = {
  fractionAlong: number;
  nearestSegIndex: number;
  projected: LatLng;
  cumulativeKm: number;
  totalKm: number;
  etaMinutesP50: number | null;
  bearingDeg: number | null;
};

/**
 * @param polyline ordenada origem → destino
 * @param durationP50Minutes duração total típica (para ETA residual)
 */
export function computeRouteProgress(
  polyline: LatLng[],
  point: LatLng,
  durationP50Minutes: number | null
): RouteProgressResult | null {
  if (!polyline?.length || polyline.length < 2) return null;
  const totalKm = segLengthKm(polyline);
  if (totalKm < 1e-6) return null;

  let bestI = 0;
  let bestT = 0;
  let bestDist = Infinity;
  let bestProj: LatLng = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const ax = a.lng;
    const ay = a.lat;
    const bx = b.lng;
    const by = b.lat;
    const px = point.lng;
    const py = point.lat;
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    let t = ab2 > 1e-18 ? (apx * abx + apy * aby) / ab2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * abx;
    const qy = ay + t * aby;
    const q = { lat: qy, lng: qx };
    const d = haversineKm(point, q);
    if (d < bestDist) {
      bestDist = d;
      bestI = i;
      bestT = t;
      bestProj = q;
    }
  }

  let cumKm = 0;
  for (let i = 0; i < bestI; i++) cumKm += haversineKm(polyline[i], polyline[i + 1]);
  cumKm += haversineKm(polyline[bestI], bestProj);

  const fractionAlong = Math.max(0, Math.min(1, cumKm / totalKm));
  const remain = 1 - fractionAlong;
  const etaMinutesP50 =
    durationP50Minutes != null && Number.isFinite(durationP50Minutes)
      ? Math.max(0, Math.round(durationP50Minutes * remain))
      : null;

  const p0 = polyline[bestI];
  const p1 = polyline[bestI + 1];
  const bearing = bearingDeg(p0, p1);

  return {
    fractionAlong,
    nearestSegIndex: bestI,
    projected: bestProj,
    cumulativeKm: cumKm,
    totalKm,
    etaMinutesP50,
    bearingDeg: Number.isFinite(bearing) ? bearing : null,
  };
}

export function bearingFromTrail(trail: LatLng[]): number | null {
  if (!trail || trail.length < 2) return null;
  // trail[0] = mais recente (API devolve DESC). Último movimento = recente → mais antigo na lista.
  const recent = trail[0];
  const older = trail[1];
  return bearingDeg(older, recent);
}
