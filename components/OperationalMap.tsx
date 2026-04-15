"use client";

import React, { useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type TrailPoint = {
  lat: number;
  lng: number;
  at: string;
  plate?: string | null;
  vehicle_id?: string | null;
};

export type MapExtraMarker = {
  lat: number;
  lng: number;
  label: string;
  detail?: string;
};

export type MapWaypointMarker = {
  lat: number;
  lng: number;
  label: string;
  kind?: string;
};

type Props = {
  trail: TrailPoint[];
  fallbackPoint?: { lat: number; lng: number; label?: string } | null;
  /** Eventos manuais com GPS (ordem livre). */
  extraMarkers?: MapExtraMarker[];
  /** Altura do mapa em px (drawer vs modal). */
  heightPx?: number;
  /** Rota típica histórica (OD) — linha cinza tracejada. */
  referencePolyline?: Array<{ lat: number; lng: number }> | null;
  /** Rumo do movimento (0° = norte), ex. a partir da trilha ou da rota típica. */
  bearingDeg?: number | null;
  /** Projeção do veículo na rota de referência (progresso). */
  progressPoint?: { lat: number; lng: number } | null;
  /** Paragens O/D ou waypoints do itinerário. */
  waypoints?: MapWaypointMarker[] | null;
};

function createArrowIcon(bearingDeg: number): L.DivIcon {
  return L.divIcon({
    className: "operational-map-bearing-arrow",
    html: `<div style="transform:rotate(${bearingDeg}deg);font-size:20px;line-height:1;color:#b91c1c;text-shadow:0 0 2px #fff">▲</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const OperationalMap: React.FC<Props> = ({
  trail,
  fallbackPoint,
  extraMarkers = [],
  heightPx = 240,
  referencePolyline = null,
  bearingDeg = null,
  progressPoint = null,
  waypoints = null,
}) => {
  const hasTrail = Array.isArray(trail) && trail.length > 0;
  const hasRef = Array.isArray(referencePolyline) && referencePolyline.length >= 2;
  const arrowIcon = useMemo(
    () => (bearingDeg != null && Number.isFinite(bearingDeg) ? createArrowIcon(bearingDeg) : null),
    [bearingDeg]
  );
  if (!hasTrail && !fallbackPoint && !hasRef) {
    return <div className="text-xs text-slate-600 p-3">Sem pontos de rastreio ainda para este vínculo.</div>;
  }
  const latest = hasTrail ? trail[0] : null;
  const center = latest
    ? [latest.lat, latest.lng]
    : fallbackPoint
      ? [fallbackPoint.lat, fallbackPoint.lng]
      : [referencePolyline![0].lat, referencePolyline![0].lng];
  const trailChrono = hasTrail ? [...trail].reverse() : [];

  return (
    <MapContainer
      center={center as [number, number]}
      zoom={6}
      style={{ height: heightPx, width: "100%", borderRadius: 10 }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {hasRef ? (
        <Polyline
          positions={referencePolyline!.map((p) => [p.lat, p.lng])}
          pathOptions={{ color: "#94a3b8", weight: 3, dashArray: "10 8", opacity: 0.95 }}
        />
      ) : null}
      {progressPoint ? (
        <CircleMarker
          center={[progressPoint.lat, progressPoint.lng]}
          radius={7}
          pathOptions={{ color: "#d97706", fillColor: "#f59e0b", fillOpacity: 0.9, weight: 2 }}
        >
          <Popup>Progresso na rota típica (projeção)</Popup>
        </CircleMarker>
      ) : null}
      {(waypoints || []).map((w, i) => (
        <CircleMarker
          key={`wp-${i}-${w.lat}-${w.lng}`}
          center={[w.lat, w.lng]}
          radius={5}
          pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 0.85, weight: 1 }}
        >
          <Popup>
            {w.label}
            {w.kind ? (
              <>
                <br />
                {w.kind}
              </>
            ) : null}
          </Popup>
        </CircleMarker>
      ))}
      {hasTrail ? (
        <>
          <Polyline positions={trailChrono.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#0a1628", weight: 4 }} />
          {arrowIcon && latest ? (
            <Marker position={[latest.lat, latest.lng]} icon={arrowIcon}>
              <Popup>
                Direção (último movimento)
                <br />
                {latest.plate || latest.vehicle_id || "—"}
                <br />
                {latest.at}
              </Popup>
            </Marker>
          ) : (
            <CircleMarker center={[latest!.lat, latest!.lng]} radius={8} pathOptions={{ color: "#c41230" }}>
              <Popup>
                Última posição
                <br />
                {latest!.plate || latest!.vehicle_id || "Sem identificação"}
                <br />
                {latest!.at}
              </Popup>
            </CircleMarker>
          )}
        </>
      ) : fallbackPoint ? (
        <CircleMarker center={[fallbackPoint.lat, fallbackPoint.lng]} radius={8} pathOptions={{ color: "#c41230" }}>
          <Popup>{fallbackPoint?.label || "Última posição"}</Popup>
        </CircleMarker>
      ) : hasRef ? (
        <CircleMarker
          center={[referencePolyline![referencePolyline!.length - 1].lat, referencePolyline![referencePolyline!.length - 1].lng]}
          radius={6}
          pathOptions={{ color: "#64748b" }}
        >
          <Popup>Rota típica (histórico OD)</Popup>
        </CircleMarker>
      ) : null}
      {(extraMarkers || []).map((m, i) => (
        <CircleMarker
          key={`ex-${i}-${m.lat}-${m.lng}`}
          center={[m.lat, m.lng]}
          radius={6}
          pathOptions={{ color: "#16a34a", fillColor: "#22c55e", fillOpacity: 0.85 }}
        >
          <Popup>
            {m.label}
            {m.detail ? (
              <>
                <br />
                {m.detail}
              </>
            ) : null}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
};

export default OperationalMap;
