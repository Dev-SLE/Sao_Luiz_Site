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

type Props = {
  trail: TrailPoint[];
};

const OperationalMap: React.FC<Props> = ({ trail }) => {
  if (!trail?.length) {
    return <div className="text-xs text-slate-600 p-3">Sem pontos de rastreio ainda para este vínculo.</div>;
  }
  const latest = trail[0];
  return (
    <MapContainer
      center={[latest.lat, latest.lng]}
      zoom={6}
      style={{ height: 240, width: "100%", borderRadius: 10 }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={trail.map((p) => [p.lat, p.lng])} pathOptions={{ color: "#2c348c", weight: 4 }} />
      <CircleMarker center={[latest.lat, latest.lng]} radius={8} pathOptions={{ color: "#e42424" }}>
        <Popup>
          Última posição<br />
          {latest.plate || latest.vehicle_id || "Sem identificação"}<br />
          {latest.at}
        </Popup>
      </CircleMarker>
    </MapContainer>
  );
};

export default OperationalMap;

