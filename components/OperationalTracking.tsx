import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Search, Plus, Camera, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
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
  LAST_UPDATE_AT: string;
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
  photos?: string[];
};

type TrackingDetail = {
  item: TrackingItem;
  timeline: TimelineEntry[];
  stops: Array<{
    stop_name: string;
    bus_name: string | null;
    location_text: string | null;
    at: string;
  }>;
};

type EventMode = "ROTA" | "DESCARGA";
type RotaAction = "MUDOU_ONIBUS" | "QUEBROU_ATRASOU" | "PASSOU_PARADA" | "OBSERVACAO_GERAL";
type DescargaStatus = "RECEBIDO" | "EXTRAVIADO" | "DANIFICADO" | "OUTRO";

const googleMapsSearchUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

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

interface Props {
  initialCte?: string | null;
  initialSerie?: string | null;
}

const OperationalTracking: React.FC<Props> = ({ initialCte, initialSerie }) => {
  const { user } = useAuth();
  const { hasPermission } = useData();

  const [loadingItems, setLoadingItems] = useState(false);
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);

  const [q, setQ] = useState("");
  const [unit, setUnit] = useState("");

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

      const resp = await fetch(`/api/operational_tracking/items?${usp.toString()}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setItems(Array.isArray(data.data) ? data.data : []);
      setTotal(data.total || 0);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchItems();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, unit, page, limit]);

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

  const handleOpenMapsForList = async (i: TrackingItem) => {
    const data = await fetchDetail(i.CTE, i.SERIE);
    if (data) openMapsForItem(data);
  };

  const openMapsForItem = (arg: TrackingItem | TrackingDetail) => {
    const origin = extractMainLocation("item" in arg ? arg.item.COLETA : arg.COLETA);
    const destination = extractMainLocation("item" in arg ? arg.item.ENTREGA : arg.ENTREGA);
    const waypoints =
      "item" in arg ? arg.stops?.map((s) => extractMainLocation(s.stop_name)).filter(Boolean) : [];

    if (origin && destination) {
      window.open(
        googleMapsDirectionsUrl({ origin, destination, waypoints, travelMode: "transit" }),
        "_blank"
      );
      return;
    }

    // Fallback: tenta link fixo por destino
    const destRaw = "item" in arg ? arg.item.ENTREGA : arg.ENTREGA;
    const destLink = getMapsUrlForDestination(destRaw);
    if (destLink) return window.open(destLink, "_blank");

    const originRaw = "item" in arg ? arg.item.COLETA : arg.COLETA;
    const destForSearch = "item" in arg ? arg.item.ENTREGA : arg.ENTREGA;
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

  const timelineEmpty = !selected?.timeline?.length;

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#0F103A] p-2 text-[#EC1B23] border border-[#1A1B62] shadow-[0_0_18px_rgba(236,27,35,0.4)]">
            <MapPin size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black">Rastreio Operacional</h1>
            <p className="text-xs text-gray-400">Acompanhamento estilo “Em Busca” com timeline e atualização manual.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchItems()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A1B62] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(26,27,98,0.7)] hover:bg-[#EC1B23] transition-all"
            disabled={loadingItems}
          >
            {loadingItems ? <Loader2 size={14} className="animate-spin" /> : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Filtros (cards, sem tabela) */}
      <div className="bg-[#070A20] border border-[#1E226F] rounded-2xl p-3 shadow-[0_0_22px_rgba(0,0,0,0.6)]">
        <div className="flex flex-col md:flex-row md:items-center md:gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-gray-400" size={18} />
            </div>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por CTE, série, destino, coleta, destinatário e rastreio..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#080816] border border-[#1A1B62] text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="appearance-none rounded-xl bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
            >
              <option value="">Todas unidades</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                setPage(1);
                fetchItems();
              }}
              className="px-4 py-2 text-xs rounded-xl bg-[#1A1B62] text-white font-semibold hover:bg-[#0F1440]"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>

      {/* Lista de rastreios */}
      <div className="flex flex-col gap-3">
        {items.length === 0 && !loadingItems && (
          <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 text-gray-300 text-sm">
            Nenhum rastreio encontrado para os filtros.
          </div>
        )}

        {items.map((i) => (
          <div
            key={`${i.CTE}-${i.SERIE}`}
            className="bg-[#070A20] border border-[#1E226F] rounded-2xl p-4 shadow-[0_0_18px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-lg bg-[#0F103A] border border-[#1A1B62] text-gray-200">
                    {i.CTE} / {i.SERIE}
                  </span>
                  {i.STATUS_CALCULADO && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#080816] border border-[#1A1B62] text-gray-200">
                      {i.STATUS_CALCULADO}
                    </span>
                  )}
                </div>

                <div className="mt-2 text-xs text-gray-300 space-y-1">
                  <div>
                    <span className="text-gray-400">Coleta:</span> <span className="font-semibold">{i.COLETA || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Destino:</span> <span className="font-semibold">{i.ENTREGA || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Cliente:</span> <span className="font-semibold">{i.DESTINATARIO || "—"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Última atualização:</span>{" "}
                    <span className="font-semibold">{i.LAST_UPDATE_AT || "—"}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => fetchDetail(i.CTE, i.SERIE)}
                  className="px-4 py-2 text-xs rounded-xl bg-[#1A1B62] text-white font-semibold hover:bg-[#0F1440] border border-[#2B2F8F]"
                >
                  Abrir rastreio
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenMapsForList(i)}
                  className="px-3 py-2 text-xs rounded-xl bg-[#080816] text-gray-100 font-semibold hover:bg-[#0F1440] border border-[#1A1B62] inline-flex items-center gap-2"
                >
                  <MapPin size={14} />
                  Mapa
                </button>
              </div>
            </div>
          </div>
        ))}

        {loadingDetail && selected && (
          <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 text-gray-300 text-sm">
            Carregando detalhe...
          </div>
        )}

        {/* Pagination simples */}
        {total > limit && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              type="button"
              className="px-3 py-1 rounded-xl bg-[#080816] border border-[#1A1B62] text-xs text-gray-200 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <div className="text-xs text-gray-300">
              Página {page} (total: {total})
            </div>
            <button
              type="button"
              className="px-3 py-1 rounded-xl bg-[#080816] border border-[#1A1B62] text-xs text-gray-200 disabled:opacity-40"
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
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[380px] md:w-[450px] bg-[#070A20] border-l border-[#1E226F] shadow-[0_0_40px_rgba(0,0,0,0.92)] flex flex-col">
          <div className="px-4 py-3 border-b border-[#1A1B62] flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white truncate">
                {selected.item.CTE} / {selected.item.SERIE}
              </h2>
              <p className="text-[11px] text-gray-400 truncate">
                {selected.item.COLETA} &rarr; {selected.item.ENTREGA}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-white text-xs"
            >
              Fechar
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Mapa</span>
                <button
                  type="button"
                  onClick={() => openMapsForItem(selected)}
                  className="px-3 py-1.5 text-[11px] rounded-lg bg-[#1A1B62] text-white hover:bg-[#0F1440]"
                >
                  Abrir destino
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-300">
                <div>
                  <span className="text-gray-400">Cliente:</span> <span className="font-semibold">{selected.item.DESTINATARIO || "—"}</span>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span> <span className="font-semibold">{selected.item.STATUS_CALCULADO || "—"}</span>
                </div>
              </div>
            </div>

            {selected.stops?.length ? (
              <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Paradas</span>
                  <span className="text-[11px] text-gray-500">{selected.stops.length}</span>
                </div>
                <div className="space-y-2">
                  {selected.stops.slice(0, 6).map((s, idx) => (
                    <div key={`${s.stop_name}-${idx}`} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{s.stop_name}</div>
                        <div className="text-[11px] text-gray-400 truncate">{s.at}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openMapsForStop(selected.item, s)}
                        className="px-2 py-1 text-[11px] rounded-lg bg-[#1A1B62] text-white hover:bg-[#0F1440] border border-[#2B2F8F]"
                      >
                        Mapa
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Timeline */}
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-2 order-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Eventos</span>
                <span className="text-[11px] text-gray-500">{selected.timeline.length}</span>
              </div>
              {timelineEmpty ? (
                <div className="text-[11px] text-gray-500">Nenhum evento ainda.</div>
              ) : (
                <div className="space-y-3">
                  {selected.timeline.slice(0, 18).map((t) => (
                    <div key={t.id} className="border border-[#1A1B62] rounded-xl p-3 bg-[#070A20]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {t.source === "NOTA" ? "Nota" : t.source === "EVENTO_MANUAL" ? "Atualização manual" : "Processo"}
                          </div>
                          <div className="text-[11px] text-gray-400">{t.time}</div>
                        </div>
                        {t.option ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#080816] border border-[#1A1B62] text-gray-200 whitespace-nowrap">
                            {t.option}
                          </span>
                        ) : null}
                      </div>

                      {t.bus_name ? (
                        <div className="text-[11px] text-gray-300 mt-2">
                          <span className="text-gray-400">Ônibus:</span> {t.bus_name}
                        </div>
                      ) : null}
                      {t.stop_name ? (
                        <div className="text-[11px] text-gray-300 mt-1">
                          <span className="text-gray-400">Parada:</span> {t.stop_name}
                        </div>
                      ) : null}
                      {t.location_text ? (
                        <div className="text-[11px] text-gray-300 mt-1">
                          <span className="text-gray-400">Local:</span> {t.location_text}
                        </div>
                      ) : null}

                      {t.observation ? (
                        <div className="text-[11px] text-gray-200 mt-2 whitespace-pre-wrap">{t.observation}</div>
                      ) : null}

                      {t.photos?.length ? (
                        <div className="mt-3">
                          <div className="text-[11px] text-gray-400 mb-2">Fotos</div>
                          <div className="flex flex-wrap gap-2">
                            {t.photos.slice(0, 6).map((url, idx) => (
                              <a
                                key={`${url}-${idx}`}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#070A20] border border-[#1A1B62] overflow-hidden"
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
            <div className="bg-[#080816] border border-[#1A1B62] rounded-xl p-3 space-y-3 order-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Atualização Manual</span>
                {!canManage ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/30 text-red-200 border border-red-500/50">
                    Sem permissão
                  </span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0F103A] text-gray-200 border border-[#1A1B62]">
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
                    mode === "ROTA" ? "bg-[#1A1B62] border-[#2B2F8F] text-white" : "bg-[#070A20] border-[#1A1B62] text-gray-200 hover:bg-[#0F1440]"
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
                    mode === "DESCARGA" ? "bg-[#1A1B62] border-[#2B2F8F] text-white" : "bg-[#070A20] border-[#1A1B62] text-gray-200 hover:bg-[#0F1440]"
                  )}
                  disabled={!canManage}
                >
                  Descer carga
                </button>
              </div>

              {mode === "ROTA" ? (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Ação</label>
                    <select
                      value={rotaAction}
                      onChange={(e) => setRotaAction(e.target.value as RotaAction)}
                      className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
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
                      <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Ônibus (opcional)</label>
                      <input
                        className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                        value={busName}
                        onChange={(e) => setBusName(e.target.value)}
                        disabled={!canManage}
                        placeholder="Ex: Ônibus 17 / Placa"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Parada (opcional)</label>
                      <input
                        className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                        value={stopName}
                        onChange={(e) => setStopName(e.target.value)}
                        disabled={!canManage}
                        placeholder="Ex: Terminal Recife"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Local (opcional)</label>
                    <input
                      className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
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
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Status do descarregamento</label>
                    <select
                      value={descStatus}
                      onChange={(e) => setDescStatus(e.target.value as DescargaStatus)}
                      className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
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
                      <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Ônibus (opcional)</label>
                      <input
                        className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
                        value={busName}
                        onChange={(e) => setBusName(e.target.value)}
                        disabled={!canManage}
                        placeholder="Ex: Ônibus 17 / Placa"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Destino (rodoviária)</label>
                      <select
                        value={destinoSelectValue}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__CUSTOM__") return;
                          setStopName(v);
                          setLocationText(v);
                        }}
                        className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-2 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
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
                          className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23]"
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
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide">Observação</label>
                <textarea
                  className="mt-1 w-full rounded-lg bg-[#080816] border border-[#1A1B62] px-3 py-2 text-xs text-gray-100 outline-none focus:ring-1 focus:ring-[#EC1B23] min-h-[72px] resize-none"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  disabled={!canManage}
                  placeholder="Descreva o que aconteceu (quebrou, mudou ônibus, descer carga, etc)..."
                />
              </div>

              {/* Photos */}
              <div>
                <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wide inline-flex items-center gap-2">
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
                    className="px-4 py-2 text-xs rounded-lg bg-[#070A20] border border-[#1E226F] text-gray-200 hover:bg-[#0F1440] transition-colors inline-flex items-center gap-2"
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
                    className="px-4 py-2 text-xs rounded-lg bg-red-900/30 border border-red-500/40 text-red-200 hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Limpar
                  </button>
                </div>
                {photos.length > 0 && (
                  <div className="mt-2 text-[11px] text-gray-400">
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
                        className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[#070A20] border border-[#1A1B62] overflow-hidden"
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
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-[#070A20] border border-[#1A1B62] text-gray-200 hover:bg-[#0F1440]"
                  disabled={!canManage || isSaving || isUploading}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvent}
                  disabled={!canManage || isSaving || isUploading || !selected.item.CTE}
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-[#1A1B62] text-white font-semibold hover:bg-[#EC1B23] shadow-[0_0_18px_rgba(26,27,98,0.7)] transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {isSaving ? "Salvando..." : "Salvar evento"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationalTracking;

