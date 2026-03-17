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
  key: keyof CteData | 'STATUS_CALCULADO' | 'VALOR_NUMBER' | 'DATA_LIMITE_DATE';
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

// Modern Filter Card (Inspired by Dashboard Design)
const FilterCard: React.FC<FilterCardProps> = ({ label, count, color, selected, dimmed, onClick }) => (
  <div 
      onClick={onClick}
      className={clsx(
          "rounded-xl border transition-all cursor-pointer flex flex-col justify-between p-3 relative overflow-hidden group select-none h-[72px]",
          selected 
              ? "bg-white ring-2 ring-offset-1 z-10 scale-[1.02] shadow-md" 
              : "bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50",
          dimmed && !selected ? "opacity-50 grayscale-[0.5]" : "opacity-100"
      )}
      style={{ 
          borderColor: selected ? color : undefined, 
          backgroundColor: selected ? `${color}10` : undefined,
          boxShadow: selected ? `0 4px 12px -2px ${color}20` : undefined
      }}
  >
      <div className="flex justify-between items-start w-full mb-1">
          <span className="font-bold uppercase tracking-wider text-[10px] truncate mr-2" style={{ color: selected ? color : '#6b7280' }}>
              {label}
          </span>
          {selected && <CheckCircle size={14} fill={color} className="text-white shrink-0" />}
      </div>
      <div className="flex items-baseline gap-1">
          <span className="font-black text-gray-800 text-2xl leading-none tracking-tight">{count}</span>
      </div>
      <div className="absolute bottom-0 left-0 h-1 w-full transition-all" style={{ backgroundColor: color, opacity: selected ? 1 : 0.3 }} />
  </div>
);

