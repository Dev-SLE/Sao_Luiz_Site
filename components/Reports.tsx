import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { authClient } from '../lib/auth';
import { FileSpreadsheet, Download, Loader2, SlidersHorizontal, CalendarCheck2 } from 'lucide-react';
import { CteData } from '../types';

type ReportKind = 'dashboard' | 'pendencias' | 'criticos' | 'em_busca' | 'ocorrencias' | 'concluidos' | 'mix' | 'logs';

type ColumnKey =
  | 'CTE'
  | 'SERIE'
  | 'CODIGO'
  | 'DATA_EMISSAO'
  | 'DATA_BAIXA'
  | 'DATA_LIMITE_BAIXA'
  | 'STATUS'
  | 'STATUS_CALCULADO'
  | 'COLETA'
  | 'ENTREGA'
  | 'DESTINATARIO'
  | 'VALOR_CTE'
  | 'TX_ENTREGA'
  | 'VOLUMES'
  | 'PESO'
  | 'FRETE_PAGO'
  | 'NOTE_COUNT'
  | 'JUSTIFICATIVA'
  | 'STATUS_BUSCA';

interface ColumnDef {
  key: ColumnKey;
  label: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'CTE', label: 'CTE' },
  { key: 'SERIE', label: 'SERIE' },
  { key: 'CODIGO', label: 'CODIGO' },
  { key: 'DATA_EMISSAO', label: 'DATA EMISSÃO' },
  { key: 'DATA_BAIXA', label: 'DATA BAIXA' },
  { key: 'DATA_LIMITE_BAIXA', label: 'DATA LIMITE' },
  { key: 'STATUS_CALCULADO', label: 'STATUS CALCULADO' },
  { key: 'STATUS', label: 'STATUS' },
  { key: 'ENTREGA', label: 'UNIDADE (ENTREGA)' },
  { key: 'DESTINATARIO', label: 'DESTINATÁRIO' },
  { key: 'FRETE_PAGO', label: 'FRETE PAGO' },
  { key: 'VALOR_CTE', label: 'VALOR CTE' },
  { key: 'TX_ENTREGA', label: 'TX ENTREGA' },
  { key: 'VOLUMES', label: 'VOLUMES' },
  { key: 'PESO', label: 'PESO' },
  { key: 'NOTE_COUNT', label: 'NOTAS' },
  { key: 'COLETA', label: 'COLETA' },
  { key: 'JUSTIFICATIVA', label: 'JUSTIFICATIVA' },
  { key: 'STATUS_BUSCA', label: 'STATUS BUSCA' },
];

const normalizeRow = (row: any): CteData => ({
  CTE: row.cte || row.CTE || '',
  SERIE: row.serie || row.SERIE || '',
  CODIGO: row.codigo || row.CODIGO || '',
  DATA_EMISSAO: row.data_emissao || row.DATA_EMISSAO || '',
  DATA_BAIXA: row.data_baixa || row.DATA_BAIXA || '',
  PRAZO_BAIXA_DIAS: row.prazo_baixa_dias?.toString?.() || row.PRAZO_BAIXA_DIAS || '',
  DATA_LIMITE_BAIXA: row.data_limite_baixa || row.DATA_LIMITE_BAIXA || '',
  STATUS: row.status || row.STATUS || '',
  STATUS_CALCULADO: (row.status_calculado || row.STATUS_CALCULADO || undefined) as any,
  IS_HISTORICAL: row.is_historical || row.IS_HISTORICAL,
  COLETA: row.coleta || row.COLETA || '',
  ENTREGA: row.entrega || row.ENTREGA || '',
  VALOR_CTE: row.valor_cte?.toString?.() || row.VALOR_CTE || '',
  TX_ENTREGA: row.tx_entrega || row.TX_ENTREGA || '',
  VOLUMES: row.volumes || row.VOLUMES || '',
  PESO: row.peso || row.PESO || '',
  FRETE_PAGO: row.frete_pago || row.FRETE_PAGO || '',
  DESTINATARIO: row.destinatario || row.DESTINATARIO || '',
  JUSTIFICATIVA: row.justificativa || row.JUSTIFICATIVA || '',
  NOTE_COUNT: typeof row.note_count === 'number' ? row.note_count : parseInt(row.note_count || '0') || 0,
});

