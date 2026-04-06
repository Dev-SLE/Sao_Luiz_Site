import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, XAxis, YAxis, Bar } from 'recharts';
import { MessageSquare, Activity, Radar, Filter, Download } from 'lucide-react';
import { authClient } from '../lib/auth';

const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: '#10b981',
  IA: '#3b82f6',
  INTERNO: '#9ca3af',
};

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

const CrmDashboard: React.FC = () => {
  const [productivity, setProductivity] = useState<any>(null);
  const [executive, setExecutive] = useState<any>(null);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterTeamId, setFilterTeamId] = useState('');

  const conversationsByChannel = useMemo(
    () =>
      (productivity?.channels || []).map((c: any) => ({
        name: c.channel,
        key: c.channel,
        value: c.total,
      })),
    [productivity]
  );

  const responseTimeByStage = useMemo(
    () => productivity?.stageTimes || [],
    [productivity]
  );

  // Volume de rastreios automáticos da IA (hoje) via localStorage
  const cteVolumeToday = useMemo(() => {
    try {
      if (typeof window === 'undefined') return 0;
      const raw = window.localStorage.getItem('sofiaCteLookups');
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      const today = new Date().toISOString().slice(0, 10);
      return parsed.date === today ? parsed.count || 0 : 0;
    } catch {
      return 0;
    }
  }, []);

  const topAgents = useMemo(() => productivity?.agents || [], [productivity]);

  const filterParams = useMemo(
    () => ({
      from: filterFrom.trim() || null,
      to: filterTo.trim() || null,
      channel: filterChannel.trim() || null,
      teamId: filterTeamId.trim() || null,
    }),
    [filterFrom, filterTo, filterChannel, filterTeamId]
  );

  const loadData = useCallback(async () => {
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
    let cancelled = false;
    const run = async () => {
      await loadData();
    };
    void run();
    const interval = window.setInterval(() => {
      if (!cancelled) void loadData();
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadData]);

  const exportKpisCsv = () => {
    if (!executive) return;
    const f = executive?.filters || {};
    const header = ['recorte', 'valor'];
    const rows: string[][] = [
      ['periodo_inicio', f.from || ''],
      ['periodo_fim', f.to || ''],
      ['canal', f.channel || ''],
      ['time_id', f.teamId || ''],
      ['total_leads', String(executive?.kpis?.totalLeads ?? '')],
      ['convertidos', String(executive?.kpis?.convertidos ?? '')],
      ['alta_prioridade', String(executive?.kpis?.altaPrioridade ?? '')],
      ['conversas_ativas', String(executive?.kpis?.totalConversasAtivas ?? '')],
      ['sla_hit_pct', String(executive?.kpis?.slaHitRate ?? '')],
    ];
    downloadCsv(`crm_kpis_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  };

  const exportProductivityCsv = () => {
    if (!productivity) return;
    const f = productivity?.filters || {};
    const header = ['tipo', 'chave', 'metrica', 'valor'];
    const rows: string[][] = [];
    rows.push(['filtro', 'periodo_inicio', '', f.from || '']);
    rows.push(['filtro', 'periodo_fim', '', f.to || '']);
    rows.push(['filtro', 'canal', '', f.channel || '']);
    rows.push(['filtro', 'time_id', '', f.teamId || '']);
    (productivity.channels || []).forEach((c: any) => {
      rows.push(['canal', String(c.channel || ''), 'total', String(c.total ?? '')]);
    });
    (productivity.agents || []).forEach((a: any) => {
      rows.push(['agente', String(a.username || ''), 'abertos', String(a.openCount ?? '')]);
      rows.push(['agente', String(a.username || ''), 'sla_estourado', String(a.slaBreached ?? '')]);
    });
    (productivity.stageTimes || []).forEach((s: any) => {
      rows.push(['estagio', String(s.stage || ''), 'avg_minutos', String(s.minutes ?? '')]);
    });
    downloadCsv(`crm_produtividade_${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 text-slate-900">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2 text-[#e42424] border border-slate-200 shadow-[0_0_18px_rgba(236,27,35,0.4)]">
            <MessageSquare size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black leading-tight">Dashboard CRM</h1>
            <p className="text-xs text-slate-600">
              Visão consolidada de atendimento, canais e inteligência de rastreio.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end md:justify-end text-[11px] font-medium text-slate-700">
          <div className="flex items-center gap-1 text-slate-500">
            <Filter size={14} />
            <span>Recorte</span>
          </div>
          <input
            type="date"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            title="Leads atualizados a partir de (opcional)"
          />
          <input
            type="date"
            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            title="Leads atualizados até (opcional)"
          />
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800"
            value={filterChannel}
            onChange={(e) => setFilterChannel(e.target.value)}
          >
            <option value="">Todos os canais</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="IA">IA</option>
            <option value="INTERNO">Interno</option>
          </select>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 max-w-[180px]"
            value={filterTeamId}
            onChange={(e) => setFilterTeamId(e.target.value)}
          >
            <option value="">Todos os times</option>
            {(productivity?.teamOptions || []).map((t: any) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
            onClick={() => {
              setFilterFrom('');
              setFilterTo('');
              setFilterChannel('');
              setFilterTeamId('');
            }}
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-[#2c348c]/35"
          onClick={exportKpisCsv}
        >
          <Download size={14} />
          CSV KPIs
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:border-[#2c348c]/35"
          onClick={exportProductivityCsv}
        >
          <Download size={14} />
          CSV produtividade
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface-card interactive-lift p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-700 uppercase tracking-wide">Conversas ativas</p>
            <p className="text-2xl font-black">
              {executive?.kpis?.totalConversasAtivas ?? conversationsByChannel.reduce((acc: number, c: any) => acc + Number(c.value || 0), 0)}
            </p>
            <p className="mt-1 text-[11px] text-slate-600">
              Distribuídas entre WhatsApp, IA e Interno.
            </p>
          </div>
          <Activity size={32} className="text-[#e42424]" />
        </div>

        <div className="surface-card interactive-lift p-4 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-700 uppercase tracking-wide">
              Taxa de SLA cumprido
            </p>
            <p className="text-2xl font-black">{executive?.kpis?.slaHitRate ?? productivity?.sla?.hitRate ?? 0}%</p>
            <p className="mt-1 text-[11px] text-slate-600">
              Conversas que não estouraram o SLA.
            </p>
          </div>
          <Radar size={32} className="text-sky-400" />
        </div>

        <div className="surface-card interactive-lift p-4 flex flex-col justify-between">
          <div>
            <p className="text-[11px] text-slate-700 uppercase tracking-wide">
              Leads convertidos
            </p>
            <p className="text-2xl font-black">{executive?.kpis?.convertidos ?? 0}</p>
            <p className="mt-1 text-[11px] text-slate-600">
              Total de oportunidades com status final positivo.
            </p>
          </div>
          <p className="text-[10px] text-slate-500">
            Rastreios automáticos IA hoje: {cteVolumeToday}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="surface-card p-4 flex flex-col h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">Conversas por canal</h2>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conversationsByChannel}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {conversationsByChannel.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHANNEL_COLORS[entry.key] || '#9ca3af'}
                      stroke="#e2e8f0"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow">
                        {payload[0].name}: {payload[0].value} conversas
                      </div>
                    ) : null
                  }
                />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', color: '#334155', fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-4 flex flex-col h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">Tempo de resposta por estágio</h2>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeByStage} layout="vertical" margin={{ left: 60, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="stage"
                  type="category"
                  width={100}
                  tick={{ fontSize: 11, fill: '#334155', fontWeight: 700 }}
                />
                <Bar dataKey="minutes" fill="#3b82f6" radius={4} barSize={16} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow">
                        {payload[0].payload.stage}: {payload[0].value} min
                      </div>
                    ) : null
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card p-4 flex flex-col h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">Produtividade por atendente</h2>
          </div>
          <div className="flex-1 min-h-0 space-y-1 overflow-y-auto text-[11px] text-slate-700">
            {topAgents.length === 0 ? (
              <p className="text-slate-500">Sem dados de atendentes ainda.</p>
            ) : (
              topAgents.map((a: any) => (
                <div
                  key={a.username}
                  className="flex items-center justify-between px-2 py-1 rounded border border-slate-200 bg-slate-50"
                >
                  <span className="truncate max-w-[70%]">{a.username}</span>
                  <span className="text-[10px] text-slate-500">
                    {a.openCount} abertos / SLA {a.slaBreached}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrmDashboard;

