'use client';

import React, { useEffect, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Loader2 } from 'lucide-react';
import { Comercial360Shell, useComercial360 } from '@/modules/gerencial/comercial360/Comercial360Shell';
import { formatBrl, toNum } from '@/modules/gerencial/comercial360/comercial360Format';
import { GLOSSARY, INTERPRET, RADAR } from '@/modules/gerencial/comercial360/comercial360HelpContent';
import { Comercial360HelpHint, Comercial360ThHelp } from '@/modules/gerencial/comercial360/Comercial360HelpHint';
import { biGetJsonSafe } from '@/modules/gerencial/biApiClientCache';

const COL = ['#0f766e', '#0e7490', '#1e3a5f', '#6366f1'];

type RadarSnap = {
  clientes_cif: number;
  faturamento_cif: number;
  sem_contrato_com_fat_clientes: number;
  sem_contrato_com_fat_faturamento: number;
  inativos_com_potencial_clientes: number;
  inativos_com_potencial_potencial: number;
};

function RadarBody() {
  const { queryString, openDrill } = useComercial360();
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);
  const [snap, setSnap] = useState<RadarSnap | null>(null);
  const [docPie, setDocPie] = useState<{ name: string; value: number }[]>([]);
  const [explore, setExplore] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [kRes, rRes, dRes, oRes] = await Promise.all([
          biGetJsonSafe<Record<string, unknown>>(`/api/bi/comercial-360/kpis?${queryString}`),
          biGetJsonSafe<RadarSnap>(`/api/bi/comercial-360/radar-snapshot?${queryString}`),
          biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/comercial-360/resumo?tipo=documento&${queryString}`),
          biGetJsonSafe<{ rows?: unknown[] }>(
            `/api/bi/comercial-360/oportunidades?${queryString}&mode=top&order=score&limit=40`,
          ),
        ]);
        const kJson = kRes.ok ? kRes.data : null;
        const rJson = rRes.ok ? rRes.data : null;
        const dJson = dRes.ok ? dRes.data : null;
        const oJson = oRes.ok ? oRes.data : null;
        if (cancelled) return;
        const parts: string[] = [];
        if (!kRes.ok) parts.push(kRes.error || 'KPIs');
        if (!rRes.ok) parts.push(rRes.error || 'Radar');
        if (!dRes.ok) parts.push(dRes.error || 'Documento');
        if (!oRes.ok) parts.push(oRes.error || 'Exploração');
        setErr(parts.length ? parts.join(' · ') : null);
        if (kRes.ok) setKpis(kJson as Record<string, unknown>);
        if (rRes.ok && rJson) setSnap(rJson as RadarSnap);
        if (dRes.ok) {
          const rows = (Array.isArray(dJson?.rows) ? dJson.rows : []) as Array<{
            tipo_documento_detectado?: string;
            qtd_clientes?: unknown;
          }>;
          setDocPie(
            rows.slice(0, 5).map((row) => ({
              name: String(row.tipo_documento_detectado || '—'),
              value: toNum(row.qtd_clientes),
            })),
          );
        }
        if (oRes.ok) setExplore(Array.isArray(oJson?.rows) ? (oJson.rows as Record<string, unknown>[]) : []);
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
          <span className="text-sm">Carregando radar…</span>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="surface-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase text-slate-500">Alvos na tela</p>
                <Comercial360HelpHint label="Alvos na tela" body={RADAR.cardAlvos} />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {kpis ? Math.round(toNum(kpis.alvos_na_tela)).toLocaleString('pt-BR') : '—'}
              </p>
            </div>
            <div className="surface-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase text-slate-500">Potencial total</p>
                <Comercial360HelpHint label="Potencial total" body={RADAR.cardPotencialTotal} />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {kpis ? formatBrl(toNum(kpis.potencial_estimado)) : '—'}
              </p>
            </div>
            <div className="surface-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold uppercase text-slate-500">Ticket médio alvo</p>
                <Comercial360HelpHint label="Ticket médio alvo" body={RADAR.cardTicketAlvo} />
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {kpis ? formatBrl(toNum(kpis.ticket_medio_alvo)) : '—'}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Snap
              title="Potencial CIF"
              clients={snap?.clientes_cif ?? 0}
              value={snap?.faturamento_cif ?? 0}
              help={GLOSSARY.potencialCif}
            />
            <Snap
              title="Sem contrato + faturamento"
              clients={snap?.sem_contrato_com_fat_clientes ?? 0}
              value={snap?.sem_contrato_com_fat_faturamento ?? 0}
              help={RADAR.colSemContrato}
            />
            <Snap
              title="Inativos com potencial"
              clients={snap?.inativos_com_potencial_clientes ?? 0}
              value={snap?.inativos_com_potencial_potencial ?? 0}
              help={GLOSSARY.potencialEstimado}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="surface-card rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Mix por tipo de documento</h2>
                <Comercial360HelpHint label="Documentos" body={RADAR.graficoDoc} />
              </div>
              <p className="text-xs text-slate-600">Quantidade de clientes distintos por documento detectado.</p>
              <div className="mt-4 h-56 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="value" data={docPie} innerRadius={50} outerRadius={78} paddingAngle={2}>
                      {docPie.map((_, i) => (
                        <Cell key={i} fill={COL[i % COL.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} clientes`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="surface-card rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Exploração rápida</h2>
                <Comercial360HelpHint label="Exploração" body={RADAR.exploracao} />
              </div>
              <p className="text-xs text-slate-600">Contas com melhor combinação de score e oportunidade.</p>
              <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto text-xs">
                {explore.slice(0, 12).map((r, i) => {
                  const mk = String(r.match_key ?? '');
                  const nome = String(r.razao_social || r.nome_fantasia || '').trim() || mk;
                  return (
                    <li key={`${mk}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2 py-1.5">
                      <span className="truncate font-medium text-slate-800">{nome}</span>
                      <button
                        type="button"
                        className="shrink-0 text-[11px] font-semibold text-teal-800 underline"
                        onClick={() => openDrill(mk)}
                      >
                        Drill
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
          <div className="surface-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Tabela exploratória</h2>
                <Comercial360HelpHint label="Tabela exploratória" body={RADAR.tabelaExploratoria} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Cliente</th>
                    <th className="px-2 py-2">
                      <Comercial360ThHelp helpLabel="Categoria" body={GLOSSARY.categoriaCliente}>
                        Categoria
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2">Documento</th>
                    <th className="px-2 py-2 text-center">
                      <Comercial360ThHelp helpLabel="Potencial CIF" body={RADAR.colPotencialCif}>
                        CIF
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-center">
                      <Comercial360ThHelp helpLabel="Contrato" body={GLOSSARY.contratoAtivo}>
                        Contrato
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Faturamento" body={GLOSSARY.faturamentoReal}>
                        Faturamento
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Potencial" body={GLOSSARY.potencialEstimado}>
                        Potencial
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {explore.map((r, i) => {
                    const mk = String(r.match_key ?? '');
                    const nome = String(r.razao_social || r.nome_fantasia || '').trim() || mk;
                    return (
                      <tr key={`${mk}-t-${i}`} className="border-t border-slate-100">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-slate-900">{nome}</td>
                        <td className="max-w-[120px] truncate px-2 py-2">{String(r.categoria_cliente ?? '')}</td>
                        <td className="max-w-[140px] truncate px-2 py-2">{String(r.tipo_documento_detectado ?? '')}</td>
                        <td className="px-2 py-2 text-center text-slate-700">{String(r.flag_potencial_cif ?? '')}</td>
                        <td className="px-2 py-2 text-center text-slate-700">{String(r.filtro_tem_contrato ?? '')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatBrl(toNum(r.faturamento_real))}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatBrl(toNum(r.potencial_estimado))}</td>
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

function Snap({ title, clients, value, help }: { title: string; clients: number; value: number; help: string }) {
  return (
    <div className="surface-card rounded-2xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <Comercial360HelpHint label={title} body={help} />
      </div>
      <p className="mt-3 text-2xl font-bold text-teal-900">{clients.toLocaleString('pt-BR')}</p>
      <p className="text-[11px] font-semibold uppercase text-teal-800/80">Clientes</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">{formatBrl(value)}</p>
      <p className="text-[11px] text-slate-500">Valor agregado no período</p>
    </div>
  );
}

export function BiComercial360RadarDashboard() {
  return (
    <Comercial360Shell
      variant="radar"
      title="Radar de prospecção"
      titleHelp={RADAR.tituloTela}
      description="Segmentos de ataque: CIF, vínculo de contrato e reativação — com o mesmo recorte temporal."
      interpret={INTERPRET.radar}
    >
      <RadarBody />
    </Comercial360Shell>
  );
}
