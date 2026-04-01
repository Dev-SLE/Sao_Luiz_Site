import React, { useState } from "react";
import DataTable from "./DataTable";
import { CteData } from "../types";
import { authClient } from "../lib/auth";

type Props = {
  data: CteData[];
  onNoteClick: (cte: CteData) => void;
  serverPagination: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
  };
};

const OcorrenciasHub: React.FC<Props> = ({ data, onNoteClick, serverPagination }) => {
  const [tab, setTab] = useState<"OCORRENCIAS" | "INDEN_DOSSIE">("OCORRENCIAS");
  const [cte, setCte] = useState("");
  const [serie, setSerie] = useState("0");
  const [items, setItems] = useState<any[]>([]);
  const [dossier, setDossier] = useState<any | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!cte.trim()) {
      setStatusMsg("Informe o CTE para consultar.");
      return;
    }
    setLoading(true);
    setStatusMsg("");
    try {
      const occ = await authClient.getOccurrences({ cte: cte.trim(), serie: serie.trim() || "0" });
      const d = await authClient.getDossier(cte.trim(), serie.trim() || "0");
      setItems(Array.isArray(occ?.items) ? occ.items : []);
      setDossier(d?.dossier || null);
      if (!Array.isArray(occ?.items) || occ.items.length === 0) {
        setStatusMsg("Nenhuma ocorrência encontrada para este CTE/Série.");
      }
    } catch (e: any) {
      setStatusMsg(e?.message || "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  const abrirIndenizacao = async () => {
    if (!items.length) {
      setStatusMsg("Carregue um CTE com ocorrência para abrir indenização.");
      return;
    }
    try {
      await authClient.createIndemnification({
        occurrenceId: items[0].id,
        status: "ATIVA",
        notes: "Indenização aberta pela central de ocorrências.",
      });
      setStatusMsg("Indenização criada com sucesso.");
    } catch (e: any) {
      setStatusMsg(e?.message || "Não foi possível criar a indenização.");
    }
  };

  const gerarDossie = async () => {
    if (!cte.trim()) {
      setStatusMsg("Informe o CTE para gerar dossiê.");
      return;
    }
    try {
      const res = await authClient.createDossier({ cte: cte.trim(), serie: serie.trim() || "0" });
      setDossier(res?.dossier || null);
      setStatusMsg("Dossiê atualizado/gerado com sucesso.");
    } catch (e: any) {
      setStatusMsg(e?.message || "Não foi possível gerar o dossiê.");
    }
  };

  const baixarPdf = () => {
    if (!cte.trim()) {
      setStatusMsg("Informe o CTE para baixar o PDF.");
      return;
    }
    window.open(`/api/dossie/pdf?cte=${encodeURIComponent(cte.trim())}&serie=${encodeURIComponent(serie.trim() || "0")}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("OCORRENCIAS")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold border ${tab === "OCORRENCIAS" ? "bg-[#2c348c] text-white border-[#2c348c]" : "bg-white text-slate-700 border-slate-200"}`}
        >
          Ocorrências
        </button>
        <button
          type="button"
          onClick={() => setTab("INDEN_DOSSIE")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold border ${tab === "INDEN_DOSSIE" ? "bg-[#2c348c] text-white border-[#2c348c]" : "bg-white text-slate-700 border-slate-200"}`}
        >
          Indenizações e Dossiê
        </button>
      </div>

      {tab === "OCORRENCIAS" ? (
        <DataTable
          title="Ocorrências Operacionais"
          data={data}
          onNoteClick={onNoteClick}
          enableFilters
          ignoreUnitFilter
          serverPagination={serverPagination}
        />
      ) : (
        <div className="surface-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input value={cte} onChange={(e) => setCte(e.target.value)} placeholder="CTE" className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Série" className="rounded border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" onClick={load} className="rounded bg-[#2c348c] text-white text-sm font-semibold px-3 py-2">
              {loading ? "Carregando..." : "Consultar"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={abrirIndenizacao} className="rounded border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5">
              Abrir indenização da ocorrência
            </button>
            <button type="button" onClick={gerarDossie} className="rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1.5">
              Gerar/atualizar dossiê
            </button>
            <button type="button" onClick={baixarPdf} className="rounded border border-slate-200 bg-white text-slate-700 text-xs font-bold px-3 py-1.5">
              Baixar dossiê PDF
            </button>
          </div>
          {statusMsg && <p className="text-xs text-slate-600">{statusMsg}</p>}
          {dossier && (
            <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              Dossiê ativo: <strong>{dossier.title}</strong> ({dossier.cte}/{dossier.serie})
            </div>
          )}
          <div className="rounded border border-slate-200 p-3">
            <p className="text-xs font-bold text-slate-700 mb-2">Ocorrências encontradas</p>
            {items.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhuma ocorrência carregada.</p>
            ) : (
              <div className="space-y-1">
                {items.map((it) => (
                  <div key={it.id} className="text-xs text-slate-700">
                    [{it.occurrence_type}] {it.status} - {it.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OcorrenciasHub;
