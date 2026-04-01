import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DataTable from "./DataTable";
import IndemnificationModal from "./IndemnificationModal";
import { CteData } from "../types";
import { authClient } from "../lib/auth";
import {
  FolderOpen,
  FileText,
  RefreshCw,
  Scale,
  HandCoins,
  ChevronRight,
  Loader2,
  ExternalLink,
  Mail,
  Bell,
  Clock,
} from "lucide-react";

type Props = {
  data: CteData[];
  onNoteClick: (cte: CteData) => void;
  hasDossieView?: boolean;
  hasFinanceAttach?: boolean;
  serverPagination: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
  };
};

type HubTab = "OCORRENCIAS" | "INDENIZACOES" | "DOSSIE";

type DossierFolderKey = "resumo" | "timeline" | "ocorrencias" | "notas" | "processo" | "pdf";

const occurrenceStatusTone = (status: string) => {
  const s = String(status || "").toUpperCase();
  if (s === "ABERTA") return "bg-amber-50 border-amber-200 text-amber-800";
  if (s === "EM_INDENIZACAO") return "bg-orange-50 border-orange-200 text-orange-800";
  if (s === "EM_DOSSIE") return "bg-indigo-50 border-indigo-200 text-indigo-800";
  if (s.includes("ENCERR") || s === "RESOLVIDA") return "bg-emerald-50 border-emerald-200 text-emerald-800";
  return "bg-slate-50 border-slate-200 text-slate-700";
};

const indemStatusTone = (status: string) => {
  const s = String(status || "").toUpperCase();
  if (s === "ATIVA" || s === "EM_ANALISE") return "bg-amber-50 border-amber-200 text-amber-800";
  if (s === "PAGA" || s === "ENCERRADA") return "bg-emerald-50 border-emerald-200 text-emerald-800";
  if (s === "NEGADA") return "bg-red-50 border-red-200 text-red-800";
  return "bg-slate-50 border-slate-200 text-slate-700";
};

