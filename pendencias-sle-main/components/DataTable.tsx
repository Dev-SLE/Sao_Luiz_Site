import React, { useEffect, useMemo, useState } from 'react';
import { CteData } from '../types';
import StatusBadge from './StatusBadge';
import { MessageSquare, Filter, X, CheckCircle, Package, ArrowUpDown, ArrowUp, ArrowDown, FileSpreadsheet, Search, AlertTriangle, CalendarCheck2, Archive } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import clsx from 'clsx';
import { COLORS } from '../constants';
import { authClient } from '../lib/auth';

interface Props {
  data: CteData[];
  onNoteClick: (cte: CteData) => void;
  title: string;
  isPendencyView?: boolean;
  isCriticalView?: boolean;
  enableFilters?: boolean; // New prop to force enable filters
  ignoreUnitFilter?: boolean; // Forces table to ignore user's linked unit (for Global Views like Em Busca)
  serverPagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
  };
}

type SortDirection = 'asc' | 'desc';
interface SortConfig {
  key: keyof CteData | 'STATUS_CALCULADO' | 'VALOR_NUMBER' | 'DATA_LIMITE_DATE' | 'DATA_BAIXA_DATE';
  direction: SortDirection;
}

interface FilterCardProps {
  label: string;
  count: number;
  color: string;
  selected: boolean;
  dimmed?: boolean; // New prop for visual feedback
  onClick: () => void;
}

const FilterCard: React.FC<FilterCardProps> = ({ label, count, color, selected, dimmed, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'group relative flex h-[72px] cursor-pointer select-none flex-col justify-between overflow-hidden rounded-xl border p-3 text-left transition-all',
      'border-slate-300/80 bg-gradient-to-b from-white to-slate-50/40 text-slate-700 shadow-sm hover:border-slate-400/80 hover:shadow-md',
      selected && 'z-10 scale-[1.02] ring-2 ring-[#e42424]/30',
      dimmed && !selected ? 'opacity-50 grayscale-[0.35]' : 'opacity-100',
    )}
    style={{
      borderColor: selected ? color : undefined,
      boxShadow: selected ? `0 4px 12px -2px ${color}30` : undefined,
    }}
  >
    <div className="mb-1 flex w-full items-start justify-between">
      <span
        className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500"
        style={{ color: selected ? color : undefined }}
      >
        {label}
      </span>
      {selected && <CheckCircle size={14} fill={color} className="shrink-0 text-white" />}
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-black leading-none tracking-tight text-slate-900">{count}</span>
    </div>
    <div
      className="absolute bottom-0 left-0 h-1 w-full transition-all"
      style={{ backgroundColor: color, opacity: selected ? 1 : 0.35 }}
    />
  </button>
);

