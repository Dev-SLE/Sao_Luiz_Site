#!/usr/bin/env python3
"""
Agrega padrões de rota OD (origem/destino) a partir de posições Life + vínculos em em_busca.
Suporta múltiplas variantes por OD (clustering de polylines), waypoints O/D e top placas.

Uso:
  DATABASE_URL no .env na raiz ou no ambiente.

  python scripts/compute_route_patterns.py [dias] [limite_linhas] [cluster_max_km]

  cluster_max_km — distância média (Haversine) entre polylines reamostradas; acima → nova variante.
  Default: 40 km (rotas estáveis de ônibus).
"""
from __future__ import annotations

import json
import math
import os
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("Instale psycopg2: pip install psycopg2-binary")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
STOPS_PATH = ROOT / "lib" / "data" / "agency_stops.json"
JOB_NAME = "compute_route_patterns"
RESAMPLE_N = 16
R_EARTH_KM = 6371.0

SQL_POS_LINK_MATCH = """
(
  regexp_replace(upper(trim(COALESCE(p.plate, ''))), '[[:space:]]', '', 'g')
    = regexp_replace(upper(trim(COALESCE(l.plate, ''))), '[[:space:]]', '', 'g')
  AND regexp_replace(upper(trim(COALESCE(l.plate, ''))), '[[:space:]]', '', 'g') <> ''
)
OR (
  COALESCE(NULLIF(trim(both from p.vehicle_id::text), ''), '') <> ''
  AND COALESCE(NULLIF(trim(both from l.vehicle_id::text), ''), '') <> ''
  AND trim(both from p.vehicle_id::text) = trim(both from l.vehicle_id::text)
)
"""

SQL_LINK_TIME_OK = """
(
  l.ends_at IS NULL
  OR (p.position_at >= l.starts_at AND p.position_at < l.ends_at)
)
"""


def load_root_env() -> None:
    path = ROOT / ".env"
    if not path.is_file():
        return
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].strip()
            if "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip()
            if not key:
                continue
            if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
                val = val[1:-1]
            if key not in os.environ:
                os.environ[key] = val


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.upper().split())


def extract_token(raw: str) -> str:
    raw = (raw or "").strip().split("/")[0].strip()
    if not raw:
        return ""
    parts = [p.strip() for p in raw.split("-") if p.strip()]
    if len(parts) > 1:
        return parts[-1]
    return raw


