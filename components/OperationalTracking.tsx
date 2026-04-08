import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, Plus, Camera, Loader2, RefreshCw, AlertTriangle, Truck } from "lucide-react";
import clsx from "clsx";
import dynamic from "next/dynamic";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { matchAgencyStopKey } from "../lib/cteLocationKeys";
import {
  DESTINO_OPTIONS,
  DESTINO_TO_MAPS_URL_BY_NORMALIZED,
  normalizeDestination,
} from "../lib/maps/destinos";

type TrackingItem = {
  CTE: string;
  SERIE: string;
  COLETA: string;
  ENTREGA: string;
  DESTINATARIO: string;
  FRETE_PAGO: string;
  VALOR_CTE: string;
  STATUS_CALCULADO: string;
  STATUS_LOGISTICA?: string;
  DATA_EMISSAO?: string;
  CODIGO?: string;
  MDFE_NUMERO?: string;
  MDFE_SERIE?: string;
  MDFE_CHAVE?: string;
  CTES_UPDATED_AT?: string;
  LAST_UPDATE_AT: string;
  VEHICLE_ID?: string;
  PLATE?: string;
  LAST_LAT?: number | null;
  LAST_LNG?: number | null;
  LAST_POSITION_AT?: string;
  MINUTES_SINCE_LAST_POSITION?: number | null;
  MDF?: string;
};

type TimelineEntry = {
  id: string;
  source: "NOTA" | "EVENTO_MANUAL" | "PROCESS_CONTROL";
  kind: string;
  time: string;
  user?: string | null;
  option?: string | null;
  observation?: string | null;
  bus_name?: string | null;
  stop_name?: string | null;
  location_text?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photos?: string[];
};

type SigaiLinhaRow = { data_evento: string; evento: string; operador: string };
type VeiculoHistRow = {
  data_v?: string;
  placa?: string;
  modelo?: string;
  tipo?: string;
  data_viagem?: string;
  hora_viagem?: string;
  veiculo?: string | number;
};

type RoutePatternVariant = {
  variant_id: number;
  trip_count: number;
  duration_p50_minutes: number;
  duration_p90_minutes: number;
  is_primary: boolean;
  top_plates?: Array<{ plate: string; count: number }>;
};

type RoutePatternPreview = {
  polyline: Array<{ lat: number; lng: number }>;
  waypoints: Array<{ lat: number; lng: number; label: string; kind: string }>;
  stats: {
    trip_count: number;
    duration_p50_minutes: number;
    duration_p90_minutes: number;
    computed_at: string;
    variant_id?: number;
  } | null;
  variants: RoutePatternVariant[];
  selectedVariantId: number | null;
};

type TrackingDetail = {
  item: TrackingItem;
  timeline: TimelineEntry[];
  sigaiLinhaTempo?: SigaiLinhaRow[];
  veiculosHistorico?: VeiculoHistRow[];
  stops: Array<{
    stop_name: string;
    bus_name: string | null;
    location_text: string | null;
    latitude?: number | null;
    longitude?: number | null;
    at: string;
  }>;
  activeLink?: {
    id: string;
    mdf?: string | null;
    vehicle_id?: string | null;
    plate?: string | null;
  } | null;
  links?: Array<any>;
  trail?: Array<{
    lat: number;
    lng: number;
    at: string;
    position_at: string;
    vehicle_id?: string | null;
    plate?: string | null;
    odometer_km?: number | null;
  }>;
  routeProgress?: {
    variant_id: number;
    fraction_along: number;
    eta_minutes_p50: number | null;
    bearing_route_deg: number | null;
    bearing_trail_deg: number | null;
    cumulative_km: number;
    total_km: number;
    projected_lat: number;
    projected_lng: number;
  } | null;
  tripLegs?: Array<{
    leg_index: number;
    starts_at: string;
    ends_at: string | null;
    load_link_id: string | null;
  }>;
};

type EventMode = "ROTA" | "DESCARGA";
type RotaAction = "MUDOU_ONIBUS" | "QUEBROU_ATRASOU" | "PASSOU_PARADA" | "OBSERVACAO_GERAL";
type DescargaStatus = "RECEBIDO" | "EXTRAVIADO" | "DANIFICADO" | "OUTRO";

const googleMapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const OperationalMap = dynamic(() => import("./OperationalMap"), { ssr: false });

const googleMapsDirectionsUrl = ({
  origin,
  destination,
  waypoints,
  travelMode,
}: {
  origin: string;
  destination: string;
  waypoints?: string[];
  travelMode?: "driving" | "transit" | "walking" | "bicycling";
}) => {
  const base = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  const tm = travelMode || "transit";
  if (!waypoints?.length) return `${base}&travelmode=${encodeURIComponent(tm)}`;

  // google maps usa waypoints separados por "|"
  const wp = waypoints
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .slice(0, 8)
    .join("|");

  return `${base}&waypoints=${encodeURIComponent(wp)}&travelmode=${encodeURIComponent(tm)}`;
};

const extractMainLocation = (raw?: string | null) => {
  const s = String(raw || "").trim();
  if (!s) return "";

  // Ex: "DEC - ANAPOLIS" => pega o final
  const parts = s.split("-").map((x) => x.trim()).filter(Boolean);
  if (parts.length > 1) return parts[parts.length - 1];

  // Ex: "DEC - ANAPOLIS / ..." => pega a última parte depois de "/"
  const slashParts = s.split("/").map((x) => x.trim()).filter(Boolean);
  if (slashParts.length > 1) return slashParts[slashParts.length - 1];

  return s;
};

const getFileIdFromUrl = (url: string): string => {
  if (!url) return "";
  let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  match = url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return "";
};

const getMapsUrlForDestination = (name?: string | null) => {
  const raw = String(name || "");
  const n = normalizeDestination(raw);
  if (!n) return "";

  const candidates: string[] = [];
  candidates.push(n);

  // Remove prefixos comuns do seu sistema (ex.: "DEC - CUIABÁ", "DEC - ANAPOLIS")
  const splitHyphen = n.includes("-") ? n.split("-").map((x) => x.trim()).filter(Boolean) : [];
  if (splitHyphen.length > 1) {
    candidates.push(splitHyphen[splitHyphen.length - 1]);
  }

  const withoutDec = n.replace(/\bDEC\b/g, "").trim();
  if (withoutDec) candidates.push(withoutDec);

  // Quando a string vem com " / " ou "–", pega a parte principal final
  const splitSlash = n.includes("/") ? n.split("/").map((x) => x.trim()).filter(Boolean) : [];
  if (splitSlash.length > 1) {
    candidates.push(splitSlash[splitSlash.length - 1]);
  }

  for (const c of candidates) {
    const hit = DESTINO_TO_MAPS_URL_BY_NORMALIZED[c];
    if (hit) return hit;
  }

  return "";
};

const isGoogleDriveUrl = (url: string) => !!getFileIdFromUrl(url);

const normLogisticsStatus = (s: string) =>
  String(s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function logisticsStatusHeaderClass(statusRaw: string) {
  const s = normLogisticsStatus(statusRaw);
  if (s.includes("CANCELADO")) return "bg-red-600 text-white border-red-700 shadow-sm";
  if (s.includes("CRITICO") || s.includes("FORA DO PRAZO") || s.includes("PRIORIDADE") || s.includes("VENCE AMANHA"))
    return "bg-orange-600 text-white border-orange-700 shadow-sm";
  if (s.includes("NO PRAZO")) return "bg-emerald-600 text-white border-emerald-700 shadow-sm";
  if (s.includes("CONCLUIDO NO PRAZO")) return "bg-emerald-700 text-white border-emerald-800 shadow-sm";
  if (s.includes("CONCLUIDO")) return "bg-slate-600 text-white border-slate-700 shadow-sm";
  return "bg-slate-100 text-slate-900 border-slate-200";
}

interface Props {
  initialCte?: string | null;
  initialSerie?: string | null;
}

const OperationalTracking: React.FC<Props> = ({ initialCte, initialSerie }) => {
  const { user } = useAuth();
  const { hasPermission } = useData();

  const [loadingItems, setLoadingItems] = useState(false);
  const [isSyncingLife, setIsSyncingLife] = useState(false);
  const [isSyncingCtes, setIsSyncingCtes] = useState(false);
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);

  const [q, setQ] = useState("");
  const [unit, setUnit] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selected, setSelected] = useState<TrackingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const canManage = hasPermission("MANAGE_RASTREIO_OPERACIONAL");

  // Manual event form
  const [mode, setMode] = useState<EventMode>("ROTA");
  const [rotaAction, setRotaAction] = useState<RotaAction>("OBSERVACAO_GERAL");
  const [descStatus, setDescStatus] = useState<DescargaStatus>("RECEBIDO");
  const [busName, setBusName] = useState("");
  const [stopName, setStopName] = useState("");
  const [locationText, setLocationText] = useState("");
  const [observation, setObservation] = useState("");
  const [eventTimeLocal, setEventTimeLocal] = useState<string>("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [linkVehicleId, setLinkVehicleId] = useState("");
  const [linkPlate, setLinkPlate] = useState("");
  const [linkMdf, setLinkMdf] = useState("");
  const [linkReason, setLinkReason] = useState("BALDEACAO");
  const [linkNotes, setLinkNotes] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [routePattern, setRoutePattern] = useState<RoutePatternPreview | null>(null);
  /** null = API usa variante primária */
  const [routePatternVariantId, setRoutePatternVariantId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const unitOptions = useMemo(() => {
    const s = new Set(items.map((x) => x.ENTREGA).filter(Boolean));
    return Array.from(s).sort();
  }, [items]);

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      const usp = new URLSearchParams();
      usp.set("page", String(page));
      usp.set("limit", String(limit));
      if (unit.trim()) usp.set("unit", unit.trim());
      if (q.trim()) usp.set("q", q.trim());
      if (dateFrom.trim()) usp.set("dateFrom", dateFrom.trim());
      if (dateTo.trim()) usp.set("dateTo", dateTo.trim());

      const resp = await fetch(`/api/operational_tracking/items?${usp.toString()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setItems(Array.isArray(data.data) ? data.data : []);
      setTotal(data.total || 0);
    } finally {
      setLoadingItems(false);
    }
  };

  const runLifeSync = async () => {
    if (!canManage) return;
    if (isSyncingLife) return;
    setIsSyncingLife(true);
    try {
      const resp = await fetch("/api/operational_tracking/sync", { method: "POST" });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      await fetchItems();
      if (selected?.item?.CTE) {
        await fetchDetail(selected.item.CTE, selected.item.SERIE);
      }
    } finally {
      setIsSyncingLife(false);
    }
  };

  const runCtesVehicleSync = async () => {
    if (!canManage) return;
    if (isSyncingCtes) return;
    setIsSyncingCtes(true);
    try {
      const resp = await fetch("/api/operational_tracking/sync_vehicle_from_ctes", { method: "POST" });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      await fetchItems();
      if (selected?.item?.CTE) {
        await fetchDetail(selected.item.CTE, selected.item.SERIE);
      }
    } finally {
      setIsSyncingCtes(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchItems();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, unit, dateFrom, dateTo, page, limit]);

  useEffect(() => {
    if (!canManage) return;
    runLifeSync();
    runCtesVehicleSync();
    const id = setInterval(() => {
      runLifeSync();
      runCtesVehicleSync();
    }, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  const resetForm = () => {
    setMode("ROTA");
    setRotaAction("OBSERVACAO_GERAL");
    setDescStatus("RECEBIDO");
    setBusName("");
    setStopName("");
    setLocationText("");
    setObservation("");
    setPhotos([]);
    setUploadedPhotoUrls([]);
    setEventTimeLocal("");
  };

  const fetchDetail = async (cte: string, serie: string): Promise<TrackingDetail | null> => {
    setLoadingDetail(true);
    try {
      const usp = new URLSearchParams();
      usp.set("cte", cte);
      usp.set("serie", serie);
      const resp = await fetch(`/api/operational_tracking/item?${usp.toString()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: TrackingDetail = await resp.json();
      setSelected(data);
      resetForm();
      return data;
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (initialCte) {
      fetchDetail(initialCte, initialSerie || "0");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCte, initialSerie]);

  useEffect(() => {
    if (!selected?.item?.CTE) return;
    const id = setInterval(() => {
      fetchDetail(selected.item.CTE, selected.item.SERIE);
    }, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.item?.CTE, selected?.item?.SERIE]);

  useEffect(() => {
    setRoutePatternVariantId(null);
  }, [selected?.item?.CTE, selected?.item?.SERIE]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selected?.item) {
        setRoutePattern(null);
        return;
      }
      const ok = matchAgencyStopKey(selected.item.COLETA);
      const dk = matchAgencyStopKey(selected.item.ENTREGA);
      if (!ok || !dk) {
        setRoutePattern(null);
        return;
      }
      try {
        const usp = new URLSearchParams();
        usp.set("origin_key", ok);
        usp.set("dest_key", dk);
        if (routePatternVariantId != null) usp.set("variant_id", String(routePatternVariantId));
        const resp = await fetch(`/api/operational_tracking/route_pattern?${usp.toString()}`);
        if (!resp.ok) {
          if (!cancelled) setRoutePattern(null);
          return;
        }
        const data = await resp.json();
        if (cancelled) return;
        const poly = Array.isArray(data.polyline)
          ? data.polyline.map((p: { lat: number; lng: number }) => ({
              lat: Number(p.lat),
              lng: Number(p.lng),
            }))
          : [];
        const wps = Array.isArray(data.waypoints)
          ? data.waypoints.map((w: { lat: number; lng: number; label?: string; stop_key?: string; kind?: string }) => ({
              lat: Number(w.lat),
              lng: Number(w.lng),
              label: String(w.label || w.stop_key || ""),
              kind: String(w.kind || ""),
            }))
          : [];
        const variants: RoutePatternVariant[] = Array.isArray(data.variants)
          ? data.variants.map((v: Record<string, unknown>) => ({
              variant_id: Number(v.variant_id),
              trip_count: Number(v.trip_count),
              duration_p50_minutes: Number(v.duration_p50_minutes),
              duration_p90_minutes: Number(v.duration_p90_minutes),
              is_primary: Boolean(v.is_primary),
              top_plates: Array.isArray(v.top_plates) ? (v.top_plates as RoutePatternVariant["top_plates"]) : [],
            }))
          : [];
        setRoutePattern({
          polyline: poly,
          waypoints: wps,
          variants,
          selectedVariantId: data.variant_id != null ? Number(data.variant_id) : null,
          stats: data.stats
            ? {
                trip_count: Number(data.stats.trip_count),
                duration_p50_minutes: Number(data.stats.duration_p50_minutes),
                duration_p90_minutes: Number(data.stats.duration_p90_minutes),
                computed_at: String(data.stats.computed_at || ""),
                variant_id: data.stats.variant_id != null ? Number(data.stats.variant_id) : undefined,
              }
            : null,
        });
      } catch {
        if (!cancelled) setRoutePattern(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selected?.item?.CTE, selected?.item?.SERIE, selected?.item?.COLETA, selected?.item?.ENTREGA, routePatternVariantId]);

  useEffect(() => {
    if (!selected?.activeLink) {
      setLinkVehicleId("");
      setLinkPlate("");
      setLinkMdf("");
      return;
    }
    setLinkVehicleId(String(selected.activeLink.vehicle_id || ""));
    setLinkPlate(String(selected.activeLink.plate || ""));
    setLinkMdf(String(selected.activeLink.mdf || ""));
  }, [selected?.activeLink]);

  const handleOpenMapsForList = async (i: TrackingItem) => {
    const data = await fetchDetail(i.CTE, i.SERIE);
    if (data) setShowMapModal(true);
  };

  const isTrackingDetail = (arg: TrackingItem | TrackingDetail): arg is TrackingDetail => {
    return typeof (arg as TrackingDetail)?.item === "object";
  };

  const openMapsForItem = (arg: TrackingItem | TrackingDetail) => {
    // MVP atual: abre mapa interno com trilha/ponto do vínculo.
    if (isTrackingDetail(arg)) {
      setShowMapModal(true);
      return;
    }
    const origin = extractMainLocation(arg.COLETA);
    const destination = extractMainLocation(arg.ENTREGA);
    const waypoints: string[] = [];

    if (origin && destination) {
      window.open(
        googleMapsDirectionsUrl({ origin, destination, waypoints, travelMode: "transit" }),
        "_blank"
      );
      return;
    }

    // Fallback: tenta link fixo por destino
    const destRaw = arg.ENTREGA;
    const destLink = getMapsUrlForDestination(destRaw);
    if (destLink) return window.open(destLink, "_blank");

    const originRaw = arg.COLETA;
    const destForSearch = arg.ENTREGA;
    const query = `${originRaw} ${destForSearch}`.trim();
    window.open(googleMapsSearchUrl(query), "_blank");
  };

  const openMapsForStop = (
    i: TrackingItem,
    s: { location_text?: string | null; stop_name: string }
  ) => {
    const origin = extractMainLocation(i.COLETA);
    const destination = extractMainLocation(s.location_text || s.stop_name);

    if (origin && destination) {
      window.open(
        googleMapsDirectionsUrl({
          origin,
          destination,
          travelMode: "transit",
        }),
        "_blank"
      );
      return;
    }

    const destLink = getMapsUrlForDestination(s.location_text || s.stop_name);
    if (destLink) return window.open(destLink, "_blank");

    const query = (s.location_text || s.stop_name || "").trim();
    if (!query) return;
    window.open(googleMapsSearchUrl(query), "_blank");
  };

  const destinoKnown = !!stopName && DESTINO_OPTIONS.includes(stopName);
  const destinoSelectValue = !stopName ? "" : destinoKnown ? stopName : "__CUSTOM__";

  const uploadPhotos = async (files: File[]) => {
    if (!files.length) return [];
    if (!user?.username) throw new Error("Usuário não autenticado.");

    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f, f.name);
        fd.append("username", user.username);

        const resp = await fetch("/api/uploadImage", {
          method: "POST",
          body: fd,
        });
        const data = await resp.json();
        if (!resp.ok || !data?.url) throw new Error(data?.error || `Falha upload: ${f.name}`);
        urls.push(String(data.url));
      }
      return urls;
    } finally {
      setIsUploading(false);
    }
  };

  const handlePickPhotos = async (filesList: FileList | null) => {
    const files = filesList ? Array.from(filesList) : [];
    setPhotos(files);
    setUploadedPhotoUrls([]);
  };

  const handleSaveEvent = async () => {
    if (!selected) return;
    if (!canManage) return;
    if (isSaving || isUploading) return;

    const cte = selected.item.CTE;
    const serie = selected.item.SERIE;

    if (!observation.trim() && mode === "ROTA" && !busName.trim() && !stopName.trim()) {
      // Para rota, permitir evento sem texto desde que tenha pelo menos bus/stop.
    }
    if (!eventTimeLocal.trim()) {
      // default: agora
    }

    let photoUrls = uploadedPhotoUrls;
    if (photos.length > 0 && uploadedPhotoUrls.length === 0) {
      photoUrls = await uploadPhotos(photos);
      setUploadedPhotoUrls(photoUrls);
    }

    const eventTime = eventTimeLocal ? new Date(eventTimeLocal).toISOString() : undefined;
    const eventType = mode;
    const optionKey = mode === "ROTA" ? rotaAction : descStatus;

    setIsSaving(true);
    try {
      const resp = await fetch("/api/operational_tracking/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cte,
          serie,
          createdBy: user?.username ?? null,
          eventType,
          optionKey,
          observation: observation.trim() || null,
          busName: busName.trim() || null,
          stopName: stopName.trim() || null,
          locationText: locationText.trim() || null,
          photos: photoUrls,
          eventTime,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }

      await fetchDetail(cte, serie);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLink = async () => {
    if (!selected || !canManage || isLinking) return;
    if (!linkVehicleId.trim() && !linkPlate.trim()) return;
    setIsLinking(true);
    try {
      const resp = await fetch("/api/operational_tracking/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cte: selected.item.CTE,
          serie: selected.item.SERIE,
          mdf: linkMdf.trim() || null,
          vehicleId: linkVehicleId.trim() || null,
          plate: linkPlate.trim().toUpperCase() || null,
          reason: linkReason,
          notes: linkNotes.trim() || null,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${resp.status}`);
      }
      await fetchDetail(selected.item.CTE, selected.item.SERIE);
      setLinkNotes("");
    } finally {
      setIsLinking(false);
    }
  };

  const timelineEmpty = !selected?.timeline?.length;

  const mapExtraMarkers = useMemo(() => {
    if (!selected?.timeline?.length) return [];
    const out: { lat: number; lng: number; label: string; detail?: string }[] = [];
    for (const t of selected.timeline) {
      const lat = t.latitude != null ? Number(t.latitude) : NaN;
      const lng = t.longitude != null ? Number(t.longitude) : NaN;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out.push({
        lat,
        lng,
        label:
          t.source === "EVENTO_MANUAL"
            ? t.option || t.kind || "Evento manual"
            : t.source === "NOTA"
              ? "Nota"
              : "Processo",
        detail: [t.time, t.user || "", t.observation ? String(t.observation).slice(0, 100) : ""]
          .filter(Boolean)
          .join(" · "),
      });
    }
    return out;
  }, [selected?.timeline]);

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-slate-900">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2 text-[#e42424] border border-slate-200 shadow-[0_0_18px_rgba(236,27,35,0.4)]">
            <MapPin size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black">Rastreio Operacional</h1>
            <p className="text-xs text-slate-600">
              Dados fiscais e roteiro vêm do CT-e no Neon; telemetria Life e vínculo de placa podem sincronizar em segundo plano.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button
                type="button"
                onClick={runLifeSync}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-slate-700"
                disabled={isSyncingLife}
                title="Sincroniza telemetria da Life API (janela recomendada: 60s)"
              >
                {isSyncingLife ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {isSyncingLife ? "Sincronizando Life..." : "Sincronizar Life"}
              </button>
              <button
                type="button"
                onClick={runCtesVehicleSync}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50"
                disabled={isSyncingCtes}
                title="Atualiza vínculos veículo/placa a partir de veiculos_json (SIGAI → Neon)"
              >
                {isSyncingCtes ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                {isSyncingCtes ? "Sincronizando CT-es..." : "Vínculos CT-e"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => fetchItems()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2c348c] px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#e42424]"
            disabled={loadingItems}
          >
            {loadingItems ? <Loader2 size={14} className="animate-spin" /> : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Filtros (cards, sem tabela) */}
      <div className="rounded-2xl border border-[#2c348c]/20 bg-gradient-to-b from-white to-[#f4f7ff] p-3 shadow-[0_12px_26px_rgba(15,23,42,0.12)]">
        <div className="flex flex-col md:flex-row md:items-center md:gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-slate-500" size={18} />
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por CTE, série, destino, coleta, destinatário e rastreio..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="appearance-none rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
            >
              <option value="">Todas unidades</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="appearance-none rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="appearance-none rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
            />

            <button
              type="button"
              onClick={() => {
                setPage(1);
                fetchItems();
              }}
              className="rounded-xl bg-[#2c348c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#243a7a]"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de rastreios */}
      <div className="flex flex-col gap-3">
        {items.length === 0 && !loadingItems && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-600 text-sm">
            Nenhum rastreio encontrado para os filtros.
          </div>
        )}

        {items.map((i) => (
          <div
            key={`${i.CTE}-${i.SERIE}`}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-[0_8px_24px_rgba(15,23,42,0.10)] transition-all duration-200 hover:-translate-y-[1px] hover:border-[#2c348c]/35 hover:shadow-[0_14px_30px_rgba(44,52,140,0.16)]"
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                    {i.CTE} / {i.SERIE}
                  </span>
                  {i.STATUS_CALCULADO && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700">
                      {i.STATUS_CALCULADO}
                    </span>
                  )}
                  {i.STATUS_LOGISTICA ? (
                    <span
                      className={clsx(
                        "text-[10px] px-2 py-0.5 rounded-full border font-semibold",
                        logisticsStatusHeaderClass(i.STATUS_LOGISTICA)
                      )}
                    >
                      {i.STATUS_LOGISTICA}
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 text-xs text-slate-600 space-y-1">
                  {i.MDFE_NUMERO ? (
                    <div className="flex items-start gap-1">
                      {String(i.MDFE_NUMERO).toLowerCase().includes("aguardando") ? (
                        <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={14} />
                      ) : null}
                      <div>
                        <span className="text-slate-500">MDF-e:</span>{" "}
                        <span className="font-semibold">{i.MDFE_NUMERO}</span>
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <span className="text-slate-500">Coleta:</span> <span className="font-semibold">{i.COLETA || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Destino:</span> <span className="font-semibold">{i.ENTREGA || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Cliente:</span> <span className="font-semibold">{i.DESTINATARIO || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Última atualização:</span>{" "}
                    <span className="font-semibold">{i.LAST_UPDATE_AT || "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Última posição:</span>{" "}
                    <span className="font-semibold">
                      {i.LAST_LAT != null && i.LAST_LNG != null
                        ? `${i.LAST_LAT.toFixed(5)}, ${i.LAST_LNG.toFixed(5)}`
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Sinal:</span>{" "}
                    <span className="font-semibold">
                      {i.MINUTES_SINCE_LAST_POSITION == null
                        ? "Sem telemetria"
                        : i.MINUTES_SINCE_LAST_POSITION <= 10
                          ? `Online (${i.MINUTES_SINCE_LAST_POSITION} min)`
                          : `Atrasado (${i.MINUTES_SINCE_LAST_POSITION} min)`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fetchDetail(i.CTE, i.SERIE)}
                  className="rounded-xl border border-[#2c348c]/40 bg-[#2c348c] px-4 py-2 text-xs font-semibold text-white hover:bg-[#243a7a]"
                >
                  Abrir rastreio
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenMapsForList(i)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <MapPin size={14} />
                  Mapa
                </button>
              </div>
            </div>
          </div>
        ))}

        {loadingDetail && selected && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 text-slate-600 text-sm">
            Carregando detalhe...
          </div>
        )}

        {/* Pagination simples */}
        {total > limit && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <div className="text-xs text-slate-600">
              Página {page} (total: {total})
            </div>
            <button
              type="button"
              className="px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 disabled:opacity-40"
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        )}
      </div>

      {/* Drawer de detalhes */}
      {selected && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[min(100%,420px)] md:w-[min(560px,96vw)] bg-white border-l border-slate-200 shadow-[-12px_0_30px_rgba(15,23,42,0.18)] flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {selected.item.CTE} / {selected.item.SERIE}
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                {selected.item.COLETA} &rarr; {selected.item.ENTREGA}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-slate-500 hover:text-slate-900 text-xs"
            >
              Fechar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-black text-slate-900">
                  CT-e {selected.item.CTE} / {selected.item.SERIE}
                </span>
                {selected.item.STATUS_LOGISTICA ? (
                  <span
                    className={clsx(
                      "text-[10px] px-2 py-1 rounded-full border font-bold",
                      logisticsStatusHeaderClass(selected.item.STATUS_LOGISTICA)
                    )}
                  >
                    {selected.item.STATUS_LOGISTICA}
                  </span>
                ) : null}
                {selected.item.STATUS_CALCULADO ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
                    {selected.item.STATUS_CALCULADO}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-slate-700">
                <span className="text-slate-500">Destinatário:</span>{" "}
                <span className="font-semibold">{selected.item.DESTINATARIO || "—"}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-500">Emissão:</span>{" "}
                  <span className="font-semibold">{selected.item.DATA_EMISSAO || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Valor CT-e:</span>{" "}
                  <span className="font-semibold">
                    {selected.item.VALOR_CTE ? `R$ ${selected.item.VALOR_CTE}` : "—"}
                  </span>
                </div>
              </div>
              {selected.item.CTES_UPDATED_AT ? (
                <div className="text-[10px] text-slate-500">Dados CT-e no Neon: {selected.item.CTES_UPDATED_AT}</div>
              ) : null}
            </div>

            {(() => {
              const mdfe = String(selected.item.MDFE_NUMERO || "").trim();
              const aguardando = mdfe.toLowerCase().includes("aguardando");
              const semManifesto = !mdfe || mdfe.toLowerCase().includes("sem mdf");
              return (
                <div
                  className={clsx(
                    "rounded-xl border p-3",
                    aguardando || semManifesto
                      ? "border-amber-300 bg-amber-50/90"
                      : "border-slate-200 bg-slate-50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    {aguardando || semManifesto ? (
                      <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">MDF-e (ERP)</div>
                      <div className="text-sm font-bold text-slate-900 break-words">
                        {mdfe || (semManifesto ? "Aguardando manifesto" : "—")}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 space-y-0.5">
                        {selected.item.MDFE_SERIE ? (
                          <div>
                            <span className="text-slate-500">Série:</span> {selected.item.MDFE_SERIE}
                          </div>
                        ) : null}
                        {selected.item.MDFE_CHAVE ? (
                          <div className="truncate" title={selected.item.MDFE_CHAVE}>
                            <span className="text-slate-500">Chave:</span> {selected.item.MDFE_CHAVE}
                          </div>
                        ) : null}
                        {selected.activeLink?.mdf ? (
                          <div>
                            <span className="text-slate-500">Vínculo Life (atual):</span>{" "}
                            <span className="font-semibold">{selected.activeLink.mdf}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {selected.sigaiLinhaTempo && selected.sigaiLinhaTempo.length > 0 ? (
              <div className="border border-slate-200 rounded-xl p-3 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Linha do tempo (roteamento SIGAI)
                  </span>
                  <span className="text-[10px] text-slate-500">{selected.sigaiLinhaTempo.length}</span>
                </div>
                <div className="relative border-l-2 border-[#2c348c]/35 ml-2 pl-4 space-y-4 pb-1">
                  {selected.sigaiLinhaTempo.map((row, idx) => (
                    <div key={`${row.data_evento}-${idx}`} className="relative">
                      <span className="absolute -left-[calc(0.5rem+5px)] top-1.5 w-2.5 h-2.5 rounded-full bg-[#2c348c] ring-2 ring-white border border-white shadow" />
                      <div className="text-[10px] text-slate-500 font-mono">{row.data_evento}</div>
                      <div className="text-xs font-semibold text-slate-900 leading-snug">{row.evento}</div>
                      <div className="text-[11px] text-slate-600">{row.operador || "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {selected.veiculosHistorico && selected.veiculosHistorico.length > 0 ? (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/80">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Veículos / transbordo (histórico)
                  </span>
                  <Truck size={14} className="text-slate-400" />
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-2 py-1.5 font-semibold">Data</th>
                        <th className="px-2 py-1.5 font-semibold">Placa</th>
                        <th className="px-2 py-1.5 font-semibold">Tipo</th>
                        <th className="px-2 py-1.5 font-semibold hidden sm:table-cell">Modelo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.veiculosHistorico.map((v, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {v.data_v || v.data_viagem || "—"}
                            {v.hora_viagem ? ` ${v.hora_viagem}` : ""}
                          </td>
                          <td className="px-2 py-1.5 font-bold text-slate-900">{v.placa || "—"}</td>
                          <td className="px-2 py-1.5">{v.tipo || "—"}</td>
                          <td className="px-2 py-1.5 hidden sm:table-cell text-slate-600">{v.modelo || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {(() => {
              const ok = matchAgencyStopKey(selected.item.COLETA);
              const dk = matchAgencyStopKey(selected.item.ENTREGA);
              if (!ok || !dk) return null;
              return (
                <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50/50">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                    Rota típica (histórico agregado)
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mt-1">
                    {ok} → {dk}
                  </div>
                  {routePattern && routePattern.variants.length > 1 ? (
                    <div className="mt-2">
                      <label className="text-[10px] text-slate-500 uppercase block mb-0.5">Itinerário (variante)</label>
                      <select
                        className="w-full rounded-lg bg-white border border-slate-200 px-2 py-1.5 text-xs"
                        value={
                          routePatternVariantId ??
                          routePattern.selectedVariantId ??
                          routePattern.variants[0]?.variant_id ??
                          ""
                        }
                        onChange={(e) => setRoutePatternVariantId(Number(e.target.value))}
                      >
                        {routePattern.variants.map((v) => (
                          <option key={v.variant_id} value={v.variant_id}>
                            Variante {v.variant_id} — {v.trip_count} viagem(ns)
                            {v.is_primary ? " · principal" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {routePattern?.stats ? (
                    <div className="text-[11px] text-slate-600 mt-2 space-y-0.5">
                      <div>{routePattern.stats.trip_count} trecho(s) na variante seleccionada</div>
                      <div>
                        Tempo típico: ~{routePattern.stats.duration_p50_minutes} min (p90:{" "}
                        {routePattern.stats.duration_p90_minutes} min)
                      </div>
                      {routePattern.stats.computed_at ? (
                        <div className="text-slate-500">Calculado: {routePattern.stats.computed_at}</div>
                      ) : null}
                      {routePattern.variants.length === 1 && routePattern.variants[0]?.top_plates?.length ? (
                        <div className="text-slate-600 pt-1">
                          Placas frequentes:{" "}
                          {routePattern.variants[0].top_plates
                            .slice(0, 4)
                            .map((x) => `${x.plate} (${x.count})`)
                            .join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ) : routePattern && routePattern.polyline.length >= 2 ? (
                    <div className="text-[11px] text-slate-600 mt-2">Trajeto histórico no mapa (linha cinza tracejada).</div>
                  ) : (
                    <div className="text-[11px] text-amber-900 mt-2 leading-relaxed">
                      Ainda sem padrão para este par. Execute fora do Neon (baixo custo):{" "}
                      <code className="text-[10px] bg-white px-1 rounded border border-amber-200">
                        python scripts/compute_route_patterns.py
                      </code>{" "}
                      com <code className="text-[10px]">DATABASE_URL</code> no ambiente.
                    </div>
                  )}
                  {selected.routeProgress ? (
                    <div className="text-[11px] text-emerald-800 mt-2 space-y-0.5">
                      <div>
                        Progresso na rota típica: {Math.round(selected.routeProgress.fraction_along * 100)}%
                        {selected.routeProgress.eta_minutes_p50 != null
                          ? ` · ETA ~${selected.routeProgress.eta_minutes_p50} min (p50 nesta variante)`
                          : null}
                      </div>
                      <div className="text-emerald-700/90">
                        {selected.routeProgress.total_km > 0
                          ? `~${selected.routeProgress.cumulative_km.toFixed(0)} / ${selected.routeProgress.total_km.toFixed(0)} km ao longo do traçado típico`
                          : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}

            {selected.tripLegs && selected.tripLegs.length > 1 ? (
              <div className="border border-slate-200 rounded-xl p-3 bg-amber-50/40">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-2">
                  Pernas / baldeação (histórico de vínculos)
                </div>
                <ul className="space-y-1 text-[11px] text-slate-700">
                  {selected.tripLegs.map((leg) => (
                    <li key={`${leg.leg_index}-${leg.starts_at}`} className="flex flex-wrap gap-x-2">
                      <span className="font-mono font-semibold">Perna {leg.leg_index + 1}</span>
                      <span>— início {leg.starts_at}</span>
                      {leg.ends_at ? <span className="text-slate-500">fim {leg.ends_at}</span> : <span className="text-emerald-700 font-medium">em curso</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Mapa Life</span>
                <button
                  type="button"
                  onClick={() => setShowMapModal(true)}
                  className="rounded-lg bg-[#2c348c] px-3 py-1.5 text-[11px] text-white hover:bg-[#243a7a]"
                >
                  Abrir mapa ampliado
                </button>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div>
                  <span className="text-slate-500">Veículo:</span>{" "}
                  <span className="font-semibold">
                    {selected.activeLink?.vehicle_id || selected.item.VEHICLE_ID || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Placa:</span>{" "}
                  <span className="font-semibold">{selected.activeLink?.plate || selected.item.PLATE || "—"}</span>
                </div>
                {mapExtraMarkers.length ? (
                  <div className="text-emerald-700 font-medium">
                    {mapExtraMarkers.length} ponto(s) com GPS na timeline (verdes no mapa).
                  </div>
                ) : null}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-2">
              <OperationalMap
                trail={selected.trail || []}
                fallbackPoint={
                  selected.item.LAST_LAT != null && selected.item.LAST_LNG != null
                    ? {
                        lat: Number(selected.item.LAST_LAT),
                        lng: Number(selected.item.LAST_LNG),
                        label: selected.item.LAST_POSITION_AT || "Última posição",
                      }
                    : null
                }
                extraMarkers={mapExtraMarkers}
                heightPx={220}
                referencePolyline={routePattern?.polyline?.length ? routePattern.polyline : null}
                bearingDeg={
                  selected.routeProgress?.bearing_trail_deg ?? selected.routeProgress?.bearing_route_deg ?? null
                }
                progressPoint={
                  selected.routeProgress &&
                  Number.isFinite(selected.routeProgress.projected_lat) &&
                  Number.isFinite(selected.routeProgress.projected_lng)
                    ? {
                        lat: selected.routeProgress.projected_lat,
                        lng: selected.routeProgress.projected_lng,
                      }
                    : null
                }
                waypoints={routePattern?.waypoints?.length ? routePattern.waypoints : null}
              />
              <div className="text-[10px] text-slate-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 px-0.5">
                <span>Tracejado cinza: itinerário típico</span>
                <span className="text-[#2c348c]">Linha azul: trilha GPS</span>
                <span className="text-amber-700">Ponto âmbar: progresso na rota típica</span>
                <span className="text-blue-700">Azul claro: paragens O/D</span>
              </div>
            </div>

            {canManage && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Vínculo CTE/MDF-e → veículo</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs"
                    value={linkVehicleId}
                    onChange={(e) => setLinkVehicleId(e.target.value)}
                    placeholder="vehicleId (ex: 10000 (44) LD)"
                  />
                  <input
                    className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs uppercase"
                    value={linkPlate}
                    onChange={(e) => setLinkPlate(e.target.value.toUpperCase())}
                    placeholder="placa"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs"
                    value={linkMdf}
                    onChange={(e) => setLinkMdf(e.target.value)}
                    placeholder="MDF-e"
                  />
                  <select
                    className="rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs"
                    value={linkReason}
                    onChange={(e) => setLinkReason(e.target.value)}
                  >
                    <option value="BALDEACAO">Baldeação</option>
                    <option value="CORRECAO">Correção</option>
                    <option value="INICIO_VIAGEM">Início de viagem</option>
                  </select>
                </div>
                <textarea
                  className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-xs"
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  placeholder="Observação da troca (opcional)"
                />
                <button
                  type="button"
                  onClick={handleSaveLink}
                  disabled={isLinking || (!linkVehicleId.trim() && !linkPlate.trim())}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#2c348c] px-3 py-2 text-xs text-white disabled:opacity-50"
                >
                  {isLinking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {isLinking ? "Salvando vínculo..." : "Salvar vínculo / baldeação"}
                </button>
              </div>
            )}

            {selected.stops?.length ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Paradas</span>
                  <span className="text-[11px] text-slate-600">{selected.stops.length}</span>
                </div>
                <div className="space-y-2">
                  {selected.stops.slice(0, 6).map((s, idx) => (
                    <div key={`${s.stop_name}-${idx}`} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{s.stop_name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{s.at}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openMapsForStop(selected.item, s)}
                        className="rounded-lg border border-[#2c348c]/40 bg-[#2c348c] px-2 py-1 text-[11px] text-white hover:bg-[#243a7a]"
                      >
                        Mapa
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Timeline */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 order-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Eventos</span>
                <span className="text-[11px] text-slate-600">{selected.timeline.length}</span>
              </div>
              {timelineEmpty ? (
                <div className="text-[11px] text-slate-600">Nenhum evento ainda.</div>
              ) : (
                <div className="space-y-3">
                  {selected.timeline.slice(0, 18).map((t) => (
                    <div key={t.id} className="border border-slate-200 rounded-xl p-3 bg-white transition-colors hover:bg-slate-50/80">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {t.source === "NOTA" ? "Nota" : t.source === "EVENTO_MANUAL" ? "Atualização manual" : "Processo"}
                          </div>
                          <div className="text-[11px] text-slate-500">{t.time}</div>
                        </div>
                        {t.option ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 whitespace-nowrap">
                            {t.option}
                          </span>
                        ) : null}
                      </div>

                      {t.bus_name ? (
                        <div className="text-[11px] text-slate-600 mt-2">
                          <span className="text-slate-500">Ônibus:</span> {t.bus_name}
                        </div>
                      ) : null}
                      {t.stop_name ? (
                        <div className="text-[11px] text-slate-600 mt-1">
                          <span className="text-slate-500">Parada:</span> {t.stop_name}
                        </div>
                      ) : null}
                      {t.location_text ? (
                        <div className="text-[11px] text-slate-600 mt-1">
                          <span className="text-slate-500">Local:</span> {t.location_text}
                        </div>
                      ) : null}

                      {t.observation ? (
                        <div className="text-[11px] text-slate-700 mt-2 whitespace-pre-wrap">{t.observation}</div>
                      ) : null}

                      {t.photos?.length ? (
                        <div className="mt-3">
                          <div className="text-[11px] text-slate-500 mb-2">Fotos</div>
                          <div className="flex flex-wrap gap-2">
                            {t.photos.slice(0, 6).map((url, idx) => (
                              <a
                                key={`${url}-${idx}`}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden"
                              >
                                {isGoogleDriveUrl(url) ? (
                                  <iframe
                                    title="Drive preview"
                                    loading="lazy"
                                    className="w-16 h-16"
                                    src={`https://drive.google.com/file/d/${getFileIdFromUrl(url)}/preview`}
                                  />
                                ) : (
                                  <img src={url} alt="foto" className="w-full h-full object-cover" />
                                )}
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form manual */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 order-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Atualização Manual</span>
                {!canManage ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                    Sem permissão
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                    Agência
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("ROTA")}
                  className={clsx(
                    "flex-1 px-3 py-2 text-xs rounded-lg border transition-colors",
                    mode === "ROTA" ? "border-[#2c348c]/40 bg-[#2c348c] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  )}
                  disabled={!canManage}
                >
                  Rota / ônibus
                </button>
                <button
                  type="button"
                  onClick={() => setMode("DESCARGA")}
                  className={clsx(
                    "flex-1 px-3 py-2 text-xs rounded-lg border transition-colors",
                    mode === "DESCARGA" ? "border-[#2c348c]/40 bg-[#2c348c] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  )}
                  disabled={!canManage}
                >
                  Descer carga
                </button>
              </div>

              {mode === "ROTA" ? (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Ação</label>
                    <select
                      value={rotaAction}
                      onChange={(e) => setRotaAction(e.target.value as RotaAction)}
                      className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
                      disabled={!canManage}
                    >
                      <option value="OBSERVACAO_GERAL">Observação geral</option>
                      <option value="MUDOU_ONIBUS">Mudou de ônibus</option>
                      <option value="QUEBROU_ATRASOU">Quebrou / Atraso</option>
                      <option value="PASSOU_PARADA">Passou em parada</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Ônibus (opcional)</label>
                      <input
                        className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
                        value={busName}
                        onChange={(e) => setBusName(e.target.value)}
                        disabled={!canManage}
                        placeholder="Ex: Ônibus 17 / Placa"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Parada (opcional)</label>
                      <input
                        className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
                        value={stopName}
                        onChange={(e) => setStopName(e.target.value)}
                        disabled={!canManage}
                        placeholder="Ex: Terminal Recife"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Local (opcional)</label>
                    <input
                      className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
                      value={locationText}
                      onChange={(e) => setLocationText(e.target.value)}
                      disabled={!canManage}
                      placeholder="Ex: Bairro / Cidade / Rodovia"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Status do descarregamento</label>
                    <select
                      value={descStatus}
                      onChange={(e) => setDescStatus(e.target.value as DescargaStatus)}
                      className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
                      disabled={!canManage}
                    >
                      <option value="RECEBIDO">Recebido</option>
                      <option value="EXTRAVIADO">Extraviado</option>
                      <option value="DANIFICADO">Danificada / Avariada</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Ônibus (opcional)</label>
                      <input
                        className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
                        value={busName}
                        onChange={(e) => setBusName(e.target.value)}
                        disabled={!canManage}
                        placeholder="Ex: Ônibus 17 / Placa"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Destino (rodoviária)</label>
                      <select
                        value={destinoSelectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__CUSTOM__") return;
                          setStopName(v);
                          setLocationText(v);
                        }}
                        className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
                        disabled={!canManage}
                      >
                        <option value="">Selecione</option>
                        {DESTINO_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                        <option value="__CUSTOM__">Outro (digitar)</option>
                      </select>

                      {destinoSelectValue === "__CUSTOM__" && (
                        <input
                          className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40"
                          value={stopName}
                          onChange={(e) => {
                            setStopName(e.target.value);
                            setLocationText(e.target.value);
                          }}
                          disabled={!canManage}
                          placeholder="Digite o destino"
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Observação</label>
                <textarea
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#2c348c]/25 focus:border-[#2c348c]/40 min-h-[72px] resize-none"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  disabled={!canManage}
                  placeholder="Descreva o que aconteceu (quebrou, mudou ônibus, descer carga, etc)..."
                />
              </div>

              {/* Photos */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide inline-flex items-center gap-2">
                  <Camera size={14} />
                  Fotos da carga (opcional)
                </label>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={(e) => handlePickPhotos(e.target.files)}
                    className="hidden"
                    disabled={!canManage}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!canManage}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs text-slate-700 transition-colors hover:bg-slate-100"
                  >
                    <Camera size={14} />
                    Escolher / Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canManage) return;
                      setPhotos([]);
                      setUploadedPhotoUrls([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    disabled={!canManage || isUploading || photos.length === 0}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Limpar
                  </button>
                </div>
                {photos.length > 0 && (
                  <div className="mt-2 text-[11px] text-slate-500">
                    {photos.length} foto(s) selecionada(s). Upload ocorrerá ao salvar.
                  </div>
                )}

                {uploadedPhotoUrls.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uploadedPhotoUrls.slice(0, 6).map((url, idx) => (
                      <a
                        key={`${url}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white border border-slate-200 overflow-hidden"
                      >
                        {isGoogleDriveUrl(url) ? (
                          <iframe
                            title="Drive preview"
                            loading="lazy"
                            className="w-16 h-16"
                            src={`https://drive.google.com/file/d/${getFileIdFromUrl(url)}/preview`}
                          />
                        ) : (
                          <img src={url} alt="foto" className="w-full h-full object-cover" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                  disabled={!canManage || isSaving || isUploading}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvent}
                  disabled={!canManage || isSaving || isUploading || !selected.item.CTE}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#2c348c] px-3 py-2 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#e42424] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {isSaving ? "Salvando..." : "Salvar evento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMapModal && selected && (
        <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[1px] flex items-center justify-center p-3">
          <div className="w-full max-w-6xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  Mapa operacional — {selected.item.CTE}/{selected.item.SERIE}
                </h3>
                <p className="text-[11px] text-slate-500 truncate">
                  Veículo: {selected.item.VEHICLE_ID || "—"} | Placa: {selected.item.PLATE || "—"} | MDF-e:{" "}
                  {selected.item.MDF || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(false)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                Fechar mapa
              </button>
            </div>
            <div className="p-3">
              <div className="rounded-xl overflow-hidden border border-slate-200">
                <div style={{ minHeight: 520 }}>
                  <OperationalMap
                    trail={selected.trail || []}
                    fallbackPoint={
                      selected.item.LAST_LAT != null && selected.item.LAST_LNG != null
                        ? {
                            lat: Number(selected.item.LAST_LAT),
                            lng: Number(selected.item.LAST_LNG),
                            label: selected.item.LAST_POSITION_AT || "Última posição",
                          }
                        : null
                    }
                    extraMarkers={mapExtraMarkers}
                    heightPx={500}
                    referencePolyline={routePattern?.polyline?.length ? routePattern.polyline : null}
                    bearingDeg={
                      selected.routeProgress?.bearing_trail_deg ?? selected.routeProgress?.bearing_route_deg ?? null
                    }
                    progressPoint={
                      selected.routeProgress &&
                      Number.isFinite(selected.routeProgress.projected_lat) &&
                      Number.isFinite(selected.routeProgress.projected_lng)
                        ? {
                            lat: selected.routeProgress.projected_lat,
                            lng: selected.routeProgress.projected_lng,
                          }
                        : null
                    }
                    waypoints={routePattern?.waypoints?.length ? routePattern.waypoints : null}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationalTracking;