const DataTable: React.FC<Props> = ({ data, onNoteClick, title, isPendencyView = false, isCriticalView = false, enableFilters = false, ignoreUnitFilter = false, serverPagination }) => {
  // --- Filter State ---
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [paymentFilters, setPaymentFilters] = useState<string[]>([]);
  const [noteFilter, setNoteFilter] = useState<'ALL' | 'WITH' | 'WITHOUT'>('ALL');
  const [filterTxEntrega, setFilterTxEntrega] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [dateField, setDateField] = useState<'EMISSAO' | 'LIMITE' | 'BAIXA'>('LIMITE');
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  // --- Sort State ---
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'DATA_LIMITE_DATE', direction: 'asc' });

  const { user } = useAuth();
  const { notes, fullData, processControlData, isCteEmBusca, hasPermission } = useData();

  // --- Paginação (local ou server-side) ---
  const [pageLocal, setPageLocal] = useState(1);
  const [limitLocal, setLimitLocal] = useState(50);
  const hasActiveTableFilters =
    selectedUnit.trim().length > 0 ||
    statusFilters.length > 0 ||
    paymentFilters.length > 0 ||
    noteFilter !== 'ALL' ||
    filterTxEntrega ||
    appliedDateFrom.trim().length > 0 ||
    appliedDateTo.trim().length > 0 ||
    globalSearch.trim().length > 0;

  const shouldUseLocalPagination = !!serverPagination && hasActiveTableFilters;
  const useServerPagination = !!serverPagination && !shouldUseLocalPagination;

  const page = useServerPagination ? serverPagination!.page : pageLocal;
  const limit = useServerPagination ? serverPagination!.limit : limitLocal;
  const totalFromServer = serverPagination?.total;

  const setPage = (p: number) =>
    useServerPagination ? serverPagination!.onPageChange(p) : setPageLocal(p);

  const setLimit = (l: number) => {
    if (useServerPagination) return serverPagination!.onLimitChange(l);
    setLimitLocal(l);
    setPageLocal(1);
  };

  const serverView = useMemo(() => {
    const t = (title || '').toLowerCase();
    if (t.includes('crític') || t.includes('critic')) return 'criticos' as const;
    if (t.includes('em busca')) return 'em_busca' as const;
    if (t.includes('tad')) return 'tad' as const;
    if (t.includes('conclu')) return 'concluidos' as const;
    return 'pendencias' as const;
  }, [title]);

  const [allViewData, setAllViewData] = useState<CteData[] | null>(null);
  const [allViewLoading, setAllViewLoading] = useState(false);

  const normalizeCtes = (rows: any[]): CteData[] =>
    (rows || []).map((row: any) => ({
      CTE: row.cte || '',
      SERIE: row.serie || '',
      CODIGO: row.codigo || '',
      DATA_EMISSAO: row.data_emissao || '',
      DATA_BAIXA: row.data_baixa || '',
      PRAZO_BAIXA_DIAS: row.prazo_baixa_dias?.toString() || '',
      DATA_LIMITE_BAIXA: row.data_limite_baixa || '',
      STATUS: row.status || '',
      STATUS_CALCULADO: (row.status_calculado || undefined) as any,
      COLETA: row.coleta || '',
      ENTREGA: row.entrega || '',
      VALOR_CTE: row.valor_cte?.toString() || '',
      TX_ENTREGA: row.tx_entrega || '',
      VOLUMES: row.volumes || '',
      PESO: row.peso || '',
      FRETE_PAGO: row.frete_pago || '',
      DESTINATARIO: row.destinatario || '',
      JUSTIFICATIVA: row.justificativa || '',
      NOTE_COUNT:
        typeof row.note_count === 'number'
          ? row.note_count
          : parseInt(row.note_count || '0') || 0,
    }));

  const [serverCounts, setServerCounts] = useState<null | {
    total: number;
    statusCounts: Record<string, number>;
    paymentCounts: Record<string, number>;
    noteWith: number;
    noteWithout: number;
    txEntrega: number;
  }>(null);

  useEffect(() => {
    if (!serverPagination) {
      setServerCounts(null);
      return;
    }
    if (globalSearch.trim()) {
      setServerCounts(null);
      return;
    }
    if (appliedDateFrom || appliedDateTo) {
      setServerCounts(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const payload = {
          view: serverView,
          unit: selectedUnit || undefined,
          statusFilters,
          paymentFilters,
          noteFilter,
          filterTxEntrega,
          ignoreUnitFilter,
          userLinkedDestUnit: user?.linkedDestUnit || undefined,
        };
        const resp = await authClient.getCtesViewCounts(payload as any);
        if (!cancelled) {
          setServerCounts({
            total: resp?.total || 0,
            statusCounts: resp?.statusCounts || {},
            paymentCounts: resp?.paymentCounts || {},
            noteWith: resp?.noteWith || 0,
            noteWithout: resp?.noteWithout || 0,
            txEntrega: resp?.txEntrega || 0,
          });
        }
      } catch {
        if (!cancelled) setServerCounts(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [serverView, selectedUnit, statusFilters.join('|'), paymentFilters.join('|'), noteFilter, filterTxEntrega, ignoreUnitFilter, user?.linkedDestUnit, globalSearch, appliedDateFrom, appliedDateTo]);

  // Quando houver filtros, buscamos o "view" completo uma vez e aplicamos os filtros localmente,
  // para que o número de páginas e os resultados batam com os cards (ctes_view_counts).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!serverPagination) return;
      if (!shouldUseLocalPagination) {
        setAllViewData(null);
        return;
      }
      setAllViewLoading(true);
      try {
        const resp = await authClient.getCtesView(serverView as any, 1, 10000);
        if (cancelled) return;
        setAllViewData(normalizeCtes(resp?.data || []));
      } catch (e) {
        if (!cancelled) setAllViewData([]);
      } finally {
        if (!cancelled) setAllViewLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [serverPagination, shouldUseLocalPagination, serverView]);

  // Main Data Filtering Logic
  // (Estados já declarados no início do componente)
  // --- Sort State ---
  // (Estado já declarado no início do componente)

  // Main Data Filtering Logic
  const filteredData = useMemo(() => {
    const isGlobalSearch = globalSearch.trim().length > 0;
    const sourceRows = shouldUseLocalPagination ? (allViewData ?? []) : data;
    let result: CteData[] = [];
    if (isGlobalSearch) {
      const term = globalSearch.toLowerCase();
      const baseForSearch = shouldUseLocalPagination ? (allViewData ?? []) : (fullData.length > 0 ? fullData : data);
      const activeMatches = baseForSearch.filter(d =>
        d.CTE.toLowerCase().includes(term) ||
        (d.DESTINATARIO || '').toLowerCase().includes(term) ||
        (d.ENTREGA || '').toLowerCase().includes(term) ||
        (d.SERIE || '').toLowerCase().includes(term)
      );
      const matchedCtesInHistory = new Set<string>();
      const isAlreadyActive = (cte: string) => activeMatches.some(a => a.CTE === cte);
      processControlData.forEach(p => {
        if (p.CTE.includes(term) && !isAlreadyActive(p.CTE)) {
          matchedCtesInHistory.add(p.CTE);
        }
      });
      // Se não carregamos notas globais, não há histórico adicional para buscar aqui.
      const historicalMatches: CteData[] = Array.from(matchedCtesInHistory).map(cteStr => {
        const pInfo = processControlData.find(p => p.CTE === cteStr);
        const nInfo = notes.find(n => n.CTE === cteStr);
        return {
          CTE: cteStr,
          SERIE: pInfo?.SERIE || nInfo?.SERIE || '0',
          CODIGO: '',
          DATA_EMISSAO: '',
          PRAZO_BAIXA_DIAS: '',
          DATA_LIMITE_BAIXA: '',
          STATUS: 'HISTÓRICO',
          STATUS_CALCULADO: 'NO PRAZO',
          COLETA: '',
          ENTREGA: 'ARQUIVO',
          VALOR_CTE: '0,00',
          TX_ENTREGA: '0',
          VOLUMES: '0',
          PESO: '0',
          FRETE_PAGO: '',
          DESTINATARIO: 'HISTÓRICO / BAIXADO',
          JUSTIFICATIVA: '',
          IS_HISTORICAL: true
        };
      });
      result = [...activeMatches, ...historicalMatches];
    } else {
      result = sourceRows;
      if (isPendencyView) result = result.filter(d => d.STATUS_CALCULADO !== 'CRÍTICO');
    }
    const userRestrictedUnit = (ignoreUnitFilter || isGlobalSearch) ? null : user?.linkedDestUnit;
    const effectiveUnit = selectedUnit || userRestrictedUnit;
    if (effectiveUnit) {
      result = result.filter(d => d.ENTREGA === effectiveUnit || (d.IS_HISTORICAL && d.ENTREGA === 'ARQUIVO'));
    }
    if (statusFilters.length > 0) {
      if (serverView === 'concluidos') {
        result = result.filter(d => statusFilters.includes(d.STATUS || ''));
      } else {
        result = result.filter(d => statusFilters.includes(d.STATUS_CALCULADO || ''));
      }
    }
    if (paymentFilters.length > 0) result = result.filter(d => paymentFilters.includes(d.FRETE_PAGO || ''));
    if (noteFilter !== 'ALL') {
      result = result.filter(d => {
        const count = getNoteCount(d.CTE, d);
        return noteFilter === 'WITH' ? count > 0 : count === 0;
      });
    }
    if (filterTxEntrega) {
      result = result.filter(d => parseCurrency(d.TX_ENTREGA) > 0);
    }
    const fromKey = dateInputToKey(appliedDateFrom);
    const toKey = dateInputToKey(appliedDateTo);
    if (fromKey || toKey) {
      result = result.filter((d) => {
        const k = getDateKeyByField(d);
        if (!k) return false;
        if (fromKey && k < fromKey) return false;
        if (toKey && k > toKey) return false;
        return true;
      });
    }
    return result;
  }, [
    data,
    fullData,
    allViewData,
    shouldUseLocalPagination,
    processControlData,
    notes,
    globalSearch,
    isPendencyView,
    user,
    selectedUnit,
    statusFilters,
    paymentFilters,
    noteFilter,
    filterTxEntrega,
    dateField,
    appliedDateFrom,
    appliedDateTo,
    ignoreUnitFilter,
  ]);
  const sortedData = useMemo(() => {
    const sorted = [...filteredData];
    sorted.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      switch (sortConfig.key) {
        case 'VALOR_NUMBER':
          valA = parseCurrency(a.VALOR_CTE);
          valB = parseCurrency(b.VALOR_CTE);
          break;
        case 'DATA_LIMITE_DATE':
          valA = parseDate(a.DATA_LIMITE_BAIXA);
          valB = parseDate(b.DATA_LIMITE_BAIXA);
          break;
        case 'DATA_BAIXA_DATE':
          valA = parseDate(a.DATA_BAIXA || '');
          valB = parseDate(b.DATA_BAIXA || '');
          break;
        case 'CTE':
          valA = parseInt(a.CTE) || 0;
          valB = parseInt(b.CTE) || 0;
          break;
        case 'STATUS_CALCULADO':
          valA = a.STATUS_CALCULADO || a.STATUS || '';
          valB = b.STATUS_CALCULADO || b.STATUS || '';
          break;
        default:
          valA = (a as any)[sortConfig.key] || '';
          valB = (b as any)[sortConfig.key] || '';
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredData, sortConfig]);

  const total = shouldUseLocalPagination
    ? (serverCounts?.total ?? sortedData.length)
    : (typeof totalFromServer === 'number' ? totalFromServer : sortedData.length);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedData = useMemo(() => {
    if (useServerPagination) return sortedData;
    const start = (page - 1) * limit;
    const end = start + limit;
    return sortedData.slice(start, end);
  }, [sortedData, page, limit, useServerPagination]);

  // --- Constants ---
  const STATUS_OPTIONS = useMemo(() => {
    if (isCriticalView) return [];
    if (serverView === 'concluidos') {
      return [
        'CONCLUIDO CRÍTICO',
        'CONCLUIDO FORA DO PRAZO',
        'CONCLUIDO NO PRAZO',
        'CONCLUIDO (SEM LIMITE)',
      ];
    }
    if (isPendencyView) return ['FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHÃ', 'NO PRAZO'];
    return ['CRÍTICO', 'FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHÃ', 'NO PRAZO'];
  }, [isPendencyView, isCriticalView, serverView]);
  const STATUS_LABELS: Record<string, string> = {
    PRIORIDADE: 'VENCE HOJE',
  };

  const PAYMENT_OPTIONS = ['CIF', 'FOB', 'FATURAR_REMETENTE', 'FATURAR_DEST'];
  
  const STATUS_COLORS_MAP: Record<string, string> = {
    'CRÍTICO': COLORS.critical,
    'FORA DO PRAZO': COLORS.late,
    'PRIORIDADE': COLORS.priority,
    'VENCE AMANHÃ': COLORS.tomorrow,
    'NO PRAZO': COLORS.ontime,
    'CONCLUIDO CRÍTICO': COLORS.critical,
    'CONCLUIDO FORA DO PRAZO': COLORS.priority,
    'CONCLUIDO NO PRAZO': COLORS.ontime,
    'CONCLUIDO (SEM LIMITE)': '#10b981',
  };

  const PAYMENT_COLORS_MAP: Record<string, string> = {
    'CIF': '#10b981',
    'FOB': '#ef4444',
    'FATURAR_REMETENTE': '#eab308',
    'FATURAR_DEST': '#f97316'
  };

  const latestEmissaoDate = useMemo(() => {
    const source = shouldUseLocalPagination ? (allViewData ?? []) : data;
    if (source.length === 0) return '--/--/----';
    let maxVal = 0;
    let maxStr = '';
    source.forEach((d: CteData) => {
       if (!d.DATA_EMISSAO) return;
       const parts = d.DATA_EMISSAO.split('/');
       if (parts.length === 3) {
           const val = parseInt(parts[2] + parts[1].padStart(2, '0') + parts[0].padStart(2, '0'));
           if (val > maxVal) { maxVal = val; maxStr = d.DATA_EMISSAO; }
       }
    });
    return maxStr || '--/--/----';
  }, [data, allViewData, shouldUseLocalPagination]);

  const toggleFilter = (list: string[], item: string) => {
    return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
  };

  function getNoteCount(cte: string, row?: CteData) {
    if (typeof row?.NOTE_COUNT === 'number') return row.NOTE_COUNT;
    return notes.filter(n => n.CTE === cte).length;
  }

  function parseCurrency(value: string) {
    if (!value) return 0;
    try {
        const clean = value.replace(/[^\d,-]/g, '').replace(',', '.');
        return parseFloat(clean) || 0;
    } catch { return 0; }
  }

  const formatDateOnly = (value?: string | null) => {
    if (!value) return '-';
    const [datePart] = String(value).split(' ');
    return datePart || '-';
  };

  function parseDate(dateStr: string) {
    if (!dateStr) return 0;
    const [datePart] = dateStr.split(' ');
    const parts = datePart.split('/');
    if (parts.length !== 3) return 0;
    return parseInt(`${parts[2]}${parts[1]}${parts[0]}`);
  }

  function dateInputToKey(input: string) {
    if (!input) return 0;
    const parts = input.split('-');
    if (parts.length !== 3) return 0;
    return parseInt(`${parts[0]}${parts[1]}${parts[2]}`);
  }

  function getDateKeyByField(row: CteData) {
    const raw =
      dateField === 'EMISSAO'
        ? row.DATA_EMISSAO || ''
        : dateField === 'BAIXA'
          ? row.DATA_BAIXA || ''
          : row.DATA_LIMITE_BAIXA || '';
    return parseDate(raw);
  }

  const handleSort = (sortKey: SortConfig['key']) => {
    setSortConfig(current => ({
      key: sortKey,
      direction: current.key === sortKey && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const availableUnits = useMemo(() => {
    // During global search, allow searching any unit found in fullData
    const sourceForUnits = shouldUseLocalPagination
      ? (allViewData ?? [])
      : globalSearch.trim().length > 0
        ? fullData
        : data;
    const units = new Set(sourceForUnits.map(d => d.ENTREGA).filter(Boolean));
    return Array.from(units).sort();
  }, [data, fullData, allViewData, shouldUseLocalPagination, globalSearch]);

  // Quando troca de aba (normalmente muda o `title`), evita “filtros vazando” para outras telas
  useEffect(() => {
    setSelectedUnit('');
    setStatusFilters([]);
    setPaymentFilters([]);
    setNoteFilter('ALL');
    setFilterTxEntrega(false);
    setDraftDateFrom('');
    setDraftDateTo('');
    setAppliedDateFrom('');
    setAppliedDateTo('');
    setGlobalSearch('');
    setSortConfig({ key: 'DATA_LIMITE_DATE', direction: 'asc' });
    setPage(1);
  }, [title]);

  // Evita “sumir dados” quando filtros/dados mudam e a página atual fica fora do range
  useEffect(() => {
    // Para paginação no servidor, o `data` muda ao navegar entre páginas.
    // Não podemos resetar para 1 nesse momento senão a navegação nunca avança.
    if (!useServerPagination) setPage(1);
  }, [
    limit,
    globalSearch,
    selectedUnit,
    dateField,
    appliedDateFrom,
    appliedDateTo,
    noteFilter,
    filterTxEntrega,
    statusFilters.join('|'),
    paymentFilters.join('|'),
    data,
  ]);

  // Para paginação no servidor, resetamos a página apenas quando os filtros/search mudam,
  // nunca quando o `data` (resultado já paginado) é atualizado ao clicar em "Próxima".
  useEffect(() => {
    if (serverPagination) setPage(1);
  }, [
    limit,
    globalSearch,
    selectedUnit,
    dateField,
    appliedDateFrom,
    appliedDateTo,
    noteFilter,
    filterTxEntrega,
    statusFilters.join('|'),
    paymentFilters.join('|'),
  ]);

  const getCount = (filterType: 'status' | 'payment' | 'note' | 'txEntrega', key: string) => {
      if (serverPagination && serverCounts && !appliedDateFrom && !appliedDateTo) {
        if (filterType === 'status') return serverCounts.statusCounts?.[key] ?? 0;
        if (filterType === 'payment') return serverCounts.paymentCounts?.[key] ?? 0;
        if (filterType === 'note') return key === 'WITH' ? serverCounts.noteWith : serverCounts.noteWithout;
        if (filterType === 'txEntrega') return serverCounts.txEntrega;
      }
      // Logic mirrors filteredData but targets specific counts
      const isGlobalSearch = globalSearch.trim().length > 0;
      const baseAll = shouldUseLocalPagination ? (allViewData ?? []) : data;
      let base = isGlobalSearch ? (shouldUseLocalPagination ? (allViewData ?? []) : fullData) : baseAll;
      
      if (!isGlobalSearch && isPendencyView) base = base.filter(d => d.STATUS_CALCULADO !== 'CRÍTICO');
      
      const userRestrictedUnit = (ignoreUnitFilter || isGlobalSearch) ? null : user?.linkedDestUnit;
      const effectiveUnit = selectedUnit || userRestrictedUnit;
      if (effectiveUnit) base = base.filter(d => d.ENTREGA === effectiveUnit);

      if (filterType !== 'status' && statusFilters.length > 0) {
        if (serverView === 'concluidos') base = base.filter(d => statusFilters.includes(d.STATUS || ''));
        else base = base.filter(d => statusFilters.includes(d.STATUS_CALCULADO || ''));
      }
      if (filterType !== 'payment' && paymentFilters.length > 0) base = base.filter(d => paymentFilters.includes(d.FRETE_PAGO || ''));
      if (filterType !== 'note' && noteFilter !== 'ALL') {
          base = base.filter(d => {
              const count = getNoteCount(d.CTE, d);
              return noteFilter === 'WITH' ? count > 0 : count === 0;
          });
      }
      if (filterType !== 'txEntrega' && filterTxEntrega) base = base.filter(d => parseCurrency(d.TX_ENTREGA) > 0);
      const fromKey = dateInputToKey(appliedDateFrom);
      const toKey = dateInputToKey(appliedDateTo);
      if (fromKey || toKey) {
        base = base.filter((d) => {
          const k = getDateKeyByField(d);
          if (!k) return false;
          if (fromKey && k < fromKey) return false;
          if (toKey && k > toKey) return false;
          return true;
        });
      }

      if (filterType === 'status') {
        if (serverView === 'concluidos') return base.filter(d => (d.STATUS || '') === key).length;
        return base.filter(d => d.STATUS_CALCULADO === key).length;
      }
      if (filterType === 'payment') return base.filter(d => d.FRETE_PAGO === key).length;
      if (filterType === 'note') {
         return base.filter(d => {
             const count = getNoteCount(d.CTE, d);
             return key === 'WITH' ? count > 0 : count === 0;
         }).length;
      }
      if (filterType === 'txEntrega') return base.filter(d => parseCurrency(d.TX_ENTREGA) > 0).length;
      return 0;
  };

  // --- Pagination Logic ---
  // const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  // const paginatedData = useMemo(() => {
  //   const startIndex = (currentPage - 1) * itemsPerPage;
  //   const endIndex = startIndex + itemsPerPage;
  //   return sortedData.slice(startIndex, endIndex);
  // }, [sortedData, currentPage, itemsPerPage]);

  const showFilters = isPendencyView || enableFilters || isCriticalView;

  const SortHeader = ({ label, sortKey }: { label: string, sortKey: SortConfig['key'] }) => (
    <th
      className="group cursor-pointer select-none px-4 py-3 transition-colors hover:bg-slate-100"
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        <div className="text-gray-400 group-hover:text-primary-600">
           {sortConfig.key === sortKey ? (
               sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
           ) : ( <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50" /> )}
        </div>
      </div>
    </th>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Search & Update Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-gray-400" size={20} />
           </div>
           <input 
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Busca Global (CTE, Destinatário, Unidade)..."
              className={clsx(
                  "w-full pl-10 pr-4 py-3 rounded-lg border outline-none transition-all shadow-sm text-sm",
                  globalSearch
                    ? "border-[#e42424] bg-red-50 text-slate-900 ring-1 ring-[#e42424]/40"
                    : "border-slate-200 bg-white text-slate-800"
              )}
           />
           {globalSearch && (
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                   <span className="text-xs font-bold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">Global Mode</span>
               </div>
           )}
        </div>
      </div>

      {/* Controles de Paginação */}
      <div className="surface-card mt-4 flex items-center justify-between gap-2 border border-[#2c348c]/15 bg-gradient-to-b from-white to-[#f6f9ff] px-3 py-2 text-slate-800">
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-3 py-1 text-slate-700 disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >Anterior</button>
        <span className="text-sm font-bold">Página {page} de {totalPages}</span>
        <button
          type="button"
          className="rounded border border-slate-200 bg-white px-3 py-1 text-slate-700 disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >Próxima</button>
        <select
          className="ml-2 rounded border border-slate-200 bg-white px-2 py-1 text-sm text-slate-800"
          value={limit}
          onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={1000}>1000</option>
        </select>
        <span className="ml-2 text-xs text-slate-600">Total: {total}</span>
      </div>

      {/* Filter Section */}
      {showFilters && !globalSearch && (
        <div className="surface-card-strong p-5 text-slate-700 transition-opacity">
            
            {/* Header com Unidade */}
            <div className="mb-5 flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <Filter size={20} className="text-[#2c348c]" /> Filtros inteligentes
                </h2>
                <div className="w-full md:w-auto">
                    {user?.linkedDestUnit && !ignoreUnitFilter ? (
                        <div className="flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-600">
                            <Package size={14} /> <span className="text-xs font-bold">{user.linkedDestUnit}</span>
                        </div>
                    ) : (
                        <select
                            value={selectedUnit}
                            onChange={(e) => setSelectedUnit(e.target.value)}
                            className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-3 text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2c348c]/25 md:w-64"
                        >
                            <option value="">Todas as Unidades</option>
                            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
                <select
                    value={dateField}
                    onChange={(e) => setDateField(e.target.value as 'EMISSAO' | 'LIMITE' | 'BAIXA')}
                    className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2c348c]/25"
                >
                    <option value="EMISSAO">Filtrar por emissão</option>
                    <option value="LIMITE">Filtrar por limite</option>
                    <option value="BAIXA">Filtrar por baixa</option>
                </select>
                <input
                    type="date"
                    value={draftDateFrom}
                    onChange={(e) => setDraftDateFrom(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2c348c]/25"
                />
                <input
                    type="date"
                    value={draftDateTo}
                    onChange={(e) => setDraftDateTo(e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2c348c]/25"
                />
                <button
                    type="button"
                    onClick={() => { setAppliedDateFrom(draftDateFrom); setAppliedDateTo(draftDateTo); }}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#2c348c]/30 bg-gradient-to-r from-[#2c348c] to-[#06183e] px-3 py-2 text-xs font-black text-white transition-colors hover:opacity-95"
                >
                    <CalendarCheck2 size={14} />
                    Aplicar
                </button>
                <button
                    type="button"
                    onClick={() => { setDraftDateFrom(''); setDraftDateTo(''); setAppliedDateFrom(''); setAppliedDateTo(''); }}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
                >
                    Limpar datas
                </button>
            </div>

            <div className="flex flex-col gap-6">
                
                {/* BLOCO 1: STATUS (Apenas se não for visualização crítica) */}
                {STATUS_OPTIONS.length > 0 && (
                    <div className="space-y-2">
                        <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">Status do prazo</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            {STATUS_OPTIONS.map(status => (
                                <FilterCard 
                                    key={status}
                                    label={STATUS_LABELS[status] || status}
                                    count={getCount('status', status)}
                                    color={STATUS_COLORS_MAP[status]}
                                    selected={statusFilters.includes(status)}
                                    dimmed={statusFilters.length > 0}
                                    onClick={() => setStatusFilters(prev => toggleFilter(prev, status))}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* BLOCO 2: OUTROS FILTROS (Layout Grid/Flex Responsivo) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-6">
                    
                    {/* PAGAMENTOS (6 Cols on Desktop) */}
                    <div className="col-span-1 md:col-span-12 lg:col-span-6 space-y-2">
                        <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">Tipo de pagamento</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {PAYMENT_OPTIONS.map(pay => (
                                <FilterCard 
                                    key={pay}
                                    label={pay.replace('FATURAR_', 'FAT ').replace('_', ' ')}
                                    count={getCount('payment', pay)}
                                    color={PAYMENT_COLORS_MAP[pay]}
                                    selected={paymentFilters.includes(pay)}
                                    dimmed={paymentFilters.length > 0}
                                    onClick={() => setPaymentFilters(prev => toggleFilter(prev, pay))}
                                />
                            ))}
                        </div>
                    </div>

                    {/* NOTAS (3 Cols on Desktop) */}
                    <div className="col-span-1 md:col-span-6 lg:col-span-3 space-y-2">
                         <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">Anotações</label>
                         <div className="grid grid-cols-2 gap-3">
                            <FilterCard 
                                label="Com Notas" count={getCount('note', 'WITH')} color={COLORS.priority} 
                                selected={noteFilter === 'WITH'} dimmed={noteFilter !== 'ALL'}
                                onClick={() => setNoteFilter(prev => prev === 'WITH' ? 'ALL' : 'WITH')}
                            />
                            <FilterCard 
                                label="Sem Notas" count={getCount('note', 'WITHOUT')} color="#6b7280" 
                                selected={noteFilter === 'WITHOUT'} dimmed={noteFilter !== 'ALL'}
                                onClick={() => setNoteFilter(prev => prev === 'WITHOUT' ? 'ALL' : 'WITHOUT')}
                            />
                         </div>
                    </div>

                    {/* ATRIBUTOS (3 Cols on Desktop - HARMONIZED DESIGN) */}
                    <div className="col-span-1 md:col-span-6 lg:col-span-3 space-y-2">
                         <label className="ml-1 text-[10px] font-bold uppercase tracking-wider text-slate-700">Atributos</label>
                         <div className="grid grid-cols-1">
                            <FilterCard
                                label="COM ENTREGA"
                                count={getCount('txEntrega', '')}
                                color="#f97316"
                                selected={filterTxEntrega}
                                onClick={() => setFilterTxEntrega(!filterTxEntrega)}
                            />
                         </div>
                    </div>
                </div>
            </div>
             
             {/* FOOTER: CLEAR FILTERS */}
             {(statusFilters.length > 0 || paymentFilters.length > 0 || noteFilter !== 'ALL' || filterTxEntrega || appliedDateFrom || appliedDateTo) && (
                 <div className="mt-6 flex justify-end border-t border-slate-200 pt-3">
                    <button
                      type="button"
                      onClick={() => { setStatusFilters([]); setPaymentFilters([]); setNoteFilter('ALL'); setFilterTxEntrega(false); setDraftDateFrom(''); setDraftDateTo(''); setAppliedDateFrom(''); setAppliedDateTo(''); }}
                      className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 transition-colors hover:bg-red-100"
                    >
                        <X size={14} /> Limpar Todos os Filtros
                    </button>
                 </div>
             )}
        </div>
      )}

      {/* Main Table Title & Action */}
      <div className="mb-4 mt-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">
          {title} <span className="text-sm font-medium text-slate-600">({filteredData.length})</span>
        </h2>
        {hasPermission('EXPORT_DATA') && (
          <button
            type="button"
            onClick={() => {
              const exportData = sortedData.map(d => ({
                CTE: d.CTE,
                SERIE: d.SERIE,
                DATA_EMISSAO: d.DATA_EMISSAO,
                DATA_BAIXA: d.DATA_BAIXA || '',
                DATA_LIMITE: d.DATA_LIMITE_BAIXA,
                STATUS: d.STATUS_CALCULADO || d.STATUS,
                UNIDADE: d.ENTREGA,
                CLIENTE: d.DESTINATARIO,
                VALOR: d.VALOR_CTE,
              }));
              const ws = XLSX.utils.json_to_sheet(exportData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Dados');
              XLSX.writeFile(wb, `SLE_${title.replace(/\s/g, '_')}.xlsx`);
            }}
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition-all duration-300 hover:border-[#e42424]/40 hover:bg-red-50 hover:text-[#06183e]"
          >
            <span className="pointer-events-none absolute inset-0 translate-y-full bg-[#e42424]/10 transition-transform duration-500 ease-out group-hover:translate-y-0" />
            <span className="relative flex items-center gap-2">
              <FileSpreadsheet size={18} />
              Exportar Excel
            </span>
          </button>
        )}
      </div>

      <div className="table-shell hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-300/70 bg-gradient-to-b from-slate-100 to-slate-50 text-xs font-bold uppercase text-slate-600">
            <tr>
              <SortHeader label="Status" sortKey="STATUS_CALCULADO" />
              <SortHeader label="CTE / Série" sortKey="CTE" />
              <SortHeader label="Data Emissão" sortKey="DATA_EMISSAO" />
              <SortHeader label="Data Limite" sortKey="DATA_LIMITE_DATE" />
              <SortHeader label="Data Baixa" sortKey="DATA_BAIXA_DATE" />
              <SortHeader label="Unid. Destino / Cliente" sortKey="DESTINATARIO" />
              <SortHeader label="Valor" sortKey="VALOR_NUMBER" />
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70">
            {paginatedData.map((row, idx) => {
              const noteCount = getNoteCount(row.CTE, row);
              const isEmBusca = isCteEmBusca(row.CTE, row.SERIE, row.STATUS);
              const userHasInteracted = notes.some(n => n.CTE === row.CTE && n.USUARIO.toLowerCase() === user?.username.toLowerCase());
              const needsAttention = isEmBusca && !userHasInteracted && !!user?.linkedDestUnit && !row.IS_HISTORICAL;

              return (
                <tr
                  key={`${row.CTE}-${idx}`}
                  className={clsx(
                    "transition-all duration-150",
                    row.IS_HISTORICAL
                      ? "bg-slate-50 opacity-70 grayscale"
                      : needsAttention
                        ? "animate-[pulse_3s_ease-in-out_infinite] border-l-4 border-red-500 bg-red-50 hover:bg-red-100"
                        : idx % 2 === 0
                          ? "bg-white hover:bg-[#e9f1ff] hover:shadow-[inset_3px_0_0_#2c348c]"
                          : "bg-slate-50/45 hover:bg-[#e5eefc] hover:shadow-[inset_3px_0_0_#2c348c]"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      {row.IS_HISTORICAL ? (
                          <span className="px-2 py-1 rounded-full text-xs font-semibold border bg-gray-200 text-gray-600 border-gray-300 flex items-center gap-1">
                              <Archive size={10} /> HISTÓRICO
                          </span>
                      ) : (
                          <>
                            {needsAttention && <span className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-100 px-1.5 py-0.5 rounded animate-bounce"><AlertTriangle size={10} /> ATENÇÃO</span>}
                            <StatusBadge status={row.STATUS_CALCULADO || row.STATUS} />
                            <StatusBadge status={row.FRETE_PAGO} />
                          </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{row.CTE}</div>
                    <div className="text-xs text-slate-600">Série: {row.SERIE}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-700">
                      {formatDateOnly(row.DATA_EMISSAO)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        'font-bold',
                        row.STATUS_CALCULADO === 'FORA DO PRAZO' && !row.IS_HISTORICAL
                          ? 'text-red-600'
                          : 'text-slate-800',
                      )}
                    >
                      {formatDateOnly(row.DATA_LIMITE_BAIXA)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {formatDateOnly(row.DATA_BAIXA)}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3">
                    <div className="mb-0.5 truncate text-xs font-bold uppercase text-[#2c348c]">
                      {row.ENTREGA}
                    </div>
                    <div className="truncate font-medium text-slate-900">{row.DESTINATARIO}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-700">{row.VALOR_CTE}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onNoteClick(row)}
                      className={clsx(
                        'group relative rounded-full p-2 transition-all',
                        needsAttention
                          ? 'bg-red-600 text-white shadow-lg'
                          : noteCount > 0
                            ? 'bg-orange-50 text-orange-600'
                            : 'text-slate-400 hover:bg-[#e8f0ff] hover:text-[#2c348c] hover:shadow-sm',
                      )}
                    >
                      <MessageSquare size={18} fill={noteCount > 0 ? "currentColor" : "none"} />
                      {noteCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold border border-white">{noteCount}</span>}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredData.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            Nenhum resultado para os filtros aplicados.
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {paginatedData.map((row, idx) => {
           const noteCount = getNoteCount(row.CTE, row);
           const needsAttention = isCteEmBusca(row.CTE, row.SERIE, row.STATUS) && !notes.some(n => n.CTE === row.CTE && n.USUARIO.toLowerCase() === user?.username.toLowerCase()) && !!user?.linkedDestUnit && !row.IS_HISTORICAL;
           return (
            <div
              key={`${row.CTE}-${idx}`}
              className={clsx(
                'rounded-xl border border-slate-300/75 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_22px_rgba(15,23,42,0.12)]',
                row.IS_HISTORICAL
                  ? 'border-l-4 border-slate-300 opacity-80'
                  : needsAttention
                    ? 'border-l-4 border-red-500 bg-red-50'
                    : 'border-l-4 border-[#2c348c]',
              )}
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 text-lg font-bold text-slate-900">
                        CTE {row.CTE} 
                        {row.IS_HISTORICAL && <Archive size={14} className="text-slate-400"/>}
                    </div>
                    <div className="text-xs text-slate-500">Série {row.SERIE}</div>
                </div>
                    <div className="flex flex-col items-end gap-1">
                      {row.IS_HISTORICAL ? (
                        <span className="text-xs font-bold text-slate-400">HISTÓRICO</span>
                      ) : (
                        <>
                          <StatusBadge status={row.STATUS_CALCULADO || row.STATUS} />
                          <StatusBadge status={row.FRETE_PAGO} />
                        </>
                      )}
                    </div>
              </div>
              <div className="mb-3 grid grid-cols-2 gap-2 border-t border-slate-200 pt-2 text-sm text-slate-800">
                <div>
                  <span className="block text-xs text-slate-500">Emissão</span>
                  <span className="font-bold">{formatDateOnly(row.DATA_EMISSAO)}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Limite</span>
                  <span className="font-bold">{formatDateOnly(row.DATA_LIMITE_BAIXA)}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Data baixa</span>
                  <span className="font-bold">{formatDateOnly(row.DATA_BAIXA)}</span>
                </div>
                <div>
                  <span className="block text-xs text-slate-500">Valor</span>
                  <span className="font-mono font-bold text-emerald-700">{row.VALOR_CTE}</span>
                </div>
              </div>
              <div className="flex justify-end border-t border-slate-200 pt-2">
                  <button
                    type="button"
                    onClick={() => onNoteClick(row)}
                    className={clsx(
                      'flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      needsAttention
                        ? 'bg-red-600 text-white shadow-lg'
                        : noteCount > 0
                          ? 'text-orange-600'
                          : 'text-slate-600',
                    )}
                  >
                    <MessageSquare size={16} className="mr-1" fill={noteCount > 0 ? "currentColor" : "none"} />
                    {needsAttention ? "Resolver / Ciente" : noteCount > 0 ? `Notas (${noteCount})` : 'Anotar'}
                  </button>
              </div>
            </div>
           );
        })}
      </div>
    </div>
  );
};
           
export default DataTable;