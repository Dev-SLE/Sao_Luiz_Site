'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { Comercial360Shell, useComercial360 } from '@/modules/gerencial/comercial360/Comercial360Shell';
import { formatBrl, toNum } from '@/modules/gerencial/comercial360/comercial360Format';
import { GLOSSARY, INTERPRET, RISCO } from '@/modules/gerencial/comercial360/comercial360HelpContent';
import { Comercial360HelpHint, Comercial360ThHelp } from '@/modules/gerencial/comercial360/Comercial360HelpHint';

function RiscoBody() {
  const { queryString, patchFilters, openDrill } = useComercial360();
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);
  const [statusRows, setStatusRows] = useState<
    Array<{ status_atividade: string; qtd_clientes: number; dinheiro_em_risco: number }>
  >([]);
  const [tableRows, setTableRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [kRes, sRes, tRes] = await Promise.all([
          fetch(`/api/bi/comercial-360/kpis?${queryString}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/bi/comercial-360/resumo?tipo=status&${queryString}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/bi/comercial-360/tabela?${queryString}&limit=50&offset=0`, { credentials: 'include', cache: 'no-store' }),
        ]);
        const kJson = kRes.ok ? await kRes.json() : null;
        const sJson = sRes.ok ? await sRes.json() : null;
        const tJson = tRes.ok ? await tRes.json() : null;
        if (cancelled) return;
        const parts: string[] = [];
        if (!kRes.ok) parts.push(String(kJson?.error || 'KPIs'));
        if (!sRes.ok) parts.push(String(sJson?.error || 'Resumo status'));
        if (!tRes.ok) parts.push(String(tJson?.error || 'Tabela'));
        setErr(parts.length ? parts.join(' · ') : null);
        if (kRes.ok) setKpis(kJson as Record<string, unknown>);
        if (sRes.ok) setStatusRows(Array.isArray(sJson?.rows) ? sJson.rows : []);
        if (tRes.ok) setTableRows(Array.isArray(tJson?.rows) ? tJson.rows : []);
      } catch {
        if (!cancelled) setErr('Falha de rede');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const inativos = useMemo(() => {
    const row = statusRows.find((r) => String(r.status_atividade || '').includes('INATIVO'));
    return row ? row.qtd_clientes : 0;
  }, [statusRows]);

  const chartData = statusRows.map((r) => ({
    status: r.status_atividade.length > 22 ? `${r.status_atividade.slice(0, 20)}…` : r.status_atividade,
    risco: r.dinheiro_em_risco,
  }));

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{err}</div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:border-rose-300"
          onClick={() => patchFilters({ statusAtividade: ['[EM QUEDA]'] })}
        >
          Em queda
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:border-rose-300"
          onClick={() => patchFilters({ statusAtividade: ['[RISCO CHURN]'] })}
        >
          Risco churn
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:border-slate-400"
          onClick={() => patchFilters({ statusAtividade: ['[INATIVO]'] })}
        >
          Inativos
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:border-slate-400"
          onClick={() => patchFilters({ statusAtividade: [] })}
        >
          Limpar status
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-600">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">Carregando monitor…</span>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniCard label="Clientes em queda" value={kpis ? String(toNum(kpis.clientes_em_queda)) : '—'} help={RISCO.cardEmQueda} />
            <MiniCard label="Risco churn" value={kpis ? String(toNum(kpis.risco_churn)) : '—'} help={RISCO.cardRiscoChurn} />
            <MiniCard label="Inativos" value={String(inativos)} help={RISCO.cardInativos} />
            <MiniCard
              label="Ticket médio alvo"
              value={kpis ? formatBrl(toNum(kpis.ticket_medio_alvo)) : '—'}
              help={RISCO.cardTicketRisco}
            />
          </div>
          <div className="surface-card rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Dinheiro em risco por status</h2>
              <Comercial360HelpHint label="Gráfico de status" body={RISCO.graficoStatus} />
            </div>
            <div className="mt-4 h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="status" width={120} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatBrl(v)} />
                  <Bar dataKey="risco" name="Risco" fill="#be123c" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="surface-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-bold text-slate-900">Clientes priorizados</h2>
              <p className="text-xs text-slate-600">Ordenação da base por prioridade de status e GAP.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Cliente</th>
                    <th className="px-2 py-2">
                      <Comercial360ThHelp helpLabel="Status" body={GLOSSARY.statusAtividade}>
                        Status
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Recência" body={RISCO.colRecencia}>
                        Recência (dias)
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Dinheiro em risco" body={RISCO.colDinheiroRisco}>
                        Risco
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="GAP" body={GLOSSARY.gapNaMesa}>
                        GAP
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => {
                    const mk = String(r.match_key ?? '');
                    const nome = String(r.razao_social || r.nome_fantasia || '').trim() || mk;
                    return (
                      <tr key={`${mk}-${i}`} className="border-t border-slate-100">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-900">{nome}</td>
                        <td className="max-w-[160px] truncate px-2 py-2 text-slate-700">{String(r.status_atividade ?? '')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700">
                          {String(r.recencia_dias ?? '—')}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {formatBrl(toNum(r.dinheiro_em_risco))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                          {formatBrl(toNum(r.gap_estimado))}
                        </td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            className="text-xs font-semibold text-sl-navy underline"
                            onClick={() => openDrill(mk)}
                          >
                            Drill
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MiniCard({ label, value, help }: { label: string; value: string; help: string }) {
  return (
    <div className="surface-card rounded-2xl border border-rose-100 bg-rose-50/30 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-rose-900/80">{label}</p>
        <Comercial360HelpHint label={label} body={help} />
      </div>
      <p className="mt-1 text-xl font-bold text-rose-950">{value}</p>
    </div>
  );
}

export function BiComercial360RiscoDashboard() {
  return (
    <Comercial360Shell
      variant="risco"
      title="Monitor de risco e ciclo de vida"
      titleHelp={RISCO.tituloTela}
      description="Concentre-se em queda, churn e inatividade — sempre filtrado na mesma base 360."
      interpret={INTERPRET.risco}
    >
      <RiscoBody />
    </Comercial360Shell>
  );
}