const OcorrenciasHub: React.FC<Props> = ({ data, onNoteClick, serverPagination, hasDossieView = true, hasFinanceAttach = false }) => {
  const [tab, setTab] = useState<HubTab>("OCORRENCIAS");
  const [formalOccs, setFormalOccs] = useState<any[]>([]);
  const [occFilter, setOccFilter] = useState<string>("TODAS");
  const [loadingOccs, setLoadingOccs] = useState(false);
  const [occMsg, setOccMsg] = useState("");

  const [indemItems, setIndemItems] = useState<any[]>([]);
  const [indemFilter, setIndemFilter] = useState<string>("TODAS");
  const [loadingIndem, setLoadingIndem] = useState(false);
  const [indemMsg, setIndemMsg] = useState("");
  const [expandedIndem, setExpandedIndem] = useState<string | null>(null);
  const [indemModalId, setIndemModalId] = useState<string | null>(null);

  const [occNotifOpen, setOccNotifOpen] = useState(false);
  const [occNotifItems, setOccNotifItems] = useState<any[]>([]);
  const [occNotifUnread, setOccNotifUnread] = useState(0);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const [dossierList, setDossierList] = useState<any[]>([]);
  const [dossierSearch, setDossierSearch] = useState("");
  const [loadingDossiers, setLoadingDossiers] = useState(false);
  const [dossMsg, setDossMsg] = useState("");
  const [openDossierKey, setOpenDossierKey] = useState<string | null>(null);
  const [dossierDetail, setDossierDetail] = useState<any | null>(null);
  const [loadingDossierDetail, setLoadingDossierDetail] = useState(false);
  const [activeFolder, setActiveFolder] = useState<DossierFolderKey>("resumo");
  const [finalizeStatus, setFinalizeStatus] = useState("CONCLUIDO");
  const [syncPdfToDrive, setSyncPdfToDrive] = useState(false);
  const [finalizeMsg, setFinalizeMsg] = useState("");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [attachCategory, setAttachCategory] = useState("GERAL");
  const [attachLabel, setAttachLabel] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);

  const loadOccNotifications = useCallback(async () => {
    try {
      const resp = await authClient.getOcorrenciasNotifications({ limit: 25 });
      setOccNotifItems(Array.isArray(resp?.items) ? resp.items : []);
      setOccNotifUnread(Number(resp?.unreadCount || 0));
    } catch {
      setOccNotifItems([]);
      setOccNotifUnread(0);
    }
  }, []);

  useEffect(() => {
    if (tab !== "OCORRENCIAS" && tab !== "INDENIZACOES") return;
    loadOccNotifications();
    const id = window.setInterval(loadOccNotifications, 25000);
    return () => window.clearInterval(id);
  }, [tab, loadOccNotifications]);

  useEffect(() => {
    if (!hasDossieView && tab === "DOSSIE") setTab("OCORRENCIAS");
  }, [hasDossieView, tab]);

  useEffect(() => {
    if (!occNotifOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setOccNotifOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [occNotifOpen]);

  const ackOccNotifications = async () => {
    const ids = occNotifItems.map((i: any) => Number(i.id)).filter((n) => Number.isFinite(n));
    if (ids.length === 0) {
      setOccNotifOpen(false);
      return;
    }
    const maxId = Math.max(...ids);
    try {
      await authClient.ackOcorrenciasNotifications(maxId);
      await loadOccNotifications();
    } catch {
      /* noop */
    }
    setOccNotifOpen(false);
  };

  const loadFormalOccurrences = useCallback(async () => {
    setLoadingOccs(true);
    setOccMsg("");
    try {
      const r = await authClient.getOccurrences();
      setFormalOccs(Array.isArray(r.items) ? r.items : []);
    } catch (e: any) {
      setOccMsg(e?.message || "Falha ao carregar ocorrências formais.");
      setFormalOccs([]);
    } finally {
      setLoadingOccs(false);
    }
  }, []);

  const loadIndemnifications = useCallback(async () => {
    setLoadingIndem(true);
    setIndemMsg("");
    try {
      const r = await authClient.getIndemnifications();
      setIndemItems(Array.isArray(r.items) ? r.items : []);
    } catch (e: any) {
      setIndemMsg(e?.message || "Falha ao carregar indenizações.");
      setIndemItems([]);
    } finally {
      setLoadingIndem(false);
    }
  }, []);

  const loadDossierIndex = useCallback(async () => {
    setLoadingDossiers(true);
    setDossMsg("");
    try {
      const r = await authClient.listDossiers();
      setDossierList(Array.isArray(r.items) ? r.items : []);
    } catch (e: any) {
      setDossMsg(e?.message || "Falha ao listar dossiês.");
      setDossierList([]);
    } finally {
      setLoadingDossiers(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "OCORRENCIAS") loadFormalOccurrences();
  }, [tab, loadFormalOccurrences]);

  useEffect(() => {
    if (tab === "INDENIZACOES") loadIndemnifications();
  }, [tab, loadIndemnifications]);

  useEffect(() => {
    if (tab === "DOSSIE" && hasDossieView) loadDossierIndex();
  }, [tab, hasDossieView, loadDossierIndex]);

  const filteredOccs = useMemo(() => {
    if (occFilter === "TODAS") return formalOccs;
    return formalOccs.filter((o) => String(o.status || "").toUpperCase() === occFilter);
  }, [formalOccs, occFilter]);

  const filteredIndem = useMemo(() => {
    if (indemFilter === "TODAS") return indemItems;
    return indemItems.filter((i) => String(i.status || "").toUpperCase() === indemFilter);
  }, [indemItems, indemFilter]);

  const filteredDossierList = useMemo(() => {
    const q = dossierSearch.trim().toLowerCase();
    if (!q) return dossierList;
    return dossierList.filter(
      (d) =>
        String(d.cte || "")
          .toLowerCase()
          .includes(q) ||
        String(d.serie || "")
          .toLowerCase()
          .includes(q) ||
        String(d.title || "")
          .toLowerCase()
          .includes(q)
    );
  }, [dossierList, dossierSearch]);

  const encaminharOcorrencia = async (id: string, track: "INDENIZACAO" | "DOSSIE_DIRETO") => {
    setOccMsg("");
    try {
      await authClient.patchOccurrenceTrack({ id, track });
      setOccMsg(track === "INDENIZACAO" ? "Encaminhado para Indenizações." : "Dossiê direto registrado. Veja na aba Dossiê.");
      await loadFormalOccurrences();
      if (track === "INDENIZACAO") loadIndemnifications();
      if (track === "DOSSIE_DIRETO") loadDossierIndex();
    } catch (e: any) {
      setOccMsg(e?.message || "Não foi possível encaminhar.");
    }
  };

  const patchIndemStatus = async (id: string, status: string) => {
    setIndemMsg("");
    try {
      await authClient.patchIndemnification({ id, status });
      await loadIndemnifications();
    } catch (e: any) {
      setIndemMsg(e?.message || "Falha ao atualizar status.");
    }
  };

  const gerarDossieCte = async (cte: string, serie: string) => {
    if (!hasDossieView) {
      setIndemMsg("Seu perfil não tem permissão para o Dossiê. Solicite a permissão “Aba Operacional: Dossiê”.");
      return;
    }
    setIndemMsg("");
    try {
      await authClient.createDossier({ cte, serie: serie || "0" });
      setIndemMsg("Dossiê gerado/atualizado. Abra a aba Dossiê para ver as pastas.");
      loadDossierIndex();
    } catch (e: any) {
      setIndemMsg(e?.message || "Falha ao gerar dossiê.");
    }
  };

  const openDossierCard = async (row: any) => {
    const k = `${row.cte}::${row.serie || "0"}`;
    if (openDossierKey === k) {
      setOpenDossierKey(null);
      setDossierDetail(null);
      return;
    }
    setOpenDossierKey(k);
    setActiveFolder("resumo");
    setLoadingDossierDetail(true);
    setDossierDetail(null);
    try {
      const d = await authClient.getDossier(String(row.cte), String(row.serie || "0"));
      setDossierDetail(d);
    } catch (e: any) {
      setDossMsg(e?.message || "Falha ao abrir dossiê.");
    } finally {
      setLoadingDossierDetail(false);
    }
  };

  const refreshOpenDossier = async () => {
    if (!openDossierKey) return;
    const [cte, serie = "0"] = openDossierKey.split("::");
    setLoadingDossierDetail(true);
    try {
      const d = await authClient.getDossier(cte, serie);
      setDossierDetail(d);
    } catch (e: any) {
      setDossMsg(e?.message || "Falha ao atualizar dossiê.");
    } finally {
      setLoadingDossierDetail(false);
    }
  };

  const runFinalizeDossier = async (cte: string, serie: string) => {
    setFinalizeMsg("");
    try {
      await authClient.finalizeDossier({
        cte,
        serie: serie || "0",
        finalizationStatus: finalizeStatus,
        syncPdfToDrive,
      });
      setFinalizeMsg("Finalização registrada.");
      await refreshOpenDossier();
      loadDossierIndex();
    } catch (e: any) {
      setFinalizeMsg(e?.message || "Falha ao finalizar.");
    }
  };

  const uploadDossierFile = async (cte: string, serie: string, file: File | null) => {
    if (!file) return;
    setAttachBusy(true);
    setFinalizeMsg("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("cte", cte);
    fd.append("serie", serie || "0");
    fd.append("category", attachCategory);
    if (attachLabel.trim()) fd.append("label", attachLabel.trim());
    try {
      await authClient.uploadDossierAttachment(fd);
      setFinalizeMsg("Anexo enviado ao Drive do processo.");
      await refreshOpenDossier();
    } catch (e: any) {
      setFinalizeMsg(e?.message || "Falha no anexo (Drive ou permissão).");
    } finally {
      setAttachBusy(false);
    }
  };

  const sendDossieSmtp = async (cte: string, serie: string) => {
    setEmailBusy(true);
    setFinalizeMsg("");
    try {
      await authClient.sendDossieEmail({
        cte,
        serie: serie || "0",
        to: emailTo.trim(),
        subject: emailSubject.trim() || undefined,
      });
      setFinalizeMsg("E-mail com PDF enviado (SMTP).");
    } catch (e: any) {
      setFinalizeMsg(e?.message || "SMTP indisponível — use Baixar PDF e Outlook.");
    } finally {
      setEmailBusy(false);
    }
  };

  const pdfUrl = (cte: string, serie: string) =>
    `/api/dossie/pdf?cte=${encodeURIComponent(cte)}&serie=${encodeURIComponent(serie || "0")}`;

  const enviarOutlook = (cte: string, serie: string) => {
    const serieSafe = serie || "0";
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const pdf = `${baseUrl}${pdfUrl(cte, serieSafe)}`;
    const subject = `Dossiê operacional CTE ${cte} / Série ${serieSafe}`;
    const body = `Prezados,\n\nSegue o link do dossiê (PDF) do CTE ${cte} / Série ${serieSafe}:\n${pdf}\n\nAtenciosamente.`;
    window.open(
      `https://outlook.office.com/mail/deeplink/compose?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank"
    );
  };

  const folderBlocks: { key: DossierFolderKey; label: string; icon: React.ReactNode; hint: string }[] = [
    { key: "resumo", label: "Resumo", icon: <FileText size={18} />, hint: "Título, status e identificação do CTE" },
    { key: "timeline", label: "Linha do tempo", icon: <Clock size={18} />, hint: "Eventos do dossiê com data e hora" },
    { key: "ocorrencias", label: "Ocorrências", icon: <Scale size={18} />, hint: "Registros formais vinculados" },
    { key: "notas", label: "Notas / anexos", icon: <FileText size={18} />, hint: "Histórico de anotações" },
    { key: "processo", label: "Processo operacional", icon: <ChevronRight size={18} />, hint: "Linha do tempo em process_control" },
    { key: "pdf", label: "PDF, anexos e encerramento", icon: <Mail size={18} />, hint: "PDF, Drive, e-mail SMTP e finalização" },
  ];

  const formatDossierWhen = (d: string | null | undefined) => {
    if (!d) return "—";
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) return String(d);
    return t.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };

  const hubTabs = (
    [
      ["OCORRENCIAS", "Ocorrências"],
      ["INDENIZACOES", "Indenizações"],
      ...(hasDossieView ? ([["DOSSIE", "Dossiê"]] as const) : []),
    ] as const
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {hubTabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold border ${
              tab === id ? "bg-[#2c348c] text-white border-[#2c348c]" : "bg-white text-slate-700 border-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
        {(tab === "OCORRENCIAS" || tab === "INDENIZACOES") && (
          <div className="relative ml-auto" ref={notifRef}>
            <button
              type="button"
              onClick={() => setOccNotifOpen((v) => !v)}
              className="relative inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
              aria-label="Notificações de ocorrências e indenizações"
            >
              <Bell size={18} />
              {occNotifUnread > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">
                  {occNotifUnread > 99 ? "99+" : occNotifUnread}
                </span>
              ) : null}
            </button>
            {occNotifOpen && (
              <div className="absolute right-0 z-50 mt-1 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                  <span className="text-[11px] font-bold text-slate-700">Alertas operacionais</span>
                  <button type="button" onClick={ackOccNotifications} className="text-[10px] font-bold text-[#2c348c] underline">
                    Marcar como lidas
                  </button>
                </div>
                <ul className="max-h-64 overflow-y-auto py-1">
                  {occNotifItems.length === 0 ? (
                    <li className="px-3 py-2 text-[11px] text-slate-500">Nada novo por aqui.</li>
                  ) : (
                    occNotifItems.map((n: any) => (
                      <li key={n.id} className="border-b border-slate-50 px-3 py-2 text-[10px] text-slate-700">
                        <div className="font-bold text-slate-800">{n.event}</div>
                        <div className="text-slate-500">
                          {n.createdAt ? new Date(n.createdAt).toLocaleString("pt-BR") : ""}
                          {n.username ? ` · ${n.username}` : ""}
                        </div>
                        {n.cte ? (
                          <div className="font-mono text-[10px] mt-0.5">
                            CTE {n.cte}
                            {n.serie != null ? ` / ${n.serie}` : ""}
                          </div>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {indemModalId ? (
        <IndemnificationModal
          indemnificationId={indemModalId}
          onClose={() => setIndemModalId(null)}
          onUpdated={() => {
            loadIndemnifications();
            loadOccNotifications();
          }}
        />
      ) : null}

      {tab === "OCORRENCIAS" && (
        <>
          <DataTable
            title="Ocorrências Operacionais (CTEs)"
            data={data}
            onNoteClick={onNoteClick}
            enableFilters
            ignoreUnitFilter
            serverPagination={serverPagination}
          />

          <div className="surface-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Registro formal de ocorrências</p>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                  Após marcar <strong>OCORRÊNCIA</strong> no modal de anotações (ou pelo CRM), o caso aparece aqui com status{" "}
                  <strong>ABERTA</strong>. O próximo passo é escolher <em>uma</em> trilha: <strong>Indenização</strong> ou{" "}
                  <strong>Dossiê direto</strong> — não são etapas paralelas.
                </p>
              </div>
              <button
                type="button"
                onClick={loadFormalOccurrences}
                disabled={loadingOccs}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <RefreshCw size={14} className={loadingOccs ? "animate-spin" : ""} /> Atualizar
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {["TODAS", "ABERTA", "EM_INDENIZACAO", "EM_DOSSIE"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOccFilter(f)}
                  className={`rounded-full px-3 py-1 text-[10px] font-bold border ${
                    occFilter === f ? "bg-slate-800 text-white border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200"
                  }`}
                >
                  {f === "TODAS" ? "Todas" : f.replace(/_/g, " ")}
                </button>
              ))}
            </div>

            {occMsg && <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">{occMsg}</p>}

            {loadingOccs ? (
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="animate-spin" size={14} /> Carregando…
              </p>
            ) : filteredOccs.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum registro neste filtro.</p>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredOccs.map((o) => (
                  <div
                    key={o.id}
                    className={`rounded-xl border px-3 py-2.5 text-xs ${occurrenceStatusTone(o.status)}`}
                  >
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="font-mono font-bold">
                        CTE {o.cte} <span className="text-slate-500">/ série {o.serie || "0"}</span>
                      </div>
                      <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold bg-white/80">{o.status}</span>
                    </div>
                    <div className="mt-1 text-[11px] opacity-90">
                      <span className="font-bold text-violet-800">[{o.occurrence_type}]</span> {o.description}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-600">
                      {o.created_at ? new Date(o.created_at).toLocaleString("pt-BR") : ""}
                      {o.resolution_track ? ` · Trilha: ${o.resolution_track}` : ""}
                    </div>
                    {String(o.status || "").toUpperCase() === "ABERTA" && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => encaminharOcorrencia(o.id, "INDENIZACAO")}
                          className="inline-flex items-center gap-1 rounded border border-amber-400 bg-white px-2 py-1 text-[11px] font-bold text-amber-900"
                        >
                          <HandCoins size={14} /> Indenização
                        </button>
                        <button
                          type="button"
                          onClick={() => encaminharOcorrencia(o.id, "DOSSIE_DIRETO")}
                          className="inline-flex items-center gap-1 rounded border border-indigo-400 bg-white px-2 py-1 text-[11px] font-bold text-indigo-900"
                        >
                          <FolderOpen size={14} /> Dossiê direto
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "INDENIZACOES" && (
        <div className="surface-card p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Indenizações</p>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                Processo de ressarcimento ligado à ocorrência. Quando o caso estiver maduro juridicamente/financeiramente, a{" "}
                <strong>última etapa</strong> costuma ser consolidar tudo no <button type="button" className="text-[#2c348c] font-bold underline" onClick={() => setTab("DOSSIE")}>Dossiê</button> — documentação única para defesa e arquivo.
              </p>
            </div>
            <button
              type="button"
              onClick={loadIndemnifications}
              disabled={loadingIndem}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              <RefreshCw size={14} className={loadingIndem ? "animate-spin" : ""} /> Atualizar
            </button>
          </div>

          {indemMsg && <p className="text-xs text-slate-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">{indemMsg}</p>}

          <div className="flex flex-wrap gap-2">
            {["TODAS", "ATIVA", "EM_ANALISE", "PROPOSTA_ENVIADA", "ACORDO", "PAGA", "NEGADA", "ENCERRADA"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setIndemFilter(f)}
                className={`rounded-full px-3 py-1 text-[10px] font-bold border ${
                  indemFilter === f ? "bg-slate-800 text-white border-slate-800" : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                {f === "TODAS" ? "Todas" : f.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {loadingIndem ? (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Carregando indenizações…
            </p>
          ) : filteredIndem.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma indenização neste filtro.</p>
          ) : (
            <div className="space-y-2">
              {filteredIndem.map((row) => {
                const exp = expandedIndem === row.id;
                const cte = row.occurrence_cte || "";
                const serie = row.occurrence_serie || "0";
                return (
                  <div key={row.id} className={`rounded-xl border text-xs ${indemStatusTone(row.status)}`}>
                    <div className="flex flex-wrap items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => setExpandedIndem(exp ? null : row.id)}
                        className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/40 rounded-xl"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold">
                            CTE {cte} / {serie}
                          </span>
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-bold bg-white/70">{row.status}</span>
                          <span className="text-[10px] opacity-80">{row.occurrence_type}</span>
                        </div>
                        <ChevronRight size={16} className={exp ? "rotate-90 transition-transform shrink-0" : "transition-transform shrink-0"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIndemModalId(row.id)}
                        className="shrink-0 rounded-lg border border-violet-300 bg-violet-50 px-2 py-2 text-[10px] font-bold text-violet-900 self-center mr-1"
                      >
                        Fluxo
                      </button>
                    </div>
                    {exp && (
                      <div className="px-3 pb-3 pt-0 space-y-2 border-t border-white/50 bg-white/30 rounded-b-xl">
                        <p className="text-[11px] mt-2">{row.notes || "—"}</p>
                        {row.amount != null && (
                          <p className="text-[11px] font-bold">
                            Valor: {Number(row.amount).toLocaleString("pt-BR", { style: "currency", currency: row.currency || "BRL" })}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 items-center">
                          <label className="text-[10px] font-bold text-slate-600">Status:</label>
                          <select
                            value={row.status}
                            onChange={(e) => patchIndemStatus(row.id, e.target.value)}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px]"
                          >
                            {["ATIVA", "EM_ANALISE", "AGUARDANDO_DOC", "PROPOSTA_ENVIADA", "ACORDO", "PAGA", "NEGADA", "ENCERRADA"].map((s) => (
                              <option key={s} value={s}>
                                {s.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => gerarDossieCte(cte, serie)}
                            disabled={!hasDossieView}
                            className="rounded border border-indigo-300 bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-800 disabled:opacity-40"
                          >
                            Gerar / atualizar Dossiê (última etapa)
                          </button>
                          {hasDossieView ? (
                            <a
                              href={pdfUrl(cte, serie)}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700"
                            >
                              <ExternalLink size={12} /> PDF
                            </a>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "DOSSIE" && hasDossieView && (
        <div className="surface-card p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Dossiê</p>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                Etapa final de resguardo: uma visão por CTE/série. Clique em cada pasta para abrir o bloco (resumo, ocorrências,
                notas, processo, PDF). Quem veio só de <strong>dossiê direto</strong> na ocorrência também aparece aqui.
              </p>
            </div>
            <button
              type="button"
              onClick={loadDossierIndex}
              disabled={loadingDossiers}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
            >
              <RefreshCw size={14} className={loadingDossiers ? "animate-spin" : ""} /> Atualizar
            </button>
          </div>

          <input
            value={dossierSearch}
            onChange={(e) => setDossierSearch(e.target.value)}
            placeholder="Filtrar por CTE, série ou título…"
            className="w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />

          {dossMsg && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{dossMsg}</p>}

          {loadingDossiers ? (
            <p className="text-xs text-slate-500 flex items-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Carregando lista…
            </p>
          ) : filteredDossierList.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhum dossiê encontrado. Gere a partir de uma ocorrência (trilha direta) ou pela aba Indenizações.</p>
          ) : (
            <div className="space-y-2">
              {filteredDossierList.map((d) => {
                const key = `${d.cte}::${d.serie || "0"}`;
                const open = openDossierKey === key;
                return (
                  <div key={key} className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => openDossierCard(d)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200">
                        <FolderOpen size={22} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{d.title || `Dossiê ${d.cte}`}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          CTE {d.cte} · série {d.serie || "0"}
                          {d.updated_at ? ` · ${new Date(d.updated_at).toLocaleString("pt-BR")}` : ""}
                        </p>
                      </div>
                      <ChevronRight size={18} className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                    </button>

                    {open && (
                      <div className="border-t border-slate-200 bg-white px-4 py-3">
                        {loadingDossierDetail ? (
                          <p className="text-xs flex items-center gap-2 text-slate-500">
                            <Loader2 className="animate-spin" size={14} /> Abrindo pastas…
                          </p>
                        ) : dossierDetail ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {folderBlocks.map((fb) => (
                              <button
                                key={fb.key}
                                type="button"
                                onClick={() => setActiveFolder(fb.key)}
                                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                                  activeFolder === fb.key
                                    ? "border-[#2c348c] bg-[#f0f1fb] shadow-sm"
                                    : "border-slate-200 bg-slate-50 hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-center gap-2 text-slate-800">
                                  {fb.icon}
                                  <span className="text-xs font-bold">{fb.label}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 leading-snug">{fb.hint}</span>
                              </button>
                            ))}
                          </div>
                        ) : null}

                        {dossierDetail && !loadingDossierDetail && (
                          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 max-h-[340px] overflow-y-auto">
                            {activeFolder === "resumo" && (
                              <div className="space-y-1">
                                <p>
                                  <strong>Título:</strong> {dossierDetail.dossier?.title || d.title}
                                </p>
                                <p>
                                  <strong>Status:</strong> {dossierDetail.dossier?.status || "—"}
                                </p>
                                <p>
                                  <strong>Gerado por:</strong> {dossierDetail.dossier?.generated_by || "—"}
                                </p>
                                {dossierDetail.dossier?.finalization_status ? (
                                  <p>
                                    <strong>Finalização:</strong> {dossierDetail.dossier.finalization_status}
                                    {dossierDetail.dossier.finalized_at
                                      ? ` · ${formatDossierWhen(dossierDetail.dossier.finalized_at)}`
                                      : ""}
                                  </p>
                                ) : null}
                                {dossierDetail.dossier?.pdf_drive_file_id ? (
                                  <p>
                                    <strong>PDF no Drive:</strong>{" "}
                                    <a
                                      href={`https://drive.google.com/file/d/${dossierDetail.dossier.pdf_drive_file_id}/view`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[#2c348c] font-bold underline"
                                    >
                                      abrir
                                    </a>
                                  </p>
                                ) : null}
                              </div>
                            )}
                            {activeFolder === "timeline" && (
                              <div className="space-y-3">
                                <p className="text-[10px] text-slate-500">
                                  Eventos registrados no dossiê (ordenados do mais recente ao mais antigo).
                                </p>
                                <ul className="space-y-2">
                                  {(dossierDetail.dossierEvents || []).length === 0 ? (
                                    <li className="text-slate-500">Nenhum evento ainda.</li>
                                  ) : (
                                    (dossierDetail.dossierEvents || []).map((ev: any, idx: number) => (
                                      <li key={ev.id || idx} className="rounded border border-slate-200 bg-white p-2">
                                        <div className="font-bold">
                                          {ev.event_type}{" "}
                                          <span className="font-normal text-slate-500">
                                            · {formatDossierWhen(ev.event_date)}
                                          </span>
                                        </div>
                                        {ev.actor ? <div className="text-[10px] text-slate-600">Por: {ev.actor}</div> : null}
                                        <div className="text-[11px] mt-0.5">{ev.description}</div>
                                      </li>
                                    ))
                                  )}
                                </ul>
                                <div>
                                  <p className="font-bold text-[11px] mb-1">Anexos do processo</p>
                                  <ul className="space-y-1">
                                    {(dossierDetail.attachments || []).length === 0 ? (
                                      <li className="text-slate-500">Nenhum anexo.</li>
                                    ) : (
                                      (dossierDetail.attachments || []).map((at: any, idx: number) => (
                                        <li key={at.id || idx} className="text-[11px]">
                                          <span className="rounded bg-slate-100 px-1 font-bold">{at.category}</span>{" "}
                                          {at.label || "arquivo"}{" "}
                                          {at.url ? (
                                            <a href={at.url} target="_blank" rel="noreferrer" className="text-[#2c348c] underline font-bold">
                                              abrir
                                            </a>
                                          ) : null}
                                          <span className="text-slate-400"> · {formatDossierWhen(at.created_at)}</span>
                                        </li>
                                      ))
                                    )}
                                  </ul>
                                </div>
                              </div>
                            )}
                            {activeFolder === "ocorrencias" && (
                              <ul className="space-y-2">
                                {(dossierDetail.occurrences || []).length === 0 ? (
                                  <li>Nenhuma ocorrência vinculada.</li>
                                ) : (
                                  (dossierDetail.occurrences || []).map((o: any, idx: number) => (
                                    <li key={o.id || idx} className="rounded border border-slate-200 bg-white p-2">
                                      <span className="font-bold text-violet-800">[{o.occurrence_type}]</span> {o.status}
                                      <div className="text-[11px] mt-1">{o.description}</div>
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                            {activeFolder === "notas" && (
                              <ul className="space-y-2">
                                {(dossierDetail.notes || []).length === 0 ? (
                                  <li>Sem notas.</li>
                                ) : (
                                  (dossierDetail.notes || []).slice(0, 40).map((n: any, idx: number) => (
                                    <li key={n.id || idx} className="rounded border border-slate-200 bg-white p-2">
                                      <div className="text-[10px] text-slate-500">{n.data}</div>
                                      <div className="font-bold text-[11px]">{n.usuario}</div>
                                      <div>{n.texto}</div>
                                      {n.link_imagem ? (
                                        <a href={String(n.link_imagem).split(/[\s,]+/)[0]} target="_blank" rel="noreferrer" className="text-[10px] text-[#2c348c] font-bold underline">
                                          Abrir anexo
                                        </a>
                                      ) : null}
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                            {activeFolder === "processo" && (
                              <ul className="space-y-2">
                                {(dossierDetail.process || []).length === 0 ? (
                                  <li>Sem eventos de processo.</li>
                                ) : (
                                  (dossierDetail.process || []).map((p: any, idx: number) => (
                                    <li key={p.id || idx} className="rounded border border-slate-200 bg-white p-2">
                                      <span className="font-bold">{p.status}</span> · {p.data}
                                      <div className="text-[11px]">{p.description}</div>
                                    </li>
                                  ))
                                )}
                              </ul>
                            )}
                            {activeFolder === "pdf" && (
                              <div className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                  <a
                                    href={pdfUrl(d.cte, d.serie)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-lg bg-[#2c348c] px-3 py-2 text-white text-xs font-bold"
                                  >
                                    <ExternalLink size={14} /> Baixar PDF
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => enviarOutlook(d.cte, d.serie)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800"
                                  >
                                    <Mail size={14} /> Outlook (link)
                                  </button>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                                  <p className="text-[11px] font-bold text-slate-800">E-mail com PDF em anexo (servidor / SMTP)</p>
                                  <p className="text-[10px] text-slate-500">
                                    Requer SMTP_HOST e SMTP_FROM no ambiente. Se não estiver configurado, use “Baixar PDF” e anexe no Outlook.
                                  </p>
                                  <input
                                    type="email"
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                    placeholder="Destinatário"
                                    value={emailTo}
                                    onChange={(e) => setEmailTo(e.target.value)}
                                  />
                                  <input
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                    placeholder="Assunto (opcional)"
                                    value={emailSubject}
                                    onChange={(e) => setEmailSubject(e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    disabled={emailBusy || !emailTo.trim()}
                                    onClick={() => sendDossieSmtp(d.cte, d.serie)}
                                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
                                  >
                                    {emailBusy ? "Enviando…" : "Enviar e-mail"}
                                  </button>
                                </div>
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                                  <p className="text-[11px] font-bold text-emerald-900">Encerramento formal</p>
                                  <select
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                    value={finalizeStatus}
                                    onChange={(e) => setFinalizeStatus(e.target.value)}
                                  >
                                    {["CONCLUIDO", "ARQUIVADO", "EM_ACOMPANHAMENTO_JURIDICO", "PENDENTE_PAGAMENTO"].map((s) => (
                                      <option key={s} value={s}>
                                        {s.replace(/_/g, " ")}
                                      </option>
                                    ))}
                                  </select>
                                  <label className="flex items-center gap-2 text-[11px]">
                                    <input type="checkbox" checked={syncPdfToDrive} onChange={(e) => setSyncPdfToDrive(e.target.checked)} />
                                    Sincronizar PDF na pasta do processo no Drive (conta Google conectada)
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => runFinalizeDossier(d.cte, d.serie)}
                                    className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white"
                                  >
                                    Gravar finalização
                                  </button>
                                </div>
                                <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-2">
                                  <p className="text-[11px] font-bold text-indigo-900">Novo anexo (upload → pasta CTE no Drive)</p>
                                  <div className="flex flex-wrap gap-2 items-center">
                                    <select
                                      className="rounded border border-slate-200 px-2 py-1 text-xs"
                                      value={attachCategory}
                                      onChange={(e) => setAttachCategory(e.target.value)}
                                    >
                                      <option value="GERAL">GERAL</option>
                                      <option value="JURIDICO">JURÍDICO</option>
                                      {hasFinanceAttach ? <option value="PAGAMENTO">PAGAMENTO</option> : null}
                                    </select>
                                    {!hasFinanceAttach ? (
                                      <span className="text-[10px] text-amber-800">
                                        Anexos PAGAMENTO exigem permissão financeira.
                                      </span>
                                    ) : null}
                                  </div>
                                  <input
                                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                                    placeholder="Rótulo (opcional)"
                                    value={attachLabel}
                                    onChange={(e) => setAttachLabel(e.target.value)}
                                  />
                                  <input
                                    type="file"
                                    className="block w-full text-[11px]"
                                    onChange={(e) => uploadDossierFile(d.cte, d.serie, e.target.files?.[0] || null)}
                                    disabled={attachBusy}
                                  />
                                  {attachBusy ? <p className="text-[10px] text-slate-500">Enviando…</p> : null}
                                </div>
                                {finalizeMsg ? (
                                  <p className="text-[11px] text-slate-700 bg-slate-100 border border-slate-200 rounded px-2 py-1.5">
                                    {finalizeMsg}
                                  </p>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OcorrenciasHub;