def load_stop_keys() -> list[dict]:
    with open(STOPS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def match_stop_key(raw: str, stops: list[dict]) -> str | None:
    token = extract_token(raw)
    if not token:
        return None
    n = norm(token)
    for s in stops:
        k = s["key"]
        if n == k:
            return k
    for s in stops:
        k = s["key"]
        if k in n or n in k:
            return k
    return None


def normalize_plate(p: str | None) -> str:
    return "".join((p or "").upper().replace(" ", "").split())


def percentile_minutes(sorted_vals: list[float], p: float) -> int:
    if not sorted_vals:
        return 0
    n = len(sorted_vals)
    if n == 1:
        return int(round(sorted_vals[0]))
    idx = min(n - 1, max(0, int(round((n - 1) * p))))
    return int(round(sorted_vals[idx]))


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    la1, ln1 = math.radians(a[0]), math.radians(a[1])
    la2, ln2 = math.radians(b[0]), math.radians(b[1])
    dla, dln = la2 - la1, ln2 - ln1
    s = math.sin(dla / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dln / 2) ** 2
    return 2 * R_EARTH_KM * math.asin(min(1.0, math.sqrt(s)))


def resample_polyline(pts: list[tuple[float, float]], n: int) -> list[tuple[float, float]]:
    if len(pts) < 2:
        return pts
    if len(pts) <= n:
        return list(pts)
    out = []
    step = (len(pts) - 1) / (n - 1)
    for i in range(n):
        idx = min(len(pts) - 1, int(round(i * step)))
        out.append(pts[idx])
    return out


def mean_polyline_distance_km(a: list[tuple[float, float]], b: list[tuple[float, float]], n: int) -> float:
    ra = resample_polyline(a, n)
    rb = resample_polyline(b, n)
    if len(ra) != len(rb):
        return float("inf")
    m = 0.0
    for i in range(len(ra)):
        m += haversine_km(ra[i], rb[i])
    return m / len(ra)


def cluster_trip_indices(trips: list[dict], max_km: float, n: int) -> list[list[int]]:
    """Greedy: cada cluster tem representante; atribui ao cluster mais próximo se distância ≤ max_km."""
    clusters: list[list[int]] = []
    reps: list[int] = []
    for i in range(len(trips)):
        best_ci = -1
        best_d = float("inf")
        for ci, ridx in enumerate(reps):
            d = mean_polyline_distance_km(trips[ridx]["pts"], trips[i]["pts"], n)
            if d <= max_km and d < best_d:
                best_d = d
                best_ci = ci
        if best_ci >= 0:
            clusters[best_ci].append(i)
        else:
            clusters.append([i])
            reps.append(i)
    return clusters


def subsample_points(points: list[tuple[float, float]], max_pts: int = 28) -> list[tuple[float, float]]:
    if len(points) <= max_pts:
        return points
    step = (len(points) - 1) / (max_pts - 1)
    out = []
    for i in range(max_pts):
        idx = min(len(points) - 1, int(round(i * step)))
        out.append(points[idx])
    return out


def nearest_on_polyline(
    poly: list[tuple[float, float]], lat: float, lng: float
) -> tuple[int, tuple[float, float]]:
    best_i = 0
    best_q: tuple[float, float] = poly[0]
    best_d = float("inf")
    for i in range(len(poly) - 1):
        a, b = poly[i], poly[i + 1]
        ax, ay = a[1], a[0]
        bx, by = b[1], b[0]
        px, py = lng, lat
        abx, aby = bx - ax, by - ay
        apx, apy = px - ax, py - ay
        ab2 = abx * abx + aby * aby
        t = (apx * abx + apy * aby) / ab2 if ab2 > 1e-18 else 0.0
        t = max(0.0, min(1.0, t))
        qx, qy = ax + t * abx, ay + t * aby
        d = haversine_km((lat, lng), (qy, qx))
        if d < best_d:
            best_d = d
            best_i = i
            best_q = (qy, qx)
    return best_i, best_q


def build_waypoint_rows(
    poly: list[tuple[float, float]],
    origin_key: str,
    dest_key: str,
    variant_id: int,
    stops: list[dict],
) -> list[tuple]:
    o = next((s for s in stops if s["key"] == origin_key), None)
    d = next((s for s in stops if s["key"] == dest_key), None)
    if not o or not d or len(poly) < 2:
        return []
    seg_o, qo = nearest_on_polyline(poly, float(o["lat"]), float(o["lng"]))
    seg_d, qd = nearest_on_polyline(poly, float(d["lat"]), float(d["lng"]))
    scored = [
        (seg_o, "ORIGIN", origin_key, o.get("label") or origin_key, qo[0], qo[1]),
        (seg_d, "DEST", dest_key, d.get("label") or dest_key, qd[0], qd[1]),
    ]
    scored.sort(key=lambda x: (x[0], 0 if x[1] == "ORIGIN" else 1))
    return [
        (origin_key, dest_key, variant_id, seq, t[1], t[2], t[3], t[4], t[5])
        for seq, t in enumerate(scored)
    ]


def ensure_route_pattern_tables(cur) -> None:
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS pendencias.operational_route_od_stats (
          origin_key text NOT NULL,
          dest_key text NOT NULL,
          trip_count int NOT NULL DEFAULT 0,
          duration_p50_minutes int NOT NULL DEFAULT 0,
          duration_p90_minutes int NOT NULL DEFAULT 0,
          last_sample_days int NOT NULL DEFAULT 7,
          computed_at timestamptz NOT NULL DEFAULT NOW(),
          PRIMARY KEY (origin_key, dest_key)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS pendencias.operational_route_od_variant (
          origin_key text NOT NULL,
          dest_key text NOT NULL,
          variant_id smallint NOT NULL,
          trip_count int NOT NULL DEFAULT 0,
          duration_p50_minutes int NOT NULL DEFAULT 0,
          duration_p90_minutes int NOT NULL DEFAULT 0,
          last_sample_days int NOT NULL DEFAULT 7,
          computed_at timestamptz NOT NULL DEFAULT NOW(),
          is_primary boolean NOT NULL DEFAULT false,
          top_plates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
          PRIMARY KEY (origin_key, dest_key, variant_id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS pendencias.operational_route_od_polyline (
          origin_key text NOT NULL,
          dest_key text NOT NULL,
          variant_id smallint NOT NULL DEFAULT 0,
          seq smallint NOT NULL,
          lat double precision NOT NULL,
          lng double precision NOT NULL,
          PRIMARY KEY (origin_key, dest_key, variant_id, seq)
        )
        """
    )
    cur.execute(
        """
        ALTER TABLE pendencias.operational_route_od_polyline
        ADD COLUMN IF NOT EXISTS variant_id smallint NOT NULL DEFAULT 0
        """
    )
    cur.execute(
        """
        ALTER TABLE pendencias.operational_route_od_polyline
        DROP CONSTRAINT IF EXISTS operational_route_od_polyline_pkey
        """
    )
    cur.execute(
        """
        ALTER TABLE pendencias.operational_route_od_polyline
        ADD PRIMARY KEY (origin_key, dest_key, variant_id, seq)
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS pendencias.operational_route_od_waypoint (
          origin_key text NOT NULL,
          dest_key text NOT NULL,
          variant_id smallint NOT NULL,
          seq smallint NOT NULL,
          kind text NOT NULL DEFAULT 'CLUSTER',
          stop_key text,
          label text,
          lat double precision NOT NULL,
          lng double precision NOT NULL,
          PRIMARY KEY (origin_key, dest_key, variant_id, seq)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS pendencias.operational_route_job_state (
          job_name text PRIMARY KEY,
          last_run_at timestamptz,
          last_error text,
          rows_scanned int,
          notes text,
          updated_at timestamptz NOT NULL DEFAULT NOW()
        )
        """
    )


def print_diagnostic_funnel(cur, since) -> None:
    pos_id_clause = """
        AND (
              COALESCE(TRIM(p.plate), '') <> ''
           OR COALESCE(NULLIF(trim(both from p.vehicle_id::text), ''), '') <> ''
        )
    """
    steps = [
        (
            "posições LIFE com placa ou vehicle_id na janela",
            f"""
            SELECT COUNT(DISTINCT p.id)::bigint FROM pendencias.operational_vehicle_positions p
            WHERE p.provider = 'LIFE' AND p.position_at >= %s
            {pos_id_clause}
            """,
        ),
        (
            "+ cruzam vínculo (placa normalizada ou vehicle_id + horário do load_link)",
            f"""
            SELECT COUNT(DISTINCT p.id)::bigint FROM pendencias.operational_vehicle_positions p
            WHERE p.provider = 'LIFE' AND p.position_at >= %s
            {pos_id_clause}
              AND EXISTS (
                SELECT 1 FROM pendencias.operational_load_links l
                WHERE ({SQL_POS_LINK_MATCH.strip()})
                  AND ({SQL_LINK_TIME_OK.strip()})
              )
            """,
        ),
        (
            "+ CT-e do vínculo existe em pendencias.ctes",
            f"""
            SELECT COUNT(DISTINCT p.id)::bigint FROM pendencias.operational_vehicle_positions p
            WHERE p.provider = 'LIFE' AND p.position_at >= %s
            {pos_id_clause}
              AND EXISTS (
                SELECT 1 FROM pendencias.operational_load_links l
                INNER JOIN pendencias.ctes c ON c.cte = l.cte AND c.serie = l.serie
                WHERE ({SQL_POS_LINK_MATCH.strip()})
                  AND ({SQL_LINK_TIME_OK.strip()})
              )
            """,
        ),
        (
            "+ CT-e está na visão em_busca (cte_view_index)",
            f"""
            SELECT COUNT(DISTINCT p.id)::bigint FROM pendencias.operational_vehicle_positions p
            WHERE p.provider = 'LIFE' AND p.position_at >= %s
            {pos_id_clause}
              AND EXISTS (
                SELECT 1 FROM pendencias.operational_load_links l
                INNER JOIN pendencias.ctes c ON c.cte = l.cte AND c.serie = l.serie
                INNER JOIN pendencias.cte_view_index i
                  ON i.cte = c.cte AND i.serie = c.serie AND i.view = 'em_busca'
                WHERE ({SQL_POS_LINK_MATCH.strip()})
                  AND ({SQL_LINK_TIME_OK.strip()})
              )
            """,
        ),
    ]
    print("Diagnóstico (contagem de posições distintas por etapa; janela UTC desde", since.isoformat(), "):\n")
    prev = None
    step_counts: list[int] = []
    for label, sql in steps:
        cur.execute(sql, (since,))
        n = int(cur.fetchone()[0])
        step_counts.append(n)
        line = f"  {n:>12}  {label}"
        if prev is not None and prev > 0 and n == 0:
            line += "  <-- provável causa (etapa anterior tinha dados, esta zerou)"
        print(line)
        prev = n
    cur.execute(
        "SELECT COUNT(*)::bigint FROM pendencias.operational_load_links WHERE ends_at IS NULL"
    )
    active_links = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*)::bigint FROM pendencias.operational_load_links")
    total_links = cur.fetchone()[0]
    print(f"\n  Vínculos em operational_load_links: {active_links} ativos (ends_at IS NULL), {total_links} no total.")
    if active_links == 0:
        print(
            "  Nenhum vínculo ativo — rode POST /api/operational_tracking/sync_vehicle_from_ctes (cron) "
            "ou vincule ônibus no painel de rastreio operacional."
        )
    elif active_links > 0 and len(step_counts) >= 2 and step_counts[0] > 0 and step_counts[1] == 0:
        print("\n  Amostra — placas normalizadas nas posições LIFE (mais pings na janela):")
        cur.execute(
            """
            SELECT regexp_replace(upper(trim(COALESCE(p.plate, ''))), '[[:space:]]', '', 'g') AS n,
                   COUNT(*)::bigint AS cnt
            FROM pendencias.operational_vehicle_positions p
            WHERE p.provider = 'LIFE' AND p.position_at >= %s
              AND COALESCE(TRIM(p.plate), '') <> ''
            GROUP BY 1 ORDER BY 2 DESC NULLS LAST LIMIT 10
            """,
            (since,),
        )
        for n, cnt in cur.fetchall():
            print(f"     {n!r}  ({cnt} pings)")
        print("  Vínculos ativos (plate, vehicle_id, cte/serie, starts_at):")
        cur.execute(
            """
            SELECT COALESCE(plate, ''), COALESCE(vehicle_id::text, ''), cte, serie, starts_at
            FROM pendencias.operational_load_links
            WHERE ends_at IS NULL
            ORDER BY starts_at DESC
            """
        )
        for row in cur.fetchall():
            print(f"     placa={row[0]!r} vehicle_id={row[1]!r} cte={row[2]}/{row[3]} starts_at={row[4]}")
    print(
        "\nDicas: aumente os dias (ex.: python scripts/compute_route_patterns.py 30); "
        "placas são comparadas sem espaços (como no SIGAI); CT-es em em_busca precisam de linha em cte_view_index."
    )


def main() -> None:
    load_root_env()
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("DATABASE_URL não definido.")
        sys.exit(1)

    days = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    row_limit = int(sys.argv[2]) if len(sys.argv) > 2 else 30000
    cluster_max_km = float(sys.argv[3]) if len(sys.argv) > 3 else 40.0

    stops = load_stop_keys()
    since = datetime.now(timezone.utc) - timedelta(days=days)

    conn = psycopg2.connect(url)
    cur = conn.cursor()
    ensure_route_pattern_tables(cur)
    conn.commit()

    sql = """
        SELECT
          p.plate,
          p.position_at,
          p.lat,
          p.lng,
          c.coleta,
          c.entrega
        FROM pendencias.operational_vehicle_positions p
        INNER JOIN pendencias.operational_load_links l
          ON (""" + SQL_POS_LINK_MATCH + """)
          AND (""" + SQL_LINK_TIME_OK + """)
        INNER JOIN pendencias.ctes c ON c.cte = l.cte AND c.serie = l.serie
        INNER JOIN pendencias.cte_view_index i
          ON i.cte = c.cte AND i.serie = c.serie AND i.view = 'em_busca'
        WHERE p.provider = 'LIFE'
          AND p.position_at >= %s
          AND (
               COALESCE(TRIM(p.plate), '') <> ''
            OR COALESCE(NULLIF(trim(both from p.vehicle_id::text), ''), '') <> ''
          )
        ORDER BY p.plate ASC, p.position_at ASC
        LIMIT %s
    """

    cur.execute(sql, (since, row_limit))
    rows = cur.fetchall()
    rows_scanned = len(rows)
    if rows_scanned == 0:
        print_diagnostic_funnel(cur, since)

    gap_s = 2 * 3600
    segments: list[list[tuple]] = []
    cur_seg: list[tuple] = []
    for r in rows:
        plate, pos_at, lat, lng, coleta, entrega = r
        if not cur_seg:
            cur_seg.append(r)
            continue
        prev = cur_seg[-1]
        if prev[0] != plate or (pos_at - prev[1]).total_seconds() > gap_s:
            segments.append(cur_seg)
            cur_seg = [r]
        else:
            cur_seg.append(r)
    if cur_seg:
        segments.append(cur_seg)

    od_trips: dict[tuple[str, str], list[dict]] = defaultdict(list)

    for seg in segments:
        if len(seg) < 6:
            continue
        coleta, entrega = seg[0][4], seg[0][5]
        ok = match_stop_key(str(coleta or ""), stops)
        dk = match_stop_key(str(entrega or ""), stops)
        if not ok or not dk or ok == dk:
            continue
        dt_min = (seg[-1][1] - seg[0][1]).total_seconds() / 60.0
        if dt_min < 45 or dt_min > 72 * 60:
            continue
        key = (ok, dk)
        pts = [(float(r[2]), float(r[3])) for r in seg]
        plate_norm = normalize_plate(str(seg[0][0] or ""))
        od_trips[key].append({"duration": dt_min, "pts": pts, "plate": plate_norm})

    now = datetime.now(timezone.utc)
    od_keys_touched = list(od_trips.keys())
    variants_total = 0

    for key in od_keys_touched:
        trips = od_trips[key]
        if not trips:
            continue
        clusters = cluster_trip_indices(trips, cluster_max_km, RESAMPLE_N)
        cluster_meta: list[dict] = []
        for memb in clusters:
            sub = [trips[i] for i in memb]
            durs = sorted([t["duration"] for t in sub])
            p50 = percentile_minutes(durs, 0.5)
            p90 = percentile_minutes(durs, 0.9)
            # polilyne representativa: mais pontos
            best_pts = max((t["pts"] for t in sub), key=len)
            plates = [t["plate"] for t in sub if t["plate"]]
            ctr = Counter(plates)
            top_plates = [{"plate": p, "count": c} for p, c in ctr.most_common(8)]
            cluster_meta.append(
                {
                    "trip_count": len(sub),
                    "p50": p50,
                    "p90": p90,
                    "poly": best_pts,
                    "top_plates": top_plates,
                }
            )
        cluster_meta.sort(key=lambda x: -x["trip_count"])
        for i, c in enumerate(cluster_meta):
            c["variant_id"] = i
        primary_vid = 0

        cur.execute(
            "DELETE FROM pendencias.operational_route_od_waypoint WHERE origin_key = %s AND dest_key = %s",
            key,
        )
        cur.execute(
            "DELETE FROM pendencias.operational_route_od_polyline WHERE origin_key = %s AND dest_key = %s",
            key,
        )
        cur.execute(
            "DELETE FROM pendencias.operational_route_od_variant WHERE origin_key = %s AND dest_key = %s",
            key,
        )

        for c in cluster_meta:
            vid = int(c["variant_id"])
            is_pri = vid == primary_vid
            cur.execute(
                """
                INSERT INTO pendencias.operational_route_od_variant (
                  origin_key, dest_key, variant_id, trip_count, duration_p50_minutes, duration_p90_minutes,
                  last_sample_days, computed_at, is_primary, top_plates_json
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    key[0],
                    key[1],
                    vid,
                    c["trip_count"],
                    c["p50"],
                    c["p90"],
                    days,
                    now,
                    is_pri,
                    json.dumps(c["top_plates"]),
                ),
            )
            poly = subsample_points(c["poly"])
            if len(poly) >= 2:
                vals = [(key[0], key[1], vid, i, lat, lng) for i, (lat, lng) in enumerate(poly)]
                execute_values(
                    cur,
                    """
                    INSERT INTO pendencias.operational_route_od_polyline
                      (origin_key, dest_key, variant_id, seq, lat, lng)
                    VALUES %s
                    """,
                    vals,
                )
            wp_rows = build_waypoint_rows(poly, key[0], key[1], vid, stops)
            for wr in wp_rows:
                cur.execute(
                    """
                    INSERT INTO pendencias.operational_route_od_waypoint (
                      origin_key, dest_key, variant_id, seq, kind, stop_key, label, lat, lng
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    wr,
                )
            variants_total += 1

        if cluster_meta:
            pri = cluster_meta[0]
            cur.execute(
                """
                INSERT INTO pendencias.operational_route_od_stats (
                  origin_key, dest_key, trip_count, duration_p50_minutes, duration_p90_minutes, last_sample_days, computed_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (origin_key, dest_key) DO UPDATE SET
                  trip_count = EXCLUDED.trip_count,
                  duration_p50_minutes = EXCLUDED.duration_p50_minutes,
                  duration_p90_minutes = EXCLUDED.duration_p90_minutes,
                  last_sample_days = EXCLUDED.last_sample_days,
                  computed_at = EXCLUDED.computed_at
                """,
                (key[0], key[1], pri["trip_count"], pri["p50"], pri["p90"], days, now),
            )

    cur.execute(
        """
        INSERT INTO pendencias.operational_route_job_state (job_name, last_run_at, last_error, rows_scanned, notes, updated_at)
        VALUES (%s, %s, NULL, %s, %s, %s)
        ON CONFLICT (job_name) DO UPDATE SET
          last_run_at = EXCLUDED.last_run_at,
          last_error = NULL,
          rows_scanned = EXCLUDED.rows_scanned,
          notes = EXCLUDED.notes,
          updated_at = EXCLUDED.updated_at
        """,
        (
            JOB_NAME,
            now,
            rows_scanned,
            f"janela={days}d limit={row_limit} cluster_km={cluster_max_km} pares_OD={len(od_keys_touched)} variantes={variants_total} algo=v2",
            now,
        ),
    )

    conn.commit()
    cur.close()
    conn.close()
    if rows_scanned == 0:
        print(f"OK: {rows_scanned} linhas lidas, 0 pares OD (nada a agregar — veja o funil acima).")
    elif len(od_keys_touched) == 0:
        print(
            f"OK: {rows_scanned} linhas lidas, 0 pares OD após filtros (segmento≥6 pontos, coleta/entrega nas paradas, 45min–72h)."
        )
    else:
        print(
            f"OK: {rows_scanned} linhas, {len(od_keys_touched)} pares OD, {variants_total} variantes (cluster≤{cluster_max_km} km)."
        )


if __name__ == "__main__":
    main()
