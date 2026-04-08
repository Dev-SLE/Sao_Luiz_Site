#!/usr/bin/env python3
"""
Agrega padrões de rota OD (origem/destino) a partir de posições Life + vínculos em em_busca.

Objetivo: custo baixo no Neon — uma única leitura limitada (janela + LIMIT); todo o agrupamento
roda neste processo (máquina local, CI ou servidor barato).

Uso:
  Defina DATABASE_URL (igual ao .env do site) e execute:
    python scripts/compute_route_patterns.py

Opcional: janela em dias (default 5) e limite de linhas (default 30000):
    python scripts/compute_route_patterns.py 5 30000
"""
from __future__ import annotations

import json
import os
import sys
import unicodedata
from collections import defaultdict
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
    keys = [s["key"] for s in stops]
    for s in stops:
        k = s["key"]
        if n == k:
            return k
    for s in stops:
        k = s["key"]
        if k in n or n in k:
            return k
    return None


def percentile_minutes(sorted_vals: list[float], p: float) -> int:
    if not sorted_vals:
        return 0
    n = len(sorted_vals)
    if n == 1:
        return int(round(sorted_vals[0]))
    idx = min(n - 1, max(0, int(round((n - 1) * p))))
    return int(round(sorted_vals[idx]))


def subsample_points(points: list[tuple[float, float]], max_pts: int = 28) -> list[tuple[float, float]]:
    if len(points) <= max_pts:
        return points
    step = (len(points) - 1) / (max_pts - 1)
    out = []
    for i in range(max_pts):
        idx = min(len(points) - 1, int(round(i * step)))
        out.append(points[idx])
    return out


def main() -> None:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("DATABASE_URL não definido.")
        sys.exit(1)

    days = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    row_limit = int(sys.argv[2]) if len(sys.argv) > 2 else 30000

    stops = load_stop_keys()
    since = datetime.now(timezone.utc) - timedelta(days=days)

    conn = psycopg2.connect(url)
    cur = conn.cursor()

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
          ON UPPER(TRIM(COALESCE(p.plate, ''))) = UPPER(TRIM(COALESCE(l.plate, '')))
          AND p.position_at >= l.starts_at
          AND (l.ends_at IS NULL OR p.position_at < l.ends_at)
        INNER JOIN pendencias.ctes c ON c.cte = l.cte AND c.serie = l.serie
        INNER JOIN pendencias.cte_view_index i
          ON i.cte = c.cte AND i.serie = c.serie AND i.view = 'em_busca'
        WHERE p.provider = 'LIFE'
          AND p.position_at >= %s
          AND COALESCE(TRIM(p.plate), '') <> ''
        ORDER BY p.plate ASC, p.position_at ASC
        LIMIT %s
    """

    cur.execute(sql, (since, row_limit))
    rows = cur.fetchall()
    rows_scanned = len(rows)

    # segmentos: quebra por placa ou gap > 2h
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

    od_durations: dict[tuple[str, str], list[float]] = defaultdict(list)
    od_polylines: dict[tuple[str, str], list[tuple[float, float]]] = {}

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
        od_durations[key].append(dt_min)
        pts = [(float(r[2]), float(r[3])) for r in seg]
        if key not in od_polylines or len(pts) > len(od_polylines.get(key, [])):
            od_polylines[key] = pts

    now = datetime.now(timezone.utc)

    for key, durs in od_durations.items():
        if len(durs) < 1:
            continue
        durs_sorted = sorted(durs)
        p50 = percentile_minutes(durs_sorted, 0.5)
        p90 = percentile_minutes(durs_sorted, 0.9)
        trip_count = len(durs)
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
            (key[0], key[1], trip_count, p50, p90, days, now),
        )

        poly = subsample_points(od_polylines.get(key, []))
        cur.execute(
            "DELETE FROM pendencias.operational_route_od_polyline WHERE origin_key = %s AND dest_key = %s",
            key,
        )
        if len(poly) >= 2:
            vals = [(key[0], key[1], i, lat, lng) for i, (lat, lng) in enumerate(poly)]
            execute_values(
                cur,
                """
                INSERT INTO pendencias.operational_route_od_polyline (origin_key, dest_key, seq, lat, lng)
                VALUES %s
                """,
                vals,
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
            f"janela={days}d limit={row_limit} pares_OD={len(od_durations)}",
            now,
        ),
    )

    conn.commit()
    cur.close()
    conn.close()
    print(f"OK: {rows_scanned} linhas, {len(od_durations)} pares OD atualizados.")


if __name__ == "__main__":
    main()
