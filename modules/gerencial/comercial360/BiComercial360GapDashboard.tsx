'use client';

import React, { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { Comercial360Shell, useComercial360 } from '@/modules/gerencial/comercial360/Comercial360Shell';
import { formatBrl, toNum } from '@/modules/gerencial/comercial360/comercial360Format';
import { GLOSSARY, GAP as GAP_HELP, INTERPRET } from '@/modules/gerencial/comercial360/comercial360HelpContent';
import { Comercial360HelpHint, Comercial360ThHelp } from '@/modules/gerencial/comercial360/Comercial360HelpHint';

function GapBody() {
  const { queryString, openDrill } = useComercial360();
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);
  const [cats, setCats] = useState<{ name: string; gap: number }[]>([]);
  const [top, setTop] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [kRes, cRes, oRes] = await Promise.all([
          fetch(`/api/bi/comercial-360/kpis?${queryString}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/bi/comercial-360/resumo?tipo=categoria&${queryString}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/bi/comercial-360/oportunidades?${queryString}&mode=top&order=gap&limit=30`, {
            credentials: 'include',
            cache: 'no-store',
          }),
        ]);
        const kJson = kRes.ok ? await kRes.json() : null;
        const cJson = cRes.ok ? await cRes.json() : null;
        const oJson = oRes.ok ? await oRes.json() : null;
        if (cancelled) return;
        const parts: string[] = [];
        if (!kRes.ok) parts.push(String(kJson?.error || 'KPIs'));
        if (!cRes.ok) parts.push(String(cJson?.error || 'Categorias'));
        if (!oRes.ok) parts.push(String(oJson?.error || 'Oportunidades'));
        setErr(parts.length ? parts.join(' · ') : null);
        if (kRes.ok) setKpis(kJson as Record<string, unknown>);
        if (cRes.ok) {
          const rows = Array.isArray(cJson?.rows) ? cJson.rows : [];
          setCats(
            rows.slice(0, 10).map((r: { categoria_cliente?: string; gap_estimado?: unknown }) => ({
              name: String(r.categoria_cliente || '—').slice(0, 24),
              gap: toNum(r.gap_estimado),
            })),
          );
        }
        if (oRes.ok) setTop(Array.isArray(oJson?.rows) ? oJson.rows : []);
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

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{err}</div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-600">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">Carregando visão de GAP…</span>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase text-slate-500">Faturamento real</p>
                <Comercial360HelpHint label="Faturamento real" body={GAP_HELP.cardFaturamento} />
              </div>
              <p className="mt-1 text-lg font-bold text-slate-900">{kpis ? formatBrl(toNum(kpis.faturamento_real)) : '—'}</p>
            </div>
            <div className="surface-card rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase text-slate-500">Potencial estimado</p>
                <Comercial360HelpHint label="Potencial estimado" body={GAP_HELP.cardPotencial} />
              </div>
              <p className="mt-1 text-lg font-bold text-slate-900">{kpis ? formatBrl(toNum(kpis.potencial_estimado)) : '—'}</p>
            </div>
            <div className="surface-card rounded-2xl border border-violet-200 bg-violet-50/40 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase text-violet-800">GAP na mesa</p>
                <Comercial360HelpHint label="GAP na mesa" body={GAP_HELP.cardGap} />
              </div>
              <p className="mt-1 text-lg font-bold text-violet-950">{kpis ? formatBrl(toNum(kpis.gap_na_mesa)) : '—'}</p>
            </div>
          </div>
          <div className="surface-card rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Real vs potencial por categoria (GAP)</h2>
              <Comercial360HelpHint label="Gráfico por categoria" body={GAP_HELP.graficoCategoria} />
            </div>
            <div className="mt-4 h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => formatBrl(v)} />
                  <Bar dataKey="gap" fill="#6d28d9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="surface-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Maior folga (oportunidades)</h2>
                <Comercial360HelpHint label="Ranking" body={GAP_HELP.rankingTitulo} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Cliente</th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="GAP" body={GLOSSARY.gapNaMesa}>
                        GAP
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Potencial" body={GLOSSARY.potencialEstimado}>
                        Potencial
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Faturamento" body={GLOSSARY.faturamentoReal}>
                        Faturamento
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r, i) => {
                    const mk = String(r.match_key ?? '');
                    const nome = String(r.razao_social || r.nome_fantasia || '').trim() || mk;
                    return (
                      <tr key={`${mk}-${i}`} className="border-t border-slate-100">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-900">{nome}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-semibold text-violet-900 tabular-nums">
                          {formatBrl(toNum(r.gap_estimado))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatBrl(toNum(r.potencial_estimado))}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatBrl(toNum(r.faturamento_real))}</td>
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

export function BiComercial360GapDashboard() {
  return (
    <Comercial360Shell
      variant="gap"
      title="Potencial e GAP"
      titleHelp={GAP_HELP.tituloTela}
      description="Compare o que já fatura com o teto estimado e priorize clientes com maior folga."
      interpret={INTERPRET.gap}
    >
      <GapBody />
    </Comercial360Shell>
  );
}