function escapeCsv(value: any) {
  const str = value === null || value === undefined ? '' : String(value);
  const s = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/[;"\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const Reports: React.FC = () => {
  const { user } = useAuth();
  const { hasPermission } = useData();

  const [kind, setKind] = useState<ReportKind>('dashboard');
  const [loading, setLoading] = useState(false);

  // Dados carregados do backend (já normalizados).
  const [rows, setRows] = useState<CteData[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [logRows, setLogRows] = useState<any[]>([]);

  // Filtros simples (unidade)
  const [unit, setUnit] = useState<string>('');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const units = useMemo(() => {
    const s = new Set(rows.map(r => r.ENTREGA).filter(Boolean));
    return Array.from(s).sort();
  }, [rows]);

  const parseDateKey = (value: string) => {
    if (!value) return 0;
    const [datePart] = String(value).split(' ');
    const dmy = datePart.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmy) {
      const [, dd, mm, yyyy] = dmy;
      return Number(`${yyyy}${mm.padStart(2, '0')}${dd.padStart(2, '0')}`);
    }
    const ymd = datePart.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      const [, yyyy, mm, dd] = ymd;
      return Number(`${yyyy}${mm.padStart(2, '0')}${dd.padStart(2, '0')}`);
    }
    return 0;
  };

  const filteredRows = useMemo(() => {
    const from = appliedDateFrom ? parseInt(appliedDateFrom.replace(/-/g, ''), 10) : 0;
    const to = appliedDateTo ? parseInt(appliedDateTo.replace(/-/g, ''), 10) : 0;
    return rows.filter((r) => {
      if (unit && r.ENTREGA !== unit) return false;
      if (!from && !to) return true;
      const baseDate = kind === 'concluidos' ? (r.DATA_BAIXA || '') : (r.DATA_EMISSAO || '');
      const k = parseDateKey(baseDate);
      if (!k) return false;
      if (from && k < from) return false;
      if (to && k > to) return false;
      return true;
    });
  }, [rows, unit, kind, appliedDateFrom, appliedDateTo]);

  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>([
    'CTE',
    'SERIE',
    'CODIGO',
    'DATA_EMISSAO',
    'DATA_BAIXA',
    'DATA_LIMITE_BAIXA',
    'STATUS_CALCULADO',
    'ENTREGA',
    'DESTINATARIO',
    'FRETE_PAGO',
    'VALOR_CTE',
    'TX_ENTREGA',
    'NOTE_COUNT',
  ]);

  const canExport = hasPermission('MANAGE_SETTINGS');

  useEffect(() => {
    // Ao trocar tipo de relatório, carregamos de novo.
    // (poderia ser botão "Carregar", mas o usuário pediu agilidade/sem travar)
    let cancelled = false;
    const run = async () => {
      if (!canExport) return;
      setLoading(true);
      try {
        const limit = 10000;
        if (kind === 'dashboard') {
          const resp = await authClient.getCtesDashboard(1, limit);
          if (cancelled) return;
          setRows((resp?.data || []).map(normalizeRow));
          setTotal(resp?.total || (resp?.data?.length || 0));
        } else if (kind === 'mix') {
          // Mix: combina pendencias + criticos + em_busca + ocorrencias (sem concluídos)
          const [p, c, b, t] = await Promise.all([
            authClient.getCtesView('pendencias', 1, limit),
            authClient.getCtesView('criticos', 1, limit),
            authClient.getCtesView('em_busca', 1, limit),
            authClient.getCtesView('ocorrencias', 1, limit),
          ]);
          if (cancelled) return;
          const merged = [...(p.data || []), ...(c.data || []), ...(b.data || []), ...(t.data || [])];
          const seen = new Set<string>();
          const deduped: any[] = [];
          for (const r of merged) {
            const k = `${r.cte || ''}|${String(r.serie || '').replace(/^0+/, '')}`;
            if (seen.has(k)) continue;
            seen.add(k);
            deduped.push(r);
          }
          setRows(deduped.map(normalizeRow));
          setTotal(deduped.length);
        } else if (kind === 'logs') {
          const resp = await fetch('/api/app_logs?limit=10000');
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const logs = await resp.json();
          if (cancelled) return;
          setLogRows(Array.isArray(logs) ? logs : []);
          setRows([]);
          setTotal(Array.isArray(logs) ? logs.length : 0);
        } else {
          const view = kind as Exclude<ReportKind, 'dashboard' | 'mix'>;
          const resp = await authClient.getCtesView(view as any, 1, limit);
          if (cancelled) return;
          setRows((resp?.data || []).map(normalizeRow));
          setLogRows([]);
          setTotal(resp?.total || (resp?.data?.length || 0));
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          console.error('Erro ao carregar relatório:', e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [kind, canExport]);

  const reportLabel = useMemo(() => {
    switch (kind) {
      case 'dashboard':
        return 'Pendências Totais (dashboard)';
      case 'pendencias':
        return 'Pendências';
      case 'criticos':
        return 'Críticos';
      case 'em_busca':
        return 'Em Busca';
      case 'ocorrencias':
        return 'Ocorrências';
      case 'concluidos':
        return 'Concluídos';
      case 'mix':
        return 'Mix (pendências + críticos + em busca + ocorrências)';
      case 'logs':
        return 'Logs do sistema';
      default:
        return 'Relatório';
    }
  }, [kind]);

  const selectedLogRows = useMemo(() => {
    return logRows.map((l) => ({
      DATA: l.created_at || '',
      NIVEL: l.level || '',
      EVENTO: l.event || '',
      USUARIO: l.username || '',
      CTE: l.cte || '',
      SERIE: l.serie || '',
      DETALHES: l.payload ? JSON.stringify(l.payload) : '',
    }));
  }, [logRows]);

  const exportBaseRows = useMemo(() => {
    return filteredRows.map(r => {
      const base: Record<string, any> = {};
      for (const col of selectedColumns) {
        switch (col) {
          case 'STATUS_CALCULADO':
            base[col] = r.STATUS_CALCULADO ?? '';
            break;
          case 'STATUS':
            base[col] = r.STATUS ?? '';
            break;
          case 'NOTE_COUNT':
            base[col] = r.NOTE_COUNT ?? 0;
            break;
          default:
            base[col] = (r as any)[col] ?? '';
        }
      }
      return base;
    });
  }, [filteredRows, selectedColumns]);

  const exportCsv = () => {
    if (!canExport) return;
    if (kind === 'logs') {
      const headers = ['DATA', 'NIVEL', 'EVENTO', 'USUARIO', 'CTE', 'SERIE', 'DETALHES'];
      const lines: string[] = [headers.join(';')];
      for (const r of selectedLogRows) {
        lines.push(headers.map((h) => escapeCsv((r as any)[h])).join(';'));
      }
      const csv = lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RELATORIO_logs_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const headers = selectedColumns.map(c => ALL_COLUMNS.find(x => x.key === c)?.label || c);
    const lines: string[] = [];
    lines.push(headers.join(';'));
    for (const r of exportBaseRows) {
      const row = selectedColumns.map(c => escapeCsv(r[c]));
      lines.push(row.join(';'));
    }
    const csv = lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RELATORIO_${kind}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = () => {
    if (!canExport) return;
    if (kind === 'logs') {
      const ws = XLSX.utils.json_to_sheet(selectedLogRows, { skipHeader: false });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Logs');
      XLSX.writeFile(wb, `RELATORIO_logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
      return;
    }
    const headers = selectedColumns.map(c => ALL_COLUMNS.find(x => x.key === c)?.label || c);
    const data = exportBaseRows.map(obj => {
      const out: Record<string, any> = {};
      selectedColumns.forEach((c, idx) => {
        const label = headers[idx];
        out[label] = obj[c];
      });
      return out;
    });

    const ws = XLSX.utils.json_to_sheet(data, { skipHeader: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
    XLSX.writeFile(wb, `RELATORIO_${kind}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  if (!canExport) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-sm">
        <h3 className="text-lg font-bold">Sem permissão</h3>
        <p className="mt-1 text-sm text-slate-500">Seu perfil não possui acesso aos relatórios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-slate-900">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-slate-100 p-2 text-sl-red border border-slate-200 shadow-[0_0_18px_rgba(236,27,35,0.4)]">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black">Relatórios</h1>
            <p className="text-xs text-slate-500">{reportLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sl-red"
            disabled={loading || exportBaseRows.length === 0}
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={exportXlsx}
            className="inline-flex items-center gap-2 rounded-xl bg-sl-navy px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-sl-red"
            disabled={loading || exportBaseRows.length === 0}
          >
            <FileSpreadsheet size={14} /> Excel
          </button>
        </div>
      </div>

      {/* Tabs de tipo */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['dashboard', 'Pendências Totais'],
            ['pendencias', 'Pendências'],
            ['criticos', 'Críticos'],
            ['em_busca', 'Em Busca'],
            ['ocorrencias', 'Ocorrências'],
            ['concluidos', 'Concluídos'],
            ['mix', 'Mix'],
            ['logs', 'Logs do Sistema'],
          ] as Array<[ReportKind, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setUnit('');
              setDraftDateFrom('');
              setDraftDateTo('');
              setAppliedDateFrom('');
              setAppliedDateTo('');
            }}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
              kind === k
                ? 'border-sl-navy bg-sl-navy text-white'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-sl-navy/40'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Unidade</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sl-navy/30"
          >
            <option value="">Todas as Unidades</option>
            {units.map(u => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            {kind === 'concluidos' ? 'Data baixa' : 'Data emissão'}
          </span>
          <input
            type="date"
            value={draftDateFrom}
            onChange={(e) => setDraftDateFrom(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sl-navy/30"
          />
          <input
            type="date"
            value={draftDateTo}
            onChange={(e) => setDraftDateTo(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sl-navy/30"
          />
          <button
            type="button"
            onClick={() => { setAppliedDateFrom(draftDateFrom); setAppliedDateTo(draftDateTo); }}
            className="inline-flex items-center gap-1 rounded-lg border border-sl-navy/40 bg-sl-navy px-3 py-1 text-[11px] font-black text-white transition-colors hover:bg-sl-navy-light"
          >
            <CalendarCheck2 size={12} />
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => { setDraftDateFrom(''); setDraftDateTo(''); setAppliedDateFrom(''); setAppliedDateTo(''); }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Limpar
          </button>
        </div>

        <div className="text-[11px] text-slate-500">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Carregando...
            </span>
          ) : (
            <span>
              Linhas: <span className="font-bold text-slate-800">{kind === 'logs' ? selectedLogRows.length : filteredRows.length}</span> (total: {total})
            </span>
          )}
        </div>
      </div>

      {/* Colunas */}
      {kind !== 'logs' && <div className="bg-white border border-slate-200 rounded-xl p-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Colunas</span>
          <button
            type="button"
            onClick={() => setSelectedColumns(ALL_COLUMNS.map(c => c.key))}
            className="text-[11px] font-bold text-sl-navy hover:text-[#243a7a]"
          >
            Selecionar todas
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_COLUMNS.map(c => {
            const checked = selectedColumns.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setSelectedColumns(prev =>
                    checked ? prev.filter(x => x !== c.key) : [...prev, c.key]
                  );
                }}
                className={clsx(
                  'px-3 py-1 rounded-lg text-xs font-bold border transition-colors',
                  checked
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-sl-navy/40'
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>}

      {/* Preview mínimo */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
            Preview (primeiras 50 linhas)
          </span>
          <span className="text-[11px] text-slate-500">
            {kind === 'logs' ? selectedLogRows.slice(0, 50).length : filteredRows.slice(0, 50).length}/{kind === 'logs' ? selectedLogRows.length : filteredRows.length}
          </span>
        </div>
        <div className="max-h-[340px] overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-700">
              <tr>
                {kind !== 'logs' && selectedColumns.map(c => (
                  <th key={c} className="px-3 py-2">
                    {ALL_COLUMNS.find(x => x.key === c)?.label || c}
                  </th>
                ))}
                {kind === 'logs' && ['Data', 'Nível', 'Evento', 'Usuário', 'CTE', 'Série', 'Detalhes'].map((h) => (
                  <th key={h} className="px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {kind !== 'logs' && filteredRows.slice(0, 50).map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80">
                  {selectedColumns.map(c => (
                    <td key={c} className="whitespace-nowrap px-3 py-2 text-slate-800">
                      {(() => {
                        switch (c) {
                          case 'STATUS_CALCULADO':
                            return r.STATUS_CALCULADO ?? '';
                          case 'STATUS':
                            return r.STATUS ?? '';
                          case 'NOTE_COUNT':
                            return r.NOTE_COUNT ?? 0;
                          default:
                            return (r as any)[c] ?? '';
                        }
                      })()}
                    </td>
                  ))}
                </tr>
              ))}
              {kind === 'logs' && selectedLogRows.slice(0, 50).map((r, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-800">{r.DATA}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-800">{r.NIVEL}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-800">{r.EVENTO}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-800">{r.USUARIO}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-800">{r.CTE}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-800">{r.SERIE}</td>
                  <td className="px-3 py-2 text-slate-800 max-w-[360px] truncate">{r.DETALHES}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;

