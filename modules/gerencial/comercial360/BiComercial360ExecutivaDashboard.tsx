'use client';

import React, { useEffect, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Comercial360Shell, useComercial360 } from '@/modules/gerencial/comercial360/Comercial360Shell';
import { formatBrl, toNum } from '@/modules/gerencial/comercial360/comercial360Format';
import { EXECUTIVA, GLOSSARY, INTERPRET } from '@/modules/gerencial/comercial360/comercial360HelpContent';
import { Comercial360HelpHint } from '@/modules/gerencial/comercial360/Comercial360HelpHint';
import { biGetJsonSafe } from '@/modules/gerencial/biApiClientCache';

function formatMes(iso: string): string {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  try {
    return format(parseISO(s), 'MMM/yy', { locale: ptBR });
  } catch {
    return s;
  }
}

const DONUT = ['#0f766e', '#1e3a5f', '#a16207', '#7c3aed', '#c2410c', '#64748b'];

function ExecBody() {
  const { queryString } = useComercial360();
  const [kpis, setKpis] = useState<Record<string, unknown> | null>(null);
  const [evo, setEvo] = useState<
    Array<{
      data_referencia: string;
      faturamento_real: number;
      potencial_estimado: number;
      gap_estimado: number;
    }>
  >([]);
  const [contrato, setContrato] = useState<{ name: string; value: number }[]>([]);
  const [doc, setDoc] = useState<{ name: string; value: number }[]>([]);
  const [categoria, setCategoria] = useState<{ name: string; value: number }[]>([]);
  const [status, setStatus] = useState<{ name: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [kRes, eRes, cRes, dRes, catRes, stRes] = await Promise.all([
          biGetJsonSafe<Record<string, unknown>>(`/api/bi/comercial-360/kpis?${queryString}`),
          biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/comercial-360/evolucao?${queryString}`),
          biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/comercial-360/resumo?tipo=contrato&${queryString}`),
          biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/comercial-360/resumo?tipo=documento&${queryString}`),
          biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/comercial-360/resumo?tipo=categoria&${queryString}`),
          biGetJsonSafe<{ rows?: unknown[] }>(`/api/bi/comercial-360/resumo?tipo=status&${queryString}`),
        ]);
        const messages: string[] = [];
        const kJson = kRes.ok ? kRes.data : null;
        const eJson = eRes.ok ? eRes.data : null;
        const cJson = cRes.ok ? cRes.data : null;
        const dJson = dRes.ok ? dRes.data : null;
        const catJson = catRes.ok ? catRes.data : null;
        const stJson = stRes.ok ? stRes.data : null;
        if (!kRes.ok) messages.push(kRes.error || 'KPIs');
        if (!eRes.ok) messages.push(eRes.error || 'Evolução');
        if (!cRes.ok) messages.push(cRes.error || 'Resumo contrato');
        if (!dRes.ok) messages.push(dRes.error || 'Resumo documento');
        if (!catRes.ok) messages.push(catRes.error || 'Resumo categoria');
        if (!stRes.ok) messages.push(stRes.error || 'Resumo status');
        if (cancelled) return;
        if (messages.length) setErr(messages.join(' · '));
        else setErr(null);
        if (kRes.ok) setKpis(kJson as Record<string, unknown>);
        if (eRes.ok)
          setEvo(
            (Array.isArray(eJson?.rows) ? eJson.rows : []) as Array<{
              data_referencia: string;
              faturamento_real: number;
              potencial_estimado: number;
              gap_estimado: number;
            }>,
          );
        if (cRes.ok) {
          const rows = (Array.isArray(cJson?.rows) ? cJson.rows : []) as Array<{
            filtro_tem_contrato?: string;
            faturamento_real?: unknown;
          }>;
          setContrato(
            rows.map((r) => ({
              name: String(r.filtro_tem_contrato || '—'),
              value: toNum(r.faturamento_real),
            })),
          );
        }
        if (dRes.ok) {
          const rows = (Array.isArray(dJson?.rows) ? dJson.rows : []) as Array<{
            tipo_documento_detectado?: string;
            faturamento_real?: unknown;
          }>;
          setDoc(
            rows.slice(0, 6).map((r) => ({
              name: String(r.tipo_documento_detectado || '—'),
              value: toNum(r.faturamento_real),
            })),
          );
        }
        if (catRes.ok) {
          const rows = (Array.isArray(catJson?.rows) ? catJson.rows : []) as Array<{
            categoria_cliente?: string;
            gap_estimado?: unknown;
          }>;
          setCategoria(
            rows.slice(0, 6).map((r) => ({
              name: String(r.categoria_cliente || '—'),
              value: toNum(r.gap_estimado),
            })),
          );
        }
        if (stRes.ok) {
          const rows = (Array.isArray(stJson?.rows) ? stJson.rows : []) as Array<{
            status_atividade?: string;
            dinheiro_em_risco?: unknown;
          }>;
          setStatus(
            rows.slice(0, 6).map((r) => ({
              name: String(r.status_atividade || '—'),
              value: toNum(r.dinheiro_em_risco),
            })),
          );
        }
      } catch {
        if (!cancelled) setErr('Falha de rede ao carregar a central executiva');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const chartData = evo.map((r) => ({
    mes: formatMes(r.data_referencia),
    real: r.faturamento_real,
    potencial: r.potencial_estimado,
    gap: r.gap_estimado,
  }));

  return (
    <div className="space-y-4">
      {err ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{err}</div>
      ) : null}
      {loading ? (
        <div className="flex items-center gap-2 py-16 text-slate-600">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-sm">Carregando visão executiva…</span>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Faturamento real"
              v={kpis ? formatBrl(toNum(kpis.faturamento_real)) : '—'}
              help={GLOSSARY.faturamentoReal}
            />
            <Kpi
              label="Potencial estimado"
              v={kpis ? formatBrl(toNum(kpis.potencial_estimado)) : '—'}
              help={GLOSSARY.potencialEstimado}
            />
            <Kpi
              label="GAP na mesa"
              v={kpis ? formatBrl(toNum(kpis.gap_na_mesa)) : '—'}
              help={GLOSSARY.gapNaMesa}
            />
            <Kpi
              label="Receita em contratos"
              v={kpis ? `${(toNum(kpis.receita_em_contratos_percentual) * 100).toFixed(1)}%` : '—'}
              help={EXECUTIVA.kpiReceitaContratos}
            />
          </div>
          <div className="surface-card rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Evolução mensal</h2>
              <Comercial360HelpHint label="Evolução mensal" body={EXECUTIVA.evolucaoMensal} />
            </div>
            <p className="text-xs text-slate-600">Faturamento real, potencial e GAP no período filtrado.</p>
            <div className="mt-4 h-72 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: number) => formatBrl(v)} />
                  <Legend />
                  <Bar dataKey="real" name="Faturamento real" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="potencial" name="Potencial" stroke="#0d9488" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="gap" name="GAP" stroke="#c2410c" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DonutBlock
              title="Faturamento por contrato"
              titleHelp={EXECUTIVA.graficoContrato}
              data={contrato}
              valueLabel="Faturamento"
            />
            <DonutBlock
              title="Top documentos (faturamento)"
              titleHelp={EXECUTIVA.graficoB2b}
              data={doc}
              valueLabel="Faturamento"
            />
            <DonutBlock
              title="GAP por categoria"
              titleHelp={EXECUTIVA.graficoCategoria}
              data={categoria}
              valueLabel="GAP"
            />
            <DonutBlock
              title="Risco por status"
              titleHelp={EXECUTIVA.graficoStatus}
              data={status}
              valueLabel="Risco"
            />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, v, help }: { label: string; v: string; help: string }) {
  return (
    <div className="surface-card rounded-2xl border border-slate-200/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <Comercial360HelpHint label={label} body={help} />
      </div>
      <p className="mt-1 text-lg font-bold text-slate-900">{v}</p>
    </div>
  );
}

function DonutBlock({
  title,
  titleHelp,
  data,
  valueLabel,
}: {
  title: string;
  titleHelp: string;
  data: { name: string; value: number }[];
  valueLabel: string;
}) {
  return (
    <div className="surface-card rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <Comercial360HelpHint label={title} body={titleHelp} />
      </div>
      <div className="mt-2 h-52 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie dataKey="value" data={data} innerRadius={48} outerRadius={70} paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT[i % DONUT.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => formatBrl(v)} labelFormatter={() => valueLabel} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-slate-600">
        {data.map((d) => (
          <li key={d.name} className="flex justify-between gap-2">
            <span className="truncate">{d.name}</span>
            <span className="shrink-0 tabular-nums font-semibold text-slate-900">{formatBrl(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BiComercial360ExecutivaDashboard() {
  return (
    <Comercial360Shell
      variant="executiva"
      title="Central 360 Executiva"
      titleHelp={EXECUTIVA.tituloTela}
      description="KPIs consolidados, série mensal e resumos por contrato e documento — sempre com os mesmos filtros da base."
      interpret={INTERPRET.executiva}
    >
      <ExecBody />
    </Comercial360Shell>
  );
}
