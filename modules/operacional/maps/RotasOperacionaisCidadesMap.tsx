'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type RotasMapPonto = {
  cidade_destino: string;
  lat: number;
  lng: number;
  faturamento_total: number;
  total_ctes: number;
  peso_total: number;
  volumes_total: number;
};

type Props = {
  points: RotasMapPonto[];
  formatBrl: (n: number) => string;
  formatInt: (n: number) => string;
  formatKg: (n: number) => string;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Leaflet imperativo — evita “Map container is already initialized” com react-leaflet + Strict Mode. */
export function RotasOperacionaisCidadesMap({ points, formatBrl, formatInt, formatKg }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const formatRef = useRef({ formatBrl, formatInt, formatKg });
  formatRef.current = { formatBrl, formatInt, formatKg };

  const maxFat = useMemo(() => Math.max(1, ...points.map((p) => p.faturamento_total)), [points]);
  const pointsKey = useMemo(
    () =>
      points
        .map(
          (p) =>
            `${p.cidade_destino}\0${p.lat},${p.lng}\0${p.faturamento_total}\0${p.total_ctes}\0${p.peso_total}\0${p.volumes_total}`,
        )
        .join('|'),
    [points],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
    }

    if (!el || !points.length) return;

    const { formatBrl: fb, formatInt: fi, formatKg: fk } = formatRef.current;

    const centerDefault: L.LatLngExpression = [-14.235, -51.9253];
    const first = points[0];
    const center: L.LatLngExpression = first ? [first.lat, first.lng] : centerDefault;

    const map = L.map(el, {
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView(center, 5);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const latlngs = points.map((p) => L.latLng(p.lat, p.lng));
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 6);
    } else {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 9 });
    }

    for (const p of points) {
      const t = Math.max(0.05, p.faturamento_total / maxFat);
      const radius = 8 + t * 32;
      const cm = L.circleMarker([p.lat, p.lng], {
        radius,
        color: '#065f46',
        fillColor: '#10b981',
        fillOpacity: 0.75,
        weight: 2,
      });
      const html = `
        <div style="min-width:190px;font-size:12px;color:#0f172a">
          <p style="font-weight:700;margin:0 0 4px">${escapeHtml(p.cidade_destino)}</p>
          <p style="margin:2px 0">Faturamento: ${escapeHtml(fb(p.faturamento_total))}</p>
          <p style="margin:2px 0">CTEs: ${escapeHtml(fi(p.total_ctes))}</p>
          <p style="margin:2px 0">Peso: ${escapeHtml(fk(p.peso_total))}</p>
          <p style="margin:2px 0">Volumes: ${escapeHtml(fi(p.volumes_total))}</p>
        </div>`;
      cm.bindPopup(html);
      cm.addTo(map);
    }

    window.setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }
    }, 0);

    return () => {
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [pointsKey, points, maxFat]);

  if (!points.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
        Nenhuma cidade com coordenadas para desenhar no mapa.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="z-0 isolate h-80 w-full rounded-xl border border-slate-100"
      style={{ minHeight: 320 }}
    />
  );
}
