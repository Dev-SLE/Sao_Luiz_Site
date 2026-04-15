import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Download } from 'lucide-react';
import { authClient } from '../lib/auth';
import { useData } from '../context/DataContext';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename: string, header: string[], rows: string[][]) {
  const lines = [header.join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CrmReports: React.FC = () => {
  const { hasPermission } = useData();
  const canDeepExport =
    hasPermission('MANAGE_CRM_OPS') || hasPermission('MANAGE_SETTINGS') || hasPermission('VIEW_CRM_DASHBOARD');
  const canConsentExport = hasPermission('MANAGE_CRM_OPS') || hasPermission('MANAGE_SETTINGS');
  const [productivity, setProductivity] = useState<any>(null);
  const [executive, setExecutive] = useState<any>(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterTeamId, setFilterTeamId] = useState('');

  const filterParams = useMemo(
    () => ({
      from: filterFrom.trim() || null,
      to: filterTo.trim() || null,
      channel: filterChannel.trim() || null,
      teamId: filterTeamId.trim() || null,
    }),
    [filterFrom, filterTo, filterChannel, filterTeamId]
  );

  const load = useCallback(async () => {
    try {
      const [data, exec] = await Promise.all([
        authClient.getCrmProductivity(filterParams),
        authClient.getCrmExecutiveKpis(filterParams),
      ]);
      setProductivity(data);
      setExecutive(exec);
    } catch {
      setProductivity(null);
      setExecutive(null);
    }
  }, [filterParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportKpis = () => {
    if (!executive) return;
    const f = executive?.filters || {};
    downloadCsv(`crm_kpis_${new Date().toISOString().slice(0, 10)}.csv`, ['recorte', 'valor'], [
      ['periodo_inicio', f.from || ''],
      ['periodo_fim', f.to || ''],
      ['canal', f.channel || ''],
      ['time_id', f.teamId || ''],
      ['total_leads', String(executive?.kpis?.totalLeads ?? '')],
      ['convertidos', String(executive?.kpis?.convertidos ?? '')],
      ['alta_prioridade', String(executive?.kpis?.altaPrioridade ?? '')],
      ['conversas_ativas', String(executive?.kpis?.totalConversasAtivas ?? '')],
      ['sla_hit_pct', String(executive?.kpis?.slaHitRate ?? '')],
    ]);
  };

  const exportProd = () => {
    if (!productivity) return;
    const f = productivity?.filters || {};
    const header = ['tipo', 'chave', 'metrica', 'valor'];
    const rows: string[][] = [
      ['filtro', 'periodo_inicio', '', f.from || ''],
      ['filtro', 'periodo_fim', '', f.to || ''],
      ['filtro', 'canal', '', f.channel || ''],
      ['filtro', 'time_id', '', f.teamId || ''],
    ];
    (productivity.channels || []).forEach((c: any) => {
      rows.push(['canal', String(c.channel || ''), 'total', String(c.total ?? '')]);
    });
    (productivity.agents || []).forEach((a: any) => {
      rows.push(['agente', String(a.username || ''), 'abertos', String(a.openCount ?? '')]);
      rows.push(['agente', String(a.username || ''), 'sla_estourado', String(a.slaBreached ?? '')]);
    });
    downloadCsv(`crm_produtividade_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 text-slate-900 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-slate-100 p-2 text-sl-navy border border-slate-200">
          <FileSpreadsheet size={22} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-black leading-tight">Relatórios CRM</h1>
          <p className="text-xs text-slate-600">
            Exportação mínima em CSV (KPIs executivos e detalhamento de produtividade) com o mesmo recorte do dashboard.
          </p>
        </div>
      </div>

      <div className="surface-card p-4 flex flex-col gap-2 text-[11px]">
        <p className="font-bold text-slate-800">Recorte</p>
        <div className="flex flex-wrap gap-2">
          <input type="date" className="rounded border border-slate-300 bg-white px-2 py-1" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          <input type="date" className="rounded border border-slate-300 bg-white px-2 py-1" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          <select className="rounded border border-slate-300 bg-white px-2 py-1" value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}>
            <option value="">Todos os canais</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="IA">IA</option>
            <option value="INTERNO">Interno</option>
          </select>
          <select className="rounded border border-slate-300 bg-white px-2 py-1 max-w-[200px]" value={filterTeamId} onChange={(e) => setFilterTeamId(e.target.value)}>
            <option value="">Todos os times</option>
            {(productivity?.teamOptions || []).map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="button" className="rounded border border-slate-200 bg-white px-2 py-1" onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterChannel(''); setFilterTeamId(''); }}>
            Limpar
          </button>
          <button type="button" className="rounded bg-sl-navy px-3 py-1 font-semibold text-white" onClick={() => void load()}>
            Aplicar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="surface-card p-4 space-y-2">
          <h2 className="text-sm font-bold">KPIs consolidados</h2>
          <p className="text-[11px] text-slate-600">
            Leads no período (atualização), conversas ativas no recorte de canal/time, taxa de SLA.
          </p>
          <button type="button" className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-800 hover:border-sl-navy/40" onClick={exportKpis} disabled={!executive}>
            Baixar CSV
          </button>
        </div>
        <div className="surface-card p-4 space-y-2">
          <h2 className="text-sm font-bold">Produtividade</h2>
          <p className="text-[11px] text-slate-600">Canais, agentes e tempos médios por estágio (conforme filtros).</p>
          <button type="button" className="w-full rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-800 hover:border-sl-navy/40" onClick={exportProd} disabled={!productivity}>
            Baixar CSV
          </button>
        </div>
      </div>

      {canDeepExport && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="surface-card p-4 space-y-2">
            <h2 className="text-sm font-bold">Disparos de campanha</h2>
            <p className="text-[11px] text-slate-600">Filas registradas em crm_campaign_dispatches (período abaixo).</p>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-800"
              onClick={async () => {
                try {
                  await authClient.downloadCrmReportCsv('campaign_dispatches', {
                    from: filterFrom.trim() || null,
                    to: filterTo.trim() || null,
                  });
                } catch {
                  /* noop */
                }
              }}
            >
              <Download size={14} />
              CSV campanhas
            </button>
          </div>
          <div className="surface-card p-4 space-y-2">
            <h2 className="text-sm font-bold">SLA por agente</h2>
            <p className="text-[11px] text-slate-600">Conversas ativas e estouros no período (aproximação por updated_at).</p>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-800"
              onClick={async () => {
                try {
                  await authClient.downloadCrmReportCsv('sla_agents', {
                    from: filterFrom.trim() || null,
                    to: filterTo.trim() || null,
                  });
                } catch {
                  /* noop */
                }
              }}
            >
              <Download size={14} />
              CSV SLA
            </button>
          </div>
          {canConsentExport && (
            <div className="surface-card p-4 space-y-2 border border-violet-100 bg-violet-50/40">
              <h2 className="text-sm font-bold">Trilha de consentimento</h2>
              <p className="text-[11px] text-slate-600">Eventos auditáveis (opt-in/out, ajustes). Só gestores.</p>
              <button
                type="button"
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-violet-200 bg-white py-2 text-xs font-bold text-slate-800"
                onClick={async () => {
                  try {
                    await authClient.downloadCrmReportCsv('consent_events', {
                      from: filterFrom.trim() || null,
                      to: filterTo.trim() || null,
                    });
                  } catch {
                    /* noop */
                  }
                }}
              >
                <Download size={14} />
                CSV consentimento
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CrmReports;
