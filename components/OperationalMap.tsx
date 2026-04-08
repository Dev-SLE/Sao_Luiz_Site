"use client";

import React from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from "react-leaflet";
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

type Props = {
  trail: TrailPoint[];
  fallbackPoint?: { lat: number; lng: number; label?: string } | null;
  /** Eventos manuais com GPS (ordem livre). */
  extraMarkers?: MapExtraMarker[];
  /** Altura do mapa em px (drawer vs modal). */
  heightPx?: number;
  /** Rota típica histórica (OD) — linha tracejada, não é GPS ao vivo. */
  referencePolyline?: Array<{ lat: number; lng: number }> | null;
};

const OperationalMap: React.FC<Props> = ({
  trail,
  fallbackPoint,
  extraMarkers = [],
  heightPx = 240,
  referencePolyline = null,
}) => {
  const hasTrail = Array.isArray(trail) && trail.length > 0;
  const hasRef = Array.isArray(referencePolyline) && referencePolyline.length >= 2;
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
      {hasTrail ? (
        <>
          <Polyline positions={trailChrono.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#2c348c", weight: 4 }} />
          <CircleMarker center={[latest!.lat, latest!.lng]} radius={8} pathOptions={{ color: "#e42424" }}>
            <Popup>
              Última posição<br />
              {latest!.plate || latest!.vehicle_id || "Sem identificação"}<br />
              {latest!.at}
            </Popup>
          </CircleMarker>
        </>
      ) : fallbackPoint ? (
        <CircleMarker center={[fallbackPoint.lat, fallbackPoint.lng]} radius={8} pathOptions={{ color: "#e42424" }}>
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

