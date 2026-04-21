'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Mail, Phone } from 'lucide-react';
import { Comercial360Shell, useComercial360 } from '@/modules/gerencial/comercial360/Comercial360Shell';
import { formatBrl, toNum } from '@/modules/gerencial/comercial360/comercial360Format';
import { COCKPIT, GLOSSARY, INTERPRET } from '@/modules/gerencial/comercial360/comercial360HelpContent';
import { Comercial360HelpHint, Comercial360ThHelp } from '@/modules/gerencial/comercial360/Comercial360HelpHint';

type RadarSnap = {
  clientes_cif: number;
  faturamento_cif: number;
};

function CockpitBody() {
  const { queryString, openDrill } = useComercial360();
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);
  const [snap, setSnap] = useState<RadarSnap | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 40;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [kRes, rRes, oRes] = await Promise.all([
          fetch(`/api/bi/comercial-360/kpis?${queryString}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/bi/comercial-360/radar-snapshot?${queryString}`, { credentials: 'include', cache: 'no-store' }),
          fetch(`/api/bi/comercial-360/oportunidades?${queryString}&limit=${limit}&offset=${offset}`, {
            credentials: 'include',
            cache: 'no-store',
          }),
        ]);
        const kJson = kRes.ok ? await kRes.json() : null;
        const rJson = rRes.ok ? await rRes.json() : null;
        const oJson = oRes.ok ? await oRes.json() : null;
        if (cancelled) return;
        const parts: string[] = [];
        if (!kRes.ok) parts.push(String(kJson?.error || 'KPIs'));
        if (!rRes.ok) parts.push(String(rJson?.error || 'Radar'));
        if (!oRes.ok) parts.push(String(oJson?.error || 'Oportunidades'));
        setErr(parts.length ? parts.join(' · ') : null);
        if (kRes.ok) setKpis(kJson as Record<string, unknown>);
        if (rRes.ok && rJson) setSnap(rJson as RadarSnap);
        if (oRes.ok) {
          setRows(Array.isArray(oJson?.rows) ? oJson.rows : []);
          setTotal(Number(oJson?.meta?.total ?? 0));
        }
      } catch {
        if (!cancelled) setErr('Falha de rede ao carregar o cockpit');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString, offset]);

  const cards = [
    {
      label: 'Oportunidade total',
      value: kpis ? formatBrl(toNum(kpis.gap_na_mesa)) : '—',
      help: COCKPIT.oportunidadeTotal,
    },
    {
      label: 'Dinheiro em risco',
      value: kpis ? formatBrl(toNum(kpis.dinheiro_em_risco)) : '—',
      help: COCKPIT.dinheiroEmRiscoCard,
    },
    {
      label: 'Potencial CIF (faturamento)',
      value: snap ? formatBrl(snap.faturamento_cif) : '—',
      help: COCKPIT.potencialCifCard,
    },
    {
      label: 'Clientes na fila',
      value: total ? String(total.toLocaleString('pt-BR')) : '—',
      help: COCKPIT.clientesPrioritarios,
    },
  ];

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-600">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">Carregando prioridades…</span>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="surface-card rounded-2xl border border-slate-200/80 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <Comercial360HelpHint label={c.label} body={c.help} />
                </div>
                <p className="mt-1 text-lg font-bold text-slate-900">{c.value}</p>
                {c.label === 'Potencial CIF (faturamento)' && snap ? (
                  <p className="mt-1 text-[11px] text-slate-500">{snap.clientes_cif} contas com sinal CIF</p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="surface-card overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Ranking de oportunidades</h2>
                <Comercial360HelpHint label="Ranking" body={COCKPIT.rankingTitulo} />
              </div>
              <p className="text-xs text-slate-600">Ordenado por score — use o drill para histórico no período.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                  <tr>
                    <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">Cliente</th>
                    <th className="px-2 py-2">
                      <Comercial360ThHelp helpLabel="Próxima ação" body={GLOSSARY.proximaAcao}>
                        Próxima ação
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2">Contato</th>
                    <th className="px-2 py-2">
                      <Comercial360ThHelp helpLabel="Status" body={GLOSSARY.statusAtividade}>
                        Status
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Dinheiro em risco" body={GLOSSARY.dinheiroEmRisco}>
                        Risco
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="GAP" body={COCKPIT.colGap}>
                        GAP
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Potencial" body={GLOSSARY.potencialEstimado}>
                        Potencial
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2 text-right">
                      <Comercial360ThHelp helpLabel="Score" body={COCKPIT.colScore}>
                        Score
                      </Comercial360ThHelp>
                    </th>
                    <th className="px-2 py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const mk = String(r.match_key ?? '');
                    const email = String(r.email ?? '').trim();
                    const tel = String(r.telefone ?? '').trim();
                    const nome = String(r.razao_social || r.nome_fantasia || '').trim() || mk;
                    return (
                      <tr key={`${mk}-${i}`} className="border-t border-slate-100">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-slate-900">{nome}</td>
                        <td className="max-w-[140px] truncate px-2 py-2 text-slate-700" title={String(r.proxima_acao ?? '')}>
                          {String(r.proxima_acao ?? '')}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <div className="flex gap-1">
                            {email ? (
                              <a
                                href={`mailto:${encodeURIComponent(email)}`}
                                className="inline-flex rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                                title={email}
                                aria-label="Email"
                              >
                                <Mail className="size-3.5" />
                              </a>
                            ) : null}
                            {tel ? (
                              <a
                                href={`tel:${tel.replace(/\D/g, '')}`}
                                className="inline-flex rounded-lg border border-slate-200 p-1 text-slate-600 hover:bg-slate-50"
                                title={tel}
                                aria-label="Telefone"
                              >
                                <Phone className="size-3.5" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="max-w-[120px] truncate px-2 py-2 text-slate-600">{String(r.status_atividade ?? '')}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                          {formatBrl(toNum(r.dinheiro_em_risco))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                          {formatBrl(toNum(r.gap_estimado))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                          {formatBrl(toNum(r.potencial_estimado))}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-sl-navy">
                          {String(r.score_oportunidade ?? '')}
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
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
              <span>
                {total ? `Mostrando ${offset + 1}–${Math.min(offset + rows.length, total)} de ${total}` : 'Sem linhas'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                  disabled={offset <= 0}
                  onClick={() => setOffset((o) => Math.max(0, o - limit))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset((o) => o + limit)}
                >
                  Seguinte
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function BiComercial360CockpitDashboard() {
  return (
    <Comercial360Shell
      variant="cockpit"
      title="Cockpit Comercial 360"
      titleHelp={COCKPIT.tituloTela}
      description="Priorização imediata: próxima ação, contato rápido e drill por cliente no período selecionado."
      interpret={INTERPRET.cockpit}
    >
      <CockpitBody />
    </Comercial360Shell>
  );
}
