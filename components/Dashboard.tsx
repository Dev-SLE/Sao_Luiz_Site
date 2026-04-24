import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, LineChart, Line, AreaChart, Area,
} from 'recharts';
import {
  Filter,
  DollarSign,
  Package,
  CheckCircle,
  UserCheck,
  UserX,
  Building2,
  Trophy,
  PieChart as PieChartIcon,
  BarChart3,
  TrendingUp,
  X,
  ArrowLeftCircle,
  CalendarCheck2,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import { COLORS } from '../constants';
import { StatusBadge } from '@/components/workspace-ui';

/** Agrupa cada linha do dashboard numa chave de cartão (alinha fila + SLA, sem “sumir” em OUTROS). */
function resolveDashboardStatusKey(item: { STATUS?: string; STATUS_CALCULADO?: string }): string {
  const display = String(item.STATUS || '').trim();
  const calc = String(item.STATUS_CALCULADO || '').trim();
  const du = display
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (du.includes('EM BUSCA')) return 'EM BUSCA';
  if (du.includes('OCORR')) return 'OCORRÊNCIA';
  const pick = calc || display;
  const u = pick
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (u.includes('CRITICO')) return 'CRÍTICO';
  if (u.includes('FORA DO PRAZO')) return 'FORA DO PRAZO';
  if (u.includes('PRIORIDADE')) return 'PRIORIDADE';
  if (u.includes('VENCE AMANHA')) return 'VENCE AMANHÃ';
  if (u.includes('NO PRAZO')) return 'NO PRAZO';
  if (pick) return pick;
  return 'OUTROS';
}

const DASHBOARD_STATUS_CARD_ORDER: { key: string; label: string }[] = [
  { key: 'FORA DO PRAZO', label: 'Fora do prazo' },
  { key: 'CRÍTICO', label: 'Crítico' },
  { key: 'PRIORIDADE', label: 'Vence hoje' },
  { key: 'VENCE AMANHÃ', label: 'Vence amanhã' },
  { key: 'NO PRAZO', label: 'No prazo' },
  { key: 'EM BUSCA', label: 'Em busca' },
  { key: 'OCORRÊNCIA', label: 'Ocorrência' },
];

/** Paleta alinhada ao site institucional + tons serenos */
const NAVY = '#0a1628';
const NAVY_MID = '#1a2d50';
const BRAND_RED = '#c41230';

const Dashboard: React.FC = () => {
  const { processedData, counts, operacionalDashboardDistinctTotal } = useData();
  const { user } = useAuth();

  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [paymentFilters, setPaymentFilters] = useState<string[]>([]);
  const [draftDateFrom, setDraftDateFrom] = useState('');
  const [draftDateTo, setDraftDateTo] = useState('');
  const [appliedDateFrom, setAppliedDateFrom] = useState('');
  const [appliedDateTo, setAppliedDateTo] = useState('');
  const [viewMode, setViewMode] = useState<'qty' | 'value'>('qty');
  const [pieMode, setPieMode] = useState<'status' | 'payment'>('status');
  const [activePieKey, setActivePieKey] = useState<string | null>(null);

  const STATUS_COLORS: Record<string, string> = {
    'CRÍTICO': COLORS.critical,
    'FORA DO PRAZO': COLORS.late,
    'PRIORIDADE': COLORS.priority,
    'VENCE AMANHÃ': COLORS.tomorrow,
    'NO PRAZO': COLORS.ontime,
    'EM BUSCA': '#7c3aed',
    'OCORRÊNCIA': '#ca8a04',
    OUTROS: '#94a3b8',
  };

  const PAYMENT_COLORS: Record<string, string> = {
    CIF: '#0d9488',
    FOB: '#e11d48',
    FATURAR_REMETENTE: '#ca8a04',
    FATURAR_DEST: '#ea580c',
  };

  const cleanLabel = (name: string) => {
    if (!name) return '';
    let cleaned = name.replace(/^(DEC|FILIAL)\s*-?\s*/i, '');
    if (cleaned.length > 22) {
      return cleaned.substring(0, 22) + '...';
    }
    return cleaned;
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val: number) => new Intl.NumberFormat('pt-BR').format(val);

  const toggleFilter = (list: string[], item: string) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  const safeParseValue = (valStr: string | undefined | null) => {
    if (!valStr) return 0;
    try {
      let s = String(valStr).trim();
      if (!s) return 0;
      s = s.replace(/[R$\s]/g, '').replace(/[^\d,.-]/g, '');
      const hasComma = s.includes(',');
      const hasDot = s.includes('.');
      if (hasComma && hasDot) {
        // Ex.: 1.234,56 (pt-BR) -> 1234.56 | 1234.56 (en-US) permanece
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          s = s.replace(/,/g, '');
        }
      } else if (hasComma) {
        // Só vírgula: decimal ou milhar
        if (/,\d{1,2}$/.test(s)) s = s.replace(',', '.');
        else s = s.replace(/,/g, '');
      } else if (hasDot) {
        // Só ponto: decimal ou milhar
        if (!/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  };

  const parseDateToComparable = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const raw = dateStr.trim();
    if (!raw) return 0;

    const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (ddmmyyyy) {
      const [, dd, mm, yyyy] = ddmmyyyy;
      return Number(`${yyyy}${mm.padStart(2, '0')}${dd.padStart(2, '0')}`);
    }

    const yyyymmdd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (yyyymmdd) {
      const [, yyyy, mm, dd] = yyyymmdd;
      return Number(`${yyyy}${mm.padStart(2, '0')}${dd.padStart(2, '0')}`);
    }

    return 0;
  };

  const parseInputDateToComparable = (v: string) => {
    if (!v) return 0;
    const p = v.split('-');
    if (p.length !== 3) return 0;
    return parseInt(`${p[0]}${p[1]}${p[2]}`);
  };

  const isUserUnitBound = !!user?.linkedDestUnit;
  const activeUnit = isUserUnitBound ? user.linkedDestUnit : selectedUnit;


  const availableUnits = useMemo(() => {
    const units = new Set(processedData.map((d) => d.ENTREGA).filter(Boolean));
    return Array.from(units).sort();
  }, [processedData]);

  const baseScopeData = useMemo(() => {
    const from = parseInputDateToComparable(appliedDateFrom);
    const to = parseInputDateToComparable(appliedDateTo);
    return processedData.filter((item) => {
      if (activeUnit && item.ENTREGA !== activeUnit) return false;
      if (from || to) {
        const dt = parseDateToComparable(item.DATA_EMISSAO || '');
        if (!dt) return false;
        if (from && dt < from) return false;
        if (to && dt > to) return false;
      }
      return true;
    });
  }, [processedData, activeUnit, appliedDateFrom, appliedDateTo]);

  const latestEmissaoDate = useMemo(() => {
    if (baseScopeData.length === 0) return '--/--/----';
    let maxVal = 0;
    let maxStr = '';
    baseScopeData.forEach((d) => {
      const currentVal = parseDateToComparable(d.DATA_EMISSAO);
      if (currentVal > maxVal) {
        maxVal = currentVal;
        maxStr = d.DATA_EMISSAO;
      }
    });
    return maxStr || '--/--/----';
  }, [baseScopeData]);

  const statusCardsData = useMemo(() => {
    return baseScopeData.filter((item) => {
      if (paymentFilters.length > 0 && !paymentFilters.includes(item.FRETE_PAGO || 'OUTROS')) return false;
      return true;
    });
  }, [baseScopeData, paymentFilters]);

  const paymentCardsData = useMemo(() => {
    return baseScopeData.filter((item) => {
      if (statusFilters.length > 0) {
        const statusKey = resolveDashboardStatusKey(item);
        if (!statusFilters.includes(statusKey)) return false;
      }
      return true;
    });
  }, [baseScopeData, statusFilters]);

  const fullyFilteredData = useMemo(() => {
    return baseScopeData.filter((item) => {
      if (paymentFilters.length > 0 && !paymentFilters.includes(item.FRETE_PAGO || 'OUTROS')) return false;
      if (statusFilters.length > 0) {
        const statusKey = resolveDashboardStatusKey(item);
        if (!statusFilters.includes(statusKey)) return false;
      }
      return true;
    });
  }, [baseScopeData, paymentFilters, statusFilters]);

  const mainKPIs = useMemo(() => {
    let qty = 0;
    let val = 0;
    fullyFilteredData.forEach((d) => {
      qty++;
      val += safeParseValue(d.VALOR_CTE);
    });
    return { qty, val };
  }, [fullyFilteredData]);

  const operationalKPIs = useMemo(() => {
    const total = fullyFilteredData.length;
    if (!total) {
      return {
        onTimeRate: 0,
        criticalRate: 0,
        avgTicket: 0,
      };
    }
    const onTime = fullyFilteredData.filter((d) => resolveDashboardStatusKey(d) === 'NO PRAZO').length;
    const critical = fullyFilteredData.filter((d) => resolveDashboardStatusKey(d) === 'CRÍTICO').length;
    return {
      onTimeRate: (onTime / total) * 100,
      criticalRate: (critical / total) * 100,
      avgTicket: mainKPIs.val / total,
    };
  }, [fullyFilteredData, mainKPIs.val]);

  const assignmentKPIs = useMemo(() => {
    const assignee = new Map<string, number>();
    const agency = new Map<string, number>();
    let withAssignment = 0;
    let withoutAssignment = 0;
    for (const d of fullyFilteredData) {
      const userAssigned = String(d.ASSIGNED_USERNAME || '').trim();
      const agencyAssigned = String(d.ASSIGNMENT_AGENCY_UNIT || '').trim();
      if (userAssigned) {
        withAssignment += 1;
        assignee.set(userAssigned, (assignee.get(userAssigned) || 0) + 1);
      } else {
        withoutAssignment += 1;
      }
      if (agencyAssigned) {
        agency.set(agencyAssigned, (agency.get(agencyAssigned) || 0) + 1);
      }
    }
    const topAssignee = Array.from(assignee.entries()).sort((a, b) => b[1] - a[1])[0] || null;
    const topAgency = Array.from(agency.entries()).sort((a, b) => b[1] - a[1])[0] || null;
    return { withAssignment, withoutAssignment, topAssignee, topAgency };
  }, [fullyFilteredData]);

  const assignmentTopRows = useMemo(() => {
    const assignee = new Map<string, { qty: number; val: number }>();
    for (const d of fullyFilteredData) {
      const userAssigned = String(d.ASSIGNED_USERNAME || '').trim();
      if (!userAssigned) continue;
      const current = assignee.get(userAssigned) || { qty: 0, val: 0 };
      current.qty += 1;
      current.val += safeParseValue(d.VALOR_CTE || '0');
      assignee.set(userAssigned, current);
    }
    return Array.from(assignee.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [fullyFilteredData]);

  const trendData = useMemo(() => {
    const map: Record<string, { key: number; label: string; qty: number; val: number }> = {};
    fullyFilteredData.forEach((item) => {
      const raw = item.DATA_EMISSAO || '';
      const key = parseDateToComparable(raw);
      if (!key) return;
      if (!map[raw]) {
        map[raw] = {
          key,
          label: raw.includes('/') ? raw.slice(0, 5) : raw,
          qty: 0,
          val: 0,
        };
      }
      map[raw].qty += 1;
      map[raw].val += safeParseValue(item.VALOR_CTE);
    });
    return Object.values(map)
      .sort((a, b) => a.key - b.key)
      .slice(-14);
  }, [fullyFilteredData]);

  const statusAgg = useMemo(() => {
    const counts: Record<string, { qty: number; val: number }> = {};
    statusCardsData.forEach((item) => {
      const status = resolveDashboardStatusKey(item);
      const v = safeParseValue(item.VALOR_CTE);
      if (!counts[status]) counts[status] = { qty: 0, val: 0 };
      counts[status].qty++;
      counts[status].val += v;
    });
    return counts;
  }, [statusCardsData]);

  const paymentAgg = useMemo(() => {
    const counts: Record<string, { qty: number; val: number }> = {};
    paymentCardsData.forEach((item) => {
      const type = item.FRETE_PAGO || 'OUTROS';
      const v = safeParseValue(item.VALOR_CTE);
      if (!counts[type]) counts[type] = { qty: 0, val: 0 };
      counts[type].qty++;
      counts[type].val += v;
    });
    return counts;
  }, [paymentCardsData]);

  const chartData = useMemo(() => {
    const groupByClient = !!activeUnit;
    const barMap: Record<string, any> = {};

    fullyFilteredData.forEach((item) => {
      const rawKey = groupByClient ? item.DESTINATARIO : item.ENTREGA;
      if (!rawKey) return;
      const key = cleanLabel(rawKey);

      if (!barMap[key]) {
        barMap[key] = {
          name: key,
          fullName: rawKey,
          total: 0,
        };
        Object.keys(PAYMENT_COLORS).forEach((k) => (barMap[key][k] = 0));
        barMap[key].OUTROS = 0;
      }

      const val = safeParseValue(item.VALOR_CTE);
      const metric = viewMode === 'qty' ? 1 : val;
      const payType = item.FRETE_PAGO || 'OUTROS';

      barMap[key][payType] = (barMap[key][payType] || 0) + metric;
      barMap[key].total += metric;
    });

    const barData = Object.values(barMap)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 12);

    let pieData: { name: string; value: number; monetary: number }[] = [];
    const tempMap: Record<string, { metric: number; monetary: number }> = {};
    if (pieMode === 'payment') {
      Object.keys(PAYMENT_COLORS).forEach((k) => {
        tempMap[k] = { metric: 0, monetary: 0 };
      });
      tempMap.OUTROS = { metric: 0, monetary: 0 };
    }

    fullyFilteredData.forEach((item) => {
      const val = safeParseValue(item.VALOR_CTE);
      const metric = viewMode === 'qty' ? 1 : val;
      if (pieMode === 'status') {
        const key = resolveDashboardStatusKey(item);
        if (!tempMap[key]) tempMap[key] = { metric: 0, monetary: 0 };
        tempMap[key].metric += metric;
        tempMap[key].monetary += val;
      } else {
        const key = item.FRETE_PAGO || 'OUTROS';
        if (tempMap[key]) {
          tempMap[key].metric += metric;
          tempMap[key].monetary += val;
        } else if (tempMap.OUTROS) {
          tempMap.OUTROS.metric += metric;
          tempMap.OUTROS.monetary += val;
        }
      }
    });

    pieData = Object.entries(tempMap)
      .filter(([, v]) => v.metric > 0 || v.monetary > 0)
      .sort((a, b) => b[1].metric - a[1].metric)
      .map(([k, v]) => ({
        name: k,
        value: v.metric,
        monetary: v.monetary,
      }));

    return { barData, pieData, groupByClient };
  }, [fullyFilteredData, activeUnit, viewMode, pieMode]);

  const handleBarClick = (data: any) => {
    if (activeUnit) return;
    let targetFullName = '';
    if (data && data.fullName) {
      targetFullName = data.fullName;
    } else if (data && (typeof data === 'string' || data.value)) {
      const val = typeof data === 'string' ? data : data.value;
      const found = chartData.barData.find((d: any) => d.name === val);
      if (found) targetFullName = found.fullName;
    }
    if (targetFullName) {
      const match = availableUnits.find((u) => u === targetFullName || cleanLabel(u) === cleanLabel(targetFullName));
      if (match) setSelectedUnit(match);
    }
  };

  const cardBase =
    'rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_8px_24px_rgba(15,23,42,0.04)]';

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const visibleData = payload.filter((p: any) => p.value > 0);
      if (visibleData.length === 0) return null;

      const fullName = payload[0]?.payload?.fullName || label;

      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/80 z-50">
          <p className="mb-2 border-b border-slate-100 pb-1.5 text-sm font-semibold text-slate-800">{fullName}</p>
          <div className="space-y-1.5">
            {visibleData.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.fill }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{p.name}:</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-800">
                  {viewMode === 'value' ? formatCurrency(p.value) : formatNumber(p.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const FilterCard = ({ label, qty, val, color, selected, dimmed, onClick }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'dashboard-filter-card',
        'group relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border text-left transition-all duration-200',
        'border-slate-200/90 bg-white shadow-sm hover:border-slate-300 hover:shadow-md',
        selected &&
          'ring-2 ring-sl-red/30 border-sl-red/45 bg-gradient-to-b from-red-50/80 to-white scale-[1.01]',
        dimmed && !selected && 'opacity-45 saturate-50 hover:opacity-90 hover:saturate-100',
      )}
      style={{
        boxShadow: selected ? `0 8px 28px -6px ${color}35` : undefined,
      }}
    >
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
        style={{ backgroundColor: color, opacity: selected ? 1 : 0.7 }}
      />
      {selected && (
        <div className="absolute right-2 top-2 rounded-full bg-white/90 p-0.5 shadow-sm ring-1 ring-slate-200">
          <CheckCircle size={14} style={{ color }} className="text-white" />
        </div>
      )}
      <div className="pl-3.5 pr-2 pt-2.5">
        <span
          className="block truncate pr-5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500"
          style={{ color: selected ? color : undefined }}
        >
          {label}
        </span>
      </div>
      <div className="px-3.5 pb-3 pt-1">
        <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{formatNumber(qty)}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] font-medium text-slate-500">{formatCurrency(val)}</div>
      </div>
    </button>
  );

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/80 z-50">
          <p className="mb-1 text-sm font-semibold text-slate-800">{data.name}</p>
          <p className="flex justify-between gap-6 text-xs text-slate-500">
            <span>Qtd</span>
            <span className="font-mono font-bold text-slate-900">
              {viewMode === 'qty' ? formatNumber(data.value) : '—'}
            </span>
          </p>
          <p className="mt-0.5 flex justify-between gap-6 text-xs text-slate-500">
            <span>Valor</span>
            <span className="font-mono font-bold text-emerald-700">{formatCurrency(data.monetary)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={clsx(
        'dashboard-executive relative flex w-full flex-1 flex-col gap-6 md:gap-8',
        'min-h-full px-4 py-6 sm:px-6 lg:px-10 lg:py-8',
        'animate-in fade-in duration-500',
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_90%_60%_at_50%_-10%,rgba(44,52,140,0.06),transparent_55%)]"
        aria-hidden
      />

      {/* Cabeçalho + controles */}
      <section className={clsx(cardBase, 'overflow-hidden')}>
        <div className="h-1 w-full bg-gradient-to-r from-sl-navy via-sl-navy-light to-sl-red" />
        <div className="flex flex-col gap-6 p-5 md:flex-row md:items-end md:justify-between md:p-8">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div
              className="hidden shrink-0 rounded-2xl border border-slate-100 p-3 shadow-inner md:flex"
              style={{ background: `linear-gradient(145deg, ${NAVY} 0%, #0c2860 100%)` }}
            >
              <TrendingUp className="h-7 w-7 text-white" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sl-navy">
                <span>BI Operação</span>
                <StatusBadge variant="success">Indicadores ao vivo</StatusBadge>
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-[1.75rem]">
                Visão de pendências
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                {activeUnit
                  ? `Análise focada em: ${activeUnit}`
                  : 'Indicadores consolidados da rede. Combine filtros de status, tipo de frete e período de emissão.'}
              </p>
              <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-500">Última emissão no conjunto</span>
                <span className="font-semibold tabular-nums text-slate-800">{latestEmissaoDate}</span>
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 md:max-w-xl md:items-end">
            {(statusFilters.length > 0 || paymentFilters.length > 0 || appliedDateFrom || appliedDateTo) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilters([]);
                  setPaymentFilters([]);
                  setDraftDateFrom('');
                  setDraftDateTo('');
                  setAppliedDateFrom('');
                  setAppliedDateTo('');
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 md:w-auto"
              >
                <X size={14} /> Limpar filtros
              </button>
            )}

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              {isUserUnitBound ? (
                <div className="flex w-full cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 sm:w-auto">
                  <Package size={16} style={{ color: NAVY_MID }} />
                  <span className="text-sm font-semibold">{user.linkedDestUnit}</span>
                </div>
              ) : (
                <div className="group relative w-full sm:min-w-[260px]">
                  <select
                    value={selectedUnit}
                    onChange={(e) => setSelectedUnit(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 focus:border-sl-navy focus:outline-none focus:ring-2 focus:ring-sl-navy/20"
                  >
                    <option value="">Todas as unidades</option>
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition group-hover:text-sl-navy">
                    <Filter size={16} />
                  </div>
                </div>
              )}

              <div className="flex w-full flex-1 flex-wrap gap-2">
                <input
                  type="date"
                  value={draftDateFrom}
                  onChange={(e) => setDraftDateFrom(e.target.value)}
                  className="min-w-[140px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-sl-navy focus:outline-none focus:ring-2 focus:ring-sl-navy/15"
                  title="Data de emissão inicial"
                />
                <input
                  type="date"
                  value={draftDateTo}
                  onChange={(e) => setDraftDateTo(e.target.value)}
                  className="min-w-[140px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm focus:border-sl-navy focus:outline-none focus:ring-2 focus:ring-sl-navy/15"
                  title="Data de emissão final"
                />
                <button
                  type="button"
                  onClick={() => {
                    setAppliedDateFrom(draftDateFrom);
                    setAppliedDateTo(draftDateTo);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:opacity-95 sm:flex-none"
                  style={{ background: `linear-gradient(135deg, ${NAVY_MID} 0%, ${NAVY} 100%)` }}
                  title="Aplicar filtro por data de emissão"
                >
                  <CalendarCheck2 size={14} />
                  Aplicar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftDateFrom('');
                    setDraftDateTo('');
                    setAppliedDateFrom('');
                    setAppliedDateTo('');
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  title="Limpar filtro por data de emissão"
                >
                  Limpar datas
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6">
        <div className={clsx(cardBase, 'p-5 md:p-6 xl:col-span-7')}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Ranking de atribuições</h2>
              <p className="text-xs text-slate-500">Top responsáveis por volume no recorte filtrado</p>
            </div>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Top 5
            </span>
          </div>
          {assignmentTopRows.length ? (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.08em]">Responsável</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em]">Pendências</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-[0.08em]">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignmentTopRows.map((row) => (
                    <tr key={row.name} className="bg-white">
                      <td className="px-3 py-2 font-semibold text-slate-800">{row.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{formatNumber(row.qty)}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-700">{formatCurrency(row.val)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
              Não há responsáveis atribuídos no conjunto filtrado.
            </div>
          )}
        </div>

        <div className={clsx(cardBase, 'p-5 md:p-6 xl:col-span-5')}>
          <h2 className="text-base font-bold text-slate-900">Leitura executiva</h2>
          <p className="mt-1 text-xs text-slate-500">
            Recomendações automáticas com base no recorte ativo.
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">Fila sem atribuição</p>
              <p className="mt-1 text-slate-600">
                {assignmentKPIs.withoutAssignment > 0
                  ? `${formatNumber(assignmentKPIs.withoutAssignment)} pendências aguardam distribuição.`
                  : 'Todas as pendências deste recorte já possuem responsável.'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">Backlog concluído</p>
              <p className="mt-1 text-slate-600">
                {`Há ${formatNumber(counts.concluidos)} itens concluídos no backlog geral; use esse número para comparar vazão vs entrada.`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">Risco crítico</p>
              <p className="mt-1 text-slate-600">
                {operationalKPIs.criticalRate > 50
                  ? 'Percentual crítico elevado. Priorize redistribuição para reduzir gargalo.'
                  : 'Percentual crítico controlado para o recorte atual.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Novos KPIs de gestão operacional */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        <div className={clsx(cardBase, 'relative overflow-hidden p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Atribuídas</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{formatNumber(assignmentKPIs.withAssignment)}</p>
              <p className="mt-1 text-xs text-slate-500">Pendências com responsável definido</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-emerald-700">
              <UserCheck size={18} />
            </div>
          </div>
        </div>
        <div className={clsx(cardBase, 'relative overflow-hidden p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Sem atribuição</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{formatNumber(assignmentKPIs.withoutAssignment)}</p>
              <p className="mt-1 text-xs text-slate-500">Fila pronta para distribuição</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700">
              <UserX size={18} />
            </div>
          </div>
        </div>
        <div className={clsx(cardBase, 'relative overflow-hidden p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Top responsável</p>
              <p className="mt-1 max-w-[220px] truncate text-lg font-bold text-slate-900">
                {assignmentKPIs.topAssignee?.[0] || '—'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {assignmentKPIs.topAssignee ? `${formatNumber(assignmentKPIs.topAssignee[1])} pendências` : 'Sem dados no filtro atual'}
              </p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2 text-indigo-700">
              <Trophy size={18} />
            </div>
          </div>
        </div>
        <div className={clsx(cardBase, 'relative overflow-hidden p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Concluídos (backlog)</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{formatNumber(counts.concluidos)}</p>
              <p className="mt-1 text-xs text-slate-500">
                Top agência: {assignmentKPIs.topAgency?.[0] || '—'}
              </p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-2 text-sky-700">
              <Building2 size={18} />
            </div>
          </div>
        </div>
      </section>

      {/* Filtros */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6">
        <div className={clsx(cardBase, 'p-4 md:p-5 xl:col-span-12')}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800">Por status</h2>
            <span className="text-[11px] font-medium text-slate-400">Clique para incluir ou excluir do conjunto</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 md:gap-3">
            {DASHBOARD_STATUS_CARD_ORDER.map(({ key, label }) => (
              <FilterCard
                key={key}
                label={label}
                qty={statusAgg[key]?.qty || 0}
                val={statusAgg[key]?.val || 0}
                color={STATUS_COLORS[key] || STATUS_COLORS.OUTROS}
                selected={statusFilters.includes(key)}
                dimmed={statusFilters.length > 0}
                onClick={() => setStatusFilters((prev) => toggleFilter(prev, key))}
              />
            ))}
          </div>
        </div>

        <div className={clsx(cardBase, 'p-4 md:p-5 xl:col-span-12')}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-800">Tipo de frete</h2>
            <span className="text-[11px] font-medium text-slate-400">CIF, FOB e faturamento</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:gap-3">
            {Object.keys(PAYMENT_COLORS).map((type) => (
              <FilterCard
                key={type}
                label={type.replace('_', ' ')}
                qty={paymentAgg[type]?.qty || 0}
                val={paymentAgg[type]?.val || 0}
                color={PAYMENT_COLORS[type]}
                selected={paymentFilters.includes(type)}
                dimmed={paymentFilters.length > 0}
                onClick={() => setPaymentFilters((prev) => toggleFilter(prev, type))}
              />
            ))}
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-6">
        <div
          className={clsx(cardBase, 'dashboard-kpi-main-card relative overflow-hidden p-6 lg:col-span-4')}
          style={{ background: `linear-gradient(135deg, #ffffff 0%, #f4f7fb 100%)` }}
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-sl-navy/[0.07]" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Pendências no escopo</p>
              <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-slate-900">{formatNumber(mainKPIs.qty)}</p>
              <p className="mt-2 text-sm text-slate-500">Quantidade após filtros ativos</p>
              {!statusFilters.length &&
              !paymentFilters.length &&
              !appliedDateFrom &&
              !appliedDateTo &&
              !activeUnit ? (
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  Total distinto (CT-e + série, sem concluídos), alinhado ao backend:{' '}
                  <span className="font-semibold text-slate-700">{formatNumber(operacionalDashboardDistinctTotal)}</span>
                  . Totais por aba (podem sobrepor entre si): Pendências{' '}
                  <span className="font-medium text-slate-700">{formatNumber(counts.pendencias)}</span>, Críticos{' '}
                  <span className="font-medium text-slate-700">{formatNumber(counts.criticos)}</span>, Em busca{' '}
                  <span className="font-medium text-slate-700">{formatNumber(counts.emBusca)}</span>, Ocorrências{' '}
                  <span className="font-medium text-slate-700">{formatNumber(counts.ocorrencias)}</span>.
                </p>
              ) : null}
            </div>
            <div
              className="rounded-2xl p-3 shadow-sm"
              style={{ background: `${NAVY}08`, color: NAVY }}
            >
              <Package className="h-7 w-7" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        <div className={clsx(cardBase, 'relative overflow-hidden p-6 lg:col-span-4')}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_10%,rgba(228,36,36,0.06),transparent_50%)]" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Valor em risco (R$)</p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{formatCurrency(mainKPIs.val)}</p>
              <p className="mt-2 text-sm text-slate-500">Soma dos valores de CTe filtrados</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50 p-3 text-emerald-700 shadow-sm">
              <DollarSign className="h-7 w-7" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        <div className={clsx(cardBase, 'relative overflow-hidden p-6 lg:col-span-4')}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_15%,rgba(44,52,140,0.08),transparent_50%)]" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Performance operacional</p>
              <div className="mt-2 space-y-2">
                <p className="text-sm font-semibold text-slate-700">
                  SLA no prazo:
                  <span className="ml-2 text-lg font-bold text-emerald-700 tabular-nums">
                    {operationalKPIs.onTimeRate.toFixed(1)}%
                  </span>
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  Crítico:
                  <span className="ml-2 text-lg font-bold text-red-700 tabular-nums">
                    {operationalKPIs.criticalRate.toFixed(1)}%
                  </span>
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  Ticket médio:
                  <span className="ml-2 text-lg font-bold text-sl-navy tabular-nums">
                    {formatCurrency(operationalKPIs.avgTicket)}
                  </span>
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 text-sl-navy shadow-sm">
              <Activity className="h-7 w-7" strokeWidth={1.8} />
            </div>
          </div>
        </div>
      </section>

      {/* Tendência temporal + valor diário */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <div className={clsx(cardBase, 'p-5 md:p-6 lg:col-span-7')}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Tendência de volume (14 dias)</h2>
              <p className="text-xs text-slate-500">Evolução diária da quantidade de CTe no escopo filtrado</p>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(value: any, name: any) => [formatNumber(Number(value)), name === 'qty' ? 'Quantidade' : name]}
                  labelFormatter={(l: string) => `Data: ${l}`}
                />
                <Line type="monotone" dataKey="qty" name="Quantidade" stroke={NAVY_MID} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={clsx(cardBase, 'p-5 md:p-6 lg:col-span-5')}>
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Valor diário (14 dias)</h2>
            <p className="text-xs text-slate-500">Área acumulada para leitura rápida de risco financeiro</p>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="valGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND_RED} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={BRAND_RED} stopOpacity={0.06} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Valor']} labelFormatter={(l: string) => `Data: ${l}`} />
                <Area type="monotone" dataKey="val" name="Valor" stroke={BRAND_RED} fill="url(#valGradient)" strokeWidth={2.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Gráficos */}
      <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <div className={clsx(cardBase, 'flex min-h-[480px] flex-col p-5 md:p-6 lg:col-span-8')}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 shadow-sm"
                style={{ color: BRAND_RED, background: `${NAVY}06` }}
              >
                <BarChart3 size={18} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {chartData.groupByClient ? 'Ranking de clientes' : 'Agências ofensoras'}
                </h2>
                <p className="text-xs text-slate-500">Barras empilhadas por tipo de frete</p>
              </div>
              {!isUserUnitBound && activeUnit && (
                <button
                  type="button"
                  onClick={() => setSelectedUnit('')}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-white"
                >
                  <ArrowLeftCircle size={12} />
                  Visão rede
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-slate-400 sm:inline">Métrica:</span>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50/80 p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode('qty')}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-[10px] font-bold transition',
                    viewMode === 'qty'
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  QTD
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('value')}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-[10px] font-bold transition',
                    viewMode === 'value'
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-800',
                  )}
                >
                  R$
                </button>
              </div>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-lg border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Qtd · {formatNumber(mainKPIs.qty)}
            </span>
            <span className="rounded-lg border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Valor · {formatCurrency(mainKPIs.val)}
            </span>
          </div>

          <div className="min-h-[380px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.barData}
                layout="vertical"
                margin={{ top: 4, right: 12, left: 0, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  fontSize={10}
                  tickFormatter={(val) => {
                    const n = typeof val === 'number' ? val : Number(val);
                    if (!Number.isFinite(n) || n === 0) return '—';
                    return viewMode === 'value' ? `R$ ${(n / 1000).toFixed(0)}k` : String(n);
                  }}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontWeight: 600 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={168}
                  fontSize={10}
                  tick={{ fill: '#475569', fontWeight: 600 }}
                  interval={0}
                  onClick={handleBarClick}
                  style={{ cursor: !activeUnit ? 'pointer' : 'default' }}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(44, 52, 140, 0.06)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '12px', color: '#64748b' }} />
                {Object.keys(PAYMENT_COLORS).map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="a"
                    fill={PAYMENT_COLORS[key]}
                    radius={[0, 4, 4, 0]}
                    barSize={20}
                    onClick={handleBarClick}
                    cursor={!activeUnit ? 'pointer' : 'default'}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={clsx(cardBase, 'flex min-h-[480px] flex-col p-5 md:p-6 lg:col-span-4')}>
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 shadow-sm"
                style={{ color: BRAND_RED, background: `${NAVY}06` }}
              >
                <PieChartIcon size={18} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Distribuição</h2>
                <p className="text-xs text-slate-500">Status ou forma de pagamento</p>
              </div>
            </div>
            <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-slate-50/80 p-0.5">
              <button
                type="button"
                onClick={() => setPieMode('status')}
                className={clsx(
                  'rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition',
                  pieMode === 'status'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                Status
              </button>
              <button
                type="button"
                onClick={() => setPieMode('payment')}
                className={clsx(
                  'rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase transition',
                  pieMode === 'payment'
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                Pgto
              </button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius="52%"
                  outerRadius="78%"
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.pieData.map((entry, index) => {
                    const color =
                      pieMode === 'status'
                        ? STATUS_COLORS[entry.name] || '#94a3b8'
                        : PAYMENT_COLORS[entry.name] || '#94a3b8';
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={2}
                        onMouseEnter={() => setActivePieKey(entry.name)}
                        onMouseLeave={() => setActivePieKey(null)}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px', paddingTop: '12px', width: '100%', color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-10">
              <div className="rounded-2xl border border-slate-100 bg-white/90 px-4 py-3 text-center shadow-sm backdrop-blur-[2px]">
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Total</span>
                <span className="text-xl font-bold tabular-nums text-slate-900">
                  {(() => {
                    if (!activePieKey) return formatNumber(mainKPIs.qty);
                    const found = chartData.pieData.find((p) => p.name === activePieKey);
                    if (!found) return '—';
                    return viewMode === 'qty' ? formatNumber(found.value) : formatCurrency(found.monetary);
                  })()}
                </span>
                {activePieKey && (
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {activePieKey}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
