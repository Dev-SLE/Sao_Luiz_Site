import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { authClient } from '../lib/auth';
import { FileSpreadsheet, Download, Loader2, SlidersHorizontal } from 'lucide-react';
import { CteData } from '../types';

type ReportKind = 'dashboard' | 'pendencias' | 'criticos' | 'em_busca' | 'tad' | 'concluidos' | 'mix';

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

  // Filtros simples (unidade)
  const [unit, setUnit] = useState<string>('');
  const units = useMemo(() => {
    const s = new Set(rows.map(r => r.ENTREGA).filter(Boolean));
    return Array.from(s).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!unit) return rows;
    return rows.filter(r => r.ENTREGA === unit);
  }, [rows, unit]);

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
          // Mix: combina pendencias + criticos + em_busca + tad (sem concluídos)
          const [p, c, b, t] = await Promise.all([
            authClient.getCtesView('pendencias', 1, limit),
            authClient.getCtesView('criticos', 1, limit),
            authClient.getCtesView('em_busca', 1, limit),
            authClient.getCtesView('tad', 1, limit),
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
        } else {
          const view = kind as Exclude<ReportKind, 'dashboard' | 'mix'>;
          const resp = await authClient.getCtesView(view as any, 1, limit);
          if (cancelled) return;
          setRows((resp?.data || []).map(normalizeRow));
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
      case 'tad':
        return 'TAD';
      case 'concluidos':
        return 'Concluídos';
      case 'mix':
        return 'Mix (pendências + críticos + em busca + TAD)';
      default:
        return 'Relatório';
    }
  }, [kind]);

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
      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-6 shadow-sm text-white">
        <h3 className="text-lg font-bold">Sem permissão</h3>
        <p className="text-sm text-gray-400 mt-1">Seu perfil não possui acesso aos relatórios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 text-white">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[#0F103A] p-2 text-[#EC1B23] border border-[#1A1B62] shadow-[0_0_18px_rgba(236,27,35,0.4)]">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black">Relatórios</h1>
            <p className="text-xs text-gray-400">{reportLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A1B62] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(26,27,98,0.7)] hover:bg-[#EC1B23] transition-all"
            disabled={loading || exportBaseRows.length === 0}
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={exportXlsx}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1A1B62] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_18px_rgba(26,27,98,0.7)] hover:bg-[#EC1B23] transition-all"
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
            ['tad', 'TAD'],
            ['concluidos', 'Concluídos'],
            ['mix', 'Mix'],
          ] as Array<[ReportKind, string]>
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setKind(k);
              setUnit('');
            }}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
              kind === k
                ? 'bg-white text-[#1A1B62] border-white'
                : 'bg-[#080816] border-[#1A1B62] text-gray-300 hover:border-[#6E71DA]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between">
        <div className="flex items-center gap-2 bg-[#070A20] border border-[#1E226F] rounded-xl px-3 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">Unidade</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="appearance-none bg-[#070A20] border border-[#1E226F] text-gray-100 text-xs font-bold px-2 py-1 rounded-lg outline-none focus:ring-2 focus:ring-[#EC1B23]/60"
          >
            <option value="">Todas as Unidades</option>
            {units.map(u => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        <div className="text-[11px] text-gray-400">
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Carregando...
            </span>
          ) : (
            <span>
              Linhas: <span className="font-bold text-gray-200">{filteredRows.length}</span> (total: {total})
            </span>
          )}
        </div>
      </div>

      {/* Colunas */}
      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl p-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">Colunas</span>
          <button
            type="button"
            onClick={() => setSelectedColumns(ALL_COLUMNS.map(c => c.key))}
            className="text-[11px] font-bold text-primary-300 hover:text-primary-200"
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
                    ? 'bg-[#EC1B23]/15 border-[#EC1B23] text-[#FF8A8A]'
                    : 'bg-[#080816] border-[#1A1B62] text-gray-300 hover:border-[#6E71DA]'
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview mínimo */}
      <div className="bg-[#070A20] border border-[#1E226F] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E226F] flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
            Preview (primeiras 50 linhas)
          </span>
          <span className="text-[11px] text-gray-400">
            {filteredRows.slice(0, 50).length}/{filteredRows.length}
          </span>
        </div>
        <div className="max-h-[340px] overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#080816] text-gray-200 uppercase font-bold text-xs">
              <tr>
                {selectedColumns.map(c => (
                  <th key={c} className="px-3 py-2">
                    {ALL_COLUMNS.find(x => x.key === c)?.label || c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1B62]">
              {filteredRows.slice(0, 50).map((r, idx) => (
                <tr key={idx} className="hover:bg-[#0F1440]/60">
                  {selectedColumns.map(c => (
                    <td key={c} className="px-3 py-2 text-gray-100 whitespace-nowrap">
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;

