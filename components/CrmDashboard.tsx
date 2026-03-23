import React, { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, XAxis, YAxis, Bar } from 'recharts';
import { MessageSquare, Activity, Radar, Filter } from 'lucide-react';
import { authClient } from '../lib/auth';

const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: '#10b981',
  IA: '#3b82f6',
  INTERNO: '#9ca3af',
};

const CrmDashboard: React.FC = () => {
  const [productivity, setProductivity] = useState<any>(null);

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

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const data = await authClient.getCrmProductivity();
        if (!cancelled) setProductivity(data);
      } catch {
        if (!cancelled) setProductivity(null);
      }
    };
    run();
    const interval = window.setInterval(run, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 text-white">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#0F103A] p-2 text-[#EC1B23] border border-[#1A1B62] shadow-[0_0_18px_rgba(236,27,35,0.4)]">
            <MessageSquare size={22} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black leading-tight">Dashboard CRM</h1>
            <p className="text-xs text-gray-400">
              Visão consolidada de atendimento, canais e inteligência de rastreio.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-300">
          <Filter size={14} />
          <span>Filtros globais virão da futura API CRM.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 shadow-[0_0_24px_rgba(0,0,0,0.85)] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Conversas ativas</p>
            <p className="text-2xl font-black">
              {conversationsByChannel.reduce((acc: number, c: any) => acc + Number(c.value || 0), 0)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              Distribuídas entre WhatsApp, IA e Interno.
            </p>
          </div>
          <Activity size={32} className="text-[#EC1B23]" />
        </div>

        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 shadow-[0_0_24px_rgba(0,0,0,0.85)] flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Tempo médio de resposta
            </p>
            <p className="text-2xl font-black">{productivity?.sla?.hitRate ?? 0}%</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Taxa de cumprimento do SLA nas conversas ativas.
            </p>
          </div>
          <Radar size={32} className="text-sky-400" />
        </div>

        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 shadow-[0_0_24px_rgba(0,0,0,0.85)] flex flex-col justify-between">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Rastreios automáticos de CTE (hoje)
            </p>
            <p className="text-2xl font-black">{cteVolumeToday}</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Consultas disparadas pela IA ao detectar CTE nas conversas.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 shadow-[0_0_24px_rgba(0,0,0,0.85)] flex flex-col h-[260px]">
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
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {conversationsByChannel.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHANNEL_COLORS[entry.key] || '#9ca3af'}
                      stroke="#0f172a"
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-white text-gray-800 text-xs px-2 py-1 rounded shadow">
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
                  wrapperStyle={{ fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 shadow-[0_0_24px_rgba(0,0,0,0.85)] flex flex-col h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">Tempo de resposta por estágio</h2>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={responseTimeByStage} layout="vertical" margin={{ left: 60 }}>
                <XAxis type="number" hide />
                <YAxis
                  dataKey="stage"
                  type="category"
                  width={80}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                />
                <Bar dataKey="minutes" fill="#3b82f6" radius={3} barSize={14} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="bg-white text-gray-800 text-xs px-2 py-1 rounded shadow">
                        {payload[0].payload.stage}: {payload[0].value} min
                      </div>
                    ) : null
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-4 shadow-[0_0_24px_rgba(0,0,0,0.85)] flex flex-col h-[260px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold">Produtividade por atendente</h2>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto text-[11px] text-gray-200 space-y-1">
            {topAgents.length === 0 ? (
              <p className="text-gray-500">Sem dados de atendentes ainda.</p>
            ) : (
              topAgents.map((a: any) => (
                <div
                  key={a.username}
                  className="flex items-center justify-between px-2 py-1 rounded border border-[#1A1B62] bg-[#080816]"
                >
                  <span className="truncate max-w-[70%]">{a.username}</span>
                  <span className="text-[10px] text-gray-400">
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