const DataTable: React.FC<Props> = ({ data, onNoteClick, title, isPendencyView = false, isCriticalView = false, enableFilters = false, ignoreUnitFilter = false, serverPagination }) => {
  // --- Filter State ---
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [paymentFilters, setPaymentFilters] = useState<string[]>([]);
  const [noteFilter, setNoteFilter] = useState<'ALL' | 'WITH' | 'WITHOUT'>('ALL');
  const [filterTxEntrega, setFilterTxEntrega] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  // --- Sort State ---
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'DATA_LIMITE_DATE', direction: 'asc' });

  const { user } = useAuth();
  const { notes, fullData, processControlData, isCteEmBusca } = useData();

  // --- Paginação (local ou server-side) ---
  const [pageLocal, setPageLocal] = useState(1);
  const [limitLocal, setLimitLocal] = useState(50);
  const page = serverPagination?.page ?? pageLocal;
  const limit = serverPagination?.limit ?? limitLocal;
  const totalFromServer = serverPagination?.total;
  const setPage = (p: number) => (serverPagination ? serverPagination.onPageChange(p) : setPageLocal(p));
  const setLimit = (l: number) => (serverPagination ? serverPagination.onLimitChange(l) : setLimitLocal(l));

  const serverView = useMemo(() => {
    const t = (title || '').toLowerCase();
    if (t.includes('crític') || t.includes('critic')) return 'criticos' as const;
    if (t.includes('em busca')) return 'em_busca' as const;
    if (t.includes('tad')) return 'tad' as const;
    if (t.includes('conclu')) return 'concluidos' as const;
    return 'pendencias' as const;
  }, [title]);

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
  }, [serverPagination, serverView, selectedUnit, statusFilters.join('|'), paymentFilters.join('|'), noteFilter, filterTxEntrega, ignoreUnitFilter, user?.linkedDestUnit, globalSearch]);

  // Main Data Filtering Logic
  // (Estados já declarados no início do componente)
  // --- Sort State ---
  // (Estado já declarado no início do componente)

  // Main Data Filtering Logic
  const filteredData = useMemo(() => {
    const isGlobalSearch = globalSearch.trim().length > 0;
    let result: CteData[] = [];
    if (isGlobalSearch) {
      const term = globalSearch.toLowerCase();
      const baseForSearch = fullData.length > 0 ? fullData : data;
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
      result = data;
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
    return result;
  }, [data, fullData, processControlData, notes, globalSearch, isPendencyView, user, selectedUnit, statusFilters, paymentFilters, noteFilter, filterTxEntrega, ignoreUnitFilter]);
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

  const total = typeof totalFromServer === 'number' ? totalFromServer : sortedData.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginatedData = useMemo(() => {
    if (serverPagination) return sortedData;
    const start = (page - 1) * limit;
    const end = start + limit;
    return sortedData.slice(start, end);
  }, [sortedData, page, limit, serverPagination]);

  // --- Constants ---
  const STATUS_OPTIONS = useMemo(() => {
    if (isCriticalView) return [];
    if (isPendencyView) return ['FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHÃ', 'NO PRAZO'];
    return ['CRÍTICO', 'FORA DO PRAZO', 'PRIORIDADE', 'VENCE AMANHÃ', 'NO PRAZO'];
  }, [isPendencyView, isCriticalView]);

  const PAYMENT_OPTIONS = ['CIF', 'FOB', 'FATURAR_REMETENTE', 'FATURAR_DEST'];
  
  const STATUS_COLORS_MAP: Record<string, string> = {
    'CRÍTICO': COLORS.critical,
    'FORA DO PRAZO': COLORS.late,
    'PRIORIDADE': COLORS.priority,
    'VENCE AMANHÃ': COLORS.tomorrow,
    'NO PRAZO': COLORS.ontime,
  };

  const PAYMENT_COLORS_MAP: Record<string, string> = {
    'CIF': '#10b981',
    'FOB': '#ef4444',
    'FATURAR_REMETENTE': '#eab308',
    'FATURAR_DEST': '#f97316'
  };

  const latestEmissaoDate = useMemo(() => {
    if (data.length === 0) return '--/--/----';
    let maxVal = 0;
    let maxStr = '';
    data.forEach((d: CteData) => {
       if (!d.DATA_EMISSAO) return;
       const parts = d.DATA_EMISSAO.split('/');
       if (parts.length === 3) {
           const val = parseInt(parts[2] + parts[1].padStart(2, '0') + parts[0].padStart(2, '0'));
           if (val > maxVal) { maxVal = val; maxStr = d.DATA_EMISSAO; }
       }
    });
    return maxStr || '--/--/----';
  }, [data]);

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

  function parseDate(dateStr: string) {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return 0;
    return parseInt(`${parts[2]}${parts[1]}${parts[0]}`);
  }

  const handleSort = (sortKey: SortConfig['key']) => {
    setSortConfig(current => ({
      key: sortKey,
      direction: current.key === sortKey && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const availableUnits = useMemo(() => {
    // During global search, allow searching any unit found in fullData
    const sourceForUnits = globalSearch.trim().length > 0 ? fullData : data;
    const units = new Set(sourceForUnits.map(d => d.ENTREGA).filter(Boolean));
    return Array.from(units).sort();
  }, [data, fullData, globalSearch]);

  // Quando troca de aba (normalmente muda o `title`), evita “filtros vazando” para outras telas
  useEffect(() => {
    setSelectedUnit('');
    setStatusFilters([]);
    setPaymentFilters([]);
    setNoteFilter('ALL');
    setFilterTxEntrega(false);
    setGlobalSearch('');
    setSortConfig({ key: 'DATA_LIMITE_DATE', direction: 'asc' });
    setPage(1);
  }, [title]);

  // Evita “sumir dados” quando filtros/dados mudam e a página atual fica fora do range
  useEffect(() => {
    setPage(1);
  }, [
    limit,
    globalSearch,
    selectedUnit,
    noteFilter,
    filterTxEntrega,
    statusFilters.join('|'),
    paymentFilters.join('|'),
    data,
  ]);

  const getCount = (filterType: 'status' | 'payment' | 'note' | 'txEntrega', key: string) => {
      if (serverPagination && serverCounts) {
        if (filterType === 'status') return serverCounts.statusCounts?.[key] ?? 0;
        if (filterType === 'payment') return serverCounts.paymentCounts?.[key] ?? 0;
        if (filterType === 'note') return key === 'WITH' ? serverCounts.noteWith : serverCounts.noteWithout;
        if (filterType === 'txEntrega') return serverCounts.txEntrega;
      }
      // Logic mirrors filteredData but targets specific counts
      const isGlobalSearch = globalSearch.trim().length > 0;
      let base = isGlobalSearch ? fullData : data; // Use fullData for global search counts too
      
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

      if (filterType === 'status') return base.filter(d => d.STATUS_CALCULADO === key).length;
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
    <th className="px-4 py-3 cursor-pointer group hover:bg-gray-100 transition-colors select-none" onClick={() => handleSort(sortKey)}>
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
                  "w-full pl-10 pr-4 py-3 rounded-lg border focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm text-gray-900",
                  globalSearch ? "bg-primary-50 border-primary-300 ring-2 ring-primary-100" : "bg-white border-gray-200"
              )}
           />
           {globalSearch && (
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                   <span className="text-xs font-bold text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">Global Mode</span>
               </div>
           )}
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 text-emerald-700 text-xs font-bold shadow-sm h-fit self-center whitespace-nowrap">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <CalendarCheck2 size={16} />
            <span>Atualizado: {latestEmissaoDate}</span>
        </div>
      </div>

      {/* Controles de Paginação */}
      <div className="flex items-center justify-between mt-4 gap-2">
        <button
          className="px-3 py-1 rounded bg-gray-100 border border-gray-300 text-gray-700 disabled:opacity-50"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >Anterior</button>
        <span className="text-sm font-bold">Página {page} de {totalPages}</span>
        <button
          className="px-3 py-1 rounded bg-gray-100 border border-gray-300 text-gray-700 disabled:opacity-50"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >Próxima</button>
        <select
          className="ml-2 px-2 py-1 rounded border border-gray-300 text-sm"
          value={limit}
          onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
        >
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={1000}>1000</option>
        </select>
        <span className="text-xs text-gray-500 ml-2">Total: {total}</span>
      </div>

      {/* Filter Section */}
      {showFilters && !globalSearch && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 transition-opacity">
            
            {/* Header com Unidade */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-4 mb-5">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Filter size={20} className="text-primary-600" /> Filtros Inteligentes
                </h2>
                <div className="w-full md:w-auto">
                    {user?.linkedDestUnit && !ignoreUnitFilter ? (
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 cursor-not-allowed">
                            <Package size={14} /> <span className="font-bold text-xs">{user.linkedDestUnit}</span>
                        </div>
                    ) : (
                        <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)} className="w-full md:w-64 appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-2.5 px-3 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer shadow-sm">
                            <option value="">Todas as Unidades</option>
                            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-6">
                
                {/* BLOCO 1: STATUS (Apenas se não for visualização crítica) */}
                {STATUS_OPTIONS.length > 0 && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Status do Prazo</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                            {STATUS_OPTIONS.map(status => (
                                <FilterCard 
                                    key={status}
                                    label={status}
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
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Tipo de Pagamento</label>
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
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Anotações</label>
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
                         <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Atributos</label>
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
             {(statusFilters.length > 0 || paymentFilters.length > 0 || noteFilter !== 'ALL' || filterTxEntrega) && (
                 <div className="flex justify-end mt-6 pt-3 border-t border-gray-100">
                    <button onClick={() => { setStatusFilters([]); setPaymentFilters([]); setNoteFilter('ALL'); setFilterTxEntrega(false); }} className="px-4 py-2 text-xs text-red-600 font-bold bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-2 border border-red-100">
                        <X size={14} /> Limpar Todos os Filtros
                    </button>
                 </div>
             )}
        </div>
      )}

      {/* Main Table Title & Action */}
      <div className="flex justify-between items-center mb-4 mt-6">
        <h2 className="text-xl font-bold text-primary-900">{title} <span className="text-gray-400 text-sm font-normal">({filteredData.length})</span></h2>
        <button onClick={() => {
            const exportData = sortedData.map(d => ({
                CTE: d.CTE, SERIE: d.SERIE, DATA_EMISSAO: d.DATA_EMISSAO, DATA_LIMITE: d.DATA_LIMITE_BAIXA,
                STATUS: d.STATUS_CALCULADO || d.STATUS, UNIDADE: d.ENTREGA, CLIENTE: d.DESTINATARIO, VALOR: d.VALOR_CTE
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Dados");
            XLSX.writeFile(wb, `SLE_${title.replace(/\s/g, '_')}.xlsx`);
        }} className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 text-sm font-medium shadow-sm flex items-center gap-2 transition-colors">
          <FileSpreadsheet size={18} /> Exportar Excel
        </button>
      </div>

      <div className="hidden md:block overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-primary-50 text-primary-900 uppercase font-bold text-xs">
            <tr>
              <SortHeader label="Status" sortKey="STATUS_CALCULADO" />
              <SortHeader label="CTE / Série" sortKey="CTE" />
              <SortHeader label="Data Limite" sortKey="DATA_LIMITE_DATE" />
              <SortHeader label="Unid. Destino / Cliente" sortKey="DESTINATARIO" />
              <SortHeader label="Valor" sortKey="VALOR_NUMBER" />
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((row, idx) => {
              const noteCount = getNoteCount(row.CTE, row);
              const isEmBusca = isCteEmBusca(row.CTE, row.SERIE, row.STATUS);
              const userHasInteracted = notes.some(n => n.CTE === row.CTE && n.USUARIO.toLowerCase() === user?.username.toLowerCase());
              const needsAttention = isEmBusca && !userHasInteracted && !!user?.linkedDestUnit && !row.IS_HISTORICAL;

              return (
                <tr key={`${row.CTE}-${idx}`} className={clsx("transition-colors", row.IS_HISTORICAL ? "bg-gray-50 opacity-75 grayscale" : (needsAttention ? "bg-red-50 hover:bg-red-100 border-l-4 border-red-500 animate-[pulse_3s_ease-in-out_infinite]" : "hover:bg-gray-50"))}>
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
                    <div className="font-medium text-gray-900">{row.CTE}</div>
                    <div className="text-xs text-gray-500">Série: {row.SERIE}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx("font-bold", row.STATUS_CALCULADO === 'FORA DO PRAZO' && !row.IS_HISTORICAL ? 'text-red-600' : 'text-gray-700')}>{row.DATA_LIMITE_BAIXA || '-'}</span>
                  </td>
                  <td className="px-4 py-3 truncate max-w-xs">
                    <div className="truncate text-xs text-primary-600 font-bold uppercase mb-0.5">{row.ENTREGA}</div>
                    <div className="truncate font-medium text-gray-800">{row.DESTINATARIO}</div>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-gray-700">{row.VALOR_CTE}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => onNoteClick(row)} className={clsx("p-2 rounded-full relative transition-all group", needsAttention ? "bg-red-600 text-white shadow-lg" : noteCount > 0 ? "text-orange-500 bg-orange-50" : "text-gray-400 hover:text-primary-600 hover:bg-gray-100")}>
                      <MessageSquare size={18} fill={noteCount > 0 ? "currentColor" : "none"} />
                      {noteCount > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold border border-white">{noteCount}</span>}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredData.length === 0 && <div className="p-8 text-center text-gray-400 text-sm">Nenhum resultado para os filtros aplicados.</div>}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {paginatedData.map((row, idx) => {
           const noteCount = getNoteCount(row.CTE, row);
           const needsAttention = isCteEmBusca(row.CTE, row.SERIE, row.STATUS) && !notes.some(n => n.CTE === row.CTE && n.USUARIO.toLowerCase() === user?.username.toLowerCase()) && !!user?.linkedDestUnit && !row.IS_HISTORICAL;
           return (
            <div key={`${row.CTE}-${idx}`} className={clsx("bg-white p-4 rounded-lg shadow border-l-4 transition-all", row.IS_HISTORICAL ? "border-gray-300 opacity-80" : (needsAttention ? "border-red-500 bg-red-50" : "border-primary-500"))}>
              <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        CTE {row.CTE} 
                        {row.IS_HISTORICAL && <Archive size={14} className="text-gray-400"/>}
                    </div>
                    <div className="text-xs text-gray-500">Série {row.SERIE}</div>
                </div>
                <div className="flex flex-col gap-1 items-end">
                    {row.IS_HISTORICAL ? <span className="text-xs font-bold text-gray-500">HISTÓRICO</span> : <><StatusBadge status={row.STATUS_CALCULADO || row.STATUS} /><StatusBadge status={row.FRETE_PAGO} /></>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mb-3 pt-2 border-t border-gray-50">
                <div><span className="block text-xs text-gray-400">Limite</span><span className="font-bold">{row.DATA_LIMITE_BAIXA || '-'}</span></div>
                <div><span className="block text-xs text-gray-400">Valor</span><span className="font-mono font-bold">{row.VALOR_CTE}</span></div>
              </div>
              <div className="flex justify-end pt-2 border-t border-gray-50">
                  <button
                    onClick={() => onNoteClick(row)}
                    className={clsx(
                      "flex items-center font-medium text-sm transition-colors px-3 py-1.5 rounded-lg",
                      needsAttention ? "bg-red-600 text-white shadow-lg" : noteCount > 0 ? "text-orange-500" : "text-gray-500"
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