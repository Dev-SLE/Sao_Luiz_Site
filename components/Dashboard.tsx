import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, CartesianGrid 
} from 'recharts';
import { Filter, DollarSign, Package, AlertCircle, CheckCircle, PieChart as PieChartIcon, BarChart3, TrendingUp, X, ArrowLeftCircle, CalendarCheck2 } from 'lucide-react';
import clsx from 'clsx';
import { COLORS } from '../constants';

const Dashboard: React.FC = () => {
  const { processedData, baseData } = useData();
  const { user } = useAuth();
  
  // State for Filters
  const [selectedUnit, setSelectedUnit] = useState<string>('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [paymentFilters, setPaymentFilters] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'qty' | 'value'>('qty');
  const [pieMode, setPieMode] = useState<'status' | 'payment'>('status');
  const [activePieKey, setActivePieKey] = useState<string | null>(null);

  const STATUS_COLORS: Record<string, string> = {
    'CRÍTICO': COLORS.critical,
    'FORA DO PRAZO': COLORS.late,
    'PRIORIDADE': COLORS.priority,
    'VENCE AMANHÃ': COLORS.tomorrow,
    'NO PRAZO': COLORS.ontime,
  };

  const PAYMENT_COLORS: Record<string, string> = {
    'CIF': '#10b981',             
    'FOB': '#ef4444',             
    'FATURAR_REMETENTE': '#eab308', 
    'FATURAR_DEST': '#f97316'     
  };

  const cleanLabel = (name: string) => {
    if (!name) return '';
    let cleaned = name.replace(/^(DEC|FILIAL)\s*-?\s*/i, '');
    // Increased truncate limit from 18 to 22 characters
    if (cleaned.length > 22) {
      return cleaned.substring(0, 22) + '...';
    }
    return cleaned;
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val: number) => new Intl.NumberFormat('pt-BR').format(val);

  const toggleFilter = (list: string[], item: string) => {
    return list.includes(item) ? list.filter(i => i !== item) : [...list, item];
  };

  const safeParseValue = (valStr: string | undefined | null) => {
    if (!valStr) return 0;
    try {
      const clean = valStr.replace(/[^\d,-]/g, '').replace(',', '.');
      return parseFloat(clean) || 0;
    } catch (e) {
      return 0;
    }
  };

  const parseDateToComparable = (dateStr: string) => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return parseInt(parts[2] + parts[1].padStart(2, '0') + parts[0].padStart(2, '0'));
    }
    return 0;
  };

  // --- Data Processing ---
  const isUserUnitBound = !!user?.linkedDestUnit;
  const activeUnit = isUserUnitBound ? user.linkedDestUnit : selectedUnit;

  const latestEmissaoDate = useMemo(() => {
    if (baseData.length === 0) return '--/--/----';
    let maxVal = 0;
    let maxStr = '';
    baseData.forEach(d => {
       const currentVal = parseDateToComparable(d.DATA_EMISSAO);
       if (currentVal > maxVal) {
           maxVal = currentVal;
           maxStr = d.DATA_EMISSAO;
       }
    });
    return maxStr || '--/--/----';
  }, [baseData]);

  const availableUnits = useMemo(() => {
    const units = new Set(processedData.map(d => d.ENTREGA).filter(Boolean));
    return Array.from(units).sort();
  }, [processedData]);

  const baseScopeData = useMemo(() => {
    return processedData.filter(item => {
      if (activeUnit && item.ENTREGA !== activeUnit) return false;
      return true;
    });
  }, [processedData, activeUnit]);

  const statusCardsData = useMemo(() => {
    return baseScopeData.filter(item => {
      if (paymentFilters.length > 0 && !paymentFilters.includes(item.FRETE_PAGO || 'OUTROS')) return false;
      return true;
    });
  }, [baseScopeData, paymentFilters]);

  const paymentCardsData = useMemo(() => {
    return baseScopeData.filter(item => {
      if (statusFilters.length > 0) {
        const status = item.STATUS_CALCULADO || item.STATUS || 'OUTROS';
        if (!statusFilters.includes(status)) return false;
      }
      return true;
    });
  }, [baseScopeData, statusFilters]);

  const fullyFilteredData = useMemo(() => {
    return baseScopeData.filter(item => {
      if (paymentFilters.length > 0 && !paymentFilters.includes(item.FRETE_PAGO || 'OUTROS')) return false;
      if (statusFilters.length > 0) {
        const status = item.STATUS_CALCULADO || item.STATUS || 'OUTROS';
        if (!statusFilters.includes(status)) return false;
      }
      return true;
    });
  }, [baseScopeData, paymentFilters, statusFilters]);

  const mainKPIs = useMemo(() => {
    let qty = 0;
    let val = 0;
    fullyFilteredData.forEach(d => {
      qty++;
      val += safeParseValue(d.VALOR_CTE);
    });
    return { qty, val };
  }, [fullyFilteredData]);

  const statusAgg = useMemo(() => {
    const counts: Record<string, { qty: number, val: number }> = {};
    statusCardsData.forEach(item => {
      const status = item.STATUS_CALCULADO || 'OUTROS';
      const v = safeParseValue(item.VALOR_CTE);
      if (!counts[status]) counts[status] = { qty: 0, val: 0 };
      counts[status].qty++;
      counts[status].val += v;
    });
    return counts;
  }, [statusCardsData]);

  const paymentAgg = useMemo(() => {
    const counts: Record<string, { qty: number, val: number }> = {};
    paymentCardsData.forEach(item => {
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

    fullyFilteredData.forEach(item => {
      const rawKey = groupByClient ? item.DESTINATARIO : item.ENTREGA;
      if (!rawKey) return;
      const key = cleanLabel(rawKey); 

      if (!barMap[key]) {
        barMap[key] = { 
          name: key, 
          fullName: rawKey,
          total: 0 
        };
        Object.keys(PAYMENT_COLORS).forEach(k => barMap[key][k] = 0);
        barMap[key]['OUTROS'] = 0;
      }

      const val = safeParseValue(item.VALOR_CTE);
      const metric = viewMode === 'qty' ? 1 : val;
      const payType = item.FRETE_PAGO || 'OUTROS';

      barMap[key][payType] = (barMap[key][payType] || 0) + metric;
      barMap[key].total += metric;
    });

    // Reduced slice from 20 to 12 to prevent overlap
    const barData = Object.values(barMap).sort((a: any, b: any) => b.total - a.total).slice(0, 12);

    let pieData: { name: string, value: number, monetary: number }[] = [];
    const keys = pieMode === 'status' ? Object.keys(STATUS_COLORS) : Object.keys(PAYMENT_COLORS);
    const tempMap: Record<string, { metric: number, monetary: number }> = {};
    keys.forEach(k => tempMap[k] = { metric: 0, monetary: 0 });

    fullyFilteredData.forEach(item => {
        const key = pieMode === 'status' ? (item.STATUS_CALCULADO || 'OUTROS') : (item.FRETE_PAGO || 'OUTROS');
        const val = safeParseValue(item.VALOR_CTE);
        const metric = viewMode === 'qty' ? 1 : val;

        if (tempMap[key]) {
            tempMap[key].metric += metric;
            tempMap[key].monetary += val;
        }
    });

    pieData = Object.keys(tempMap).map(k => ({ 
        name: k, 
        value: tempMap[k].metric,
        monetary: tempMap[k].monetary
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
          const match = availableUnits.find(u => u === targetFullName || cleanLabel(u) === cleanLabel(targetFullName));
          if (match) setSelectedUnit(match);
      }
  };

  // Custom Tooltip for Bar Chart to hide zero values
  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Filter out payloads with zero value
      const visibleData = payload.filter((p: any) => p.value > 0);
      if (visibleData.length === 0) return null;

      const fullName = payload[0]?.payload?.fullName || label;

      return (
        <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg z-50">
          <p className="text-sm font-bold text-gray-800 mb-2 border-b pb-1">{fullName}</p>
          <div className="space-y-1">
            {visibleData.map((p: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
                  <span className="text-[11px] font-bold text-gray-500 uppercase">{p.name}:</span>
                </div>
                <span className="text-xs font-mono font-black text-gray-700">
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
  <div 
      onClick={onClick}
      className={clsx(
        "rounded-xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between h-full relative overflow-hidden group",
        "bg-[#0B0F2A] border-[#2B2F8F] text-gray-100 hover:bg-[#0F1440]",
        selected && "ring-2 ring-offset-1 ring-[#EC1B23] z-10 scale-[1.02] shadow-[0_0_20px_rgba(0,0,0,0.9)]",
        dimmed && !selected ? "opacity-40 hover:opacity-80 scale-95 grayscale-[0.5]" : "opacity-100"
      )}
      style={{ 
        borderColor: selected ? color : '#2B2F8F',
        boxShadow: selected ? `0 4px 12px -2px ${color}30` : undefined
      }}
    >
       {selected && (
          <div className="absolute top-1.5 right-1.5">
            <CheckCircle size={14} fill={color} className="text-white" />
          </div>
       )}
      <div className="mb-1">
        <span
          className="font-bold text-[10px] uppercase tracking-wider truncate block pr-4"
          style={{ color: selected ? color : '#e5e7eb' }}
        >
          {label}
        </span>
      </div>
      <div>
        <div className="text-xl md:text-2xl font-bold text-white leading-none tracking-tight">
          {formatNumber(qty)}
        </div>
        <div className="text-[10px] text-gray-300 mt-0.5 font-mono font-medium truncate">
          {formatCurrency(val)}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 h-1 w-full transition-all" style={{ backgroundColor: color, opacity: selected ? 1 : 0.5 }} />
    </div>
  );

  const CustomPieTooltip = ({ active, payload }: any) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
          <div className="bg-white p-3 border border-gray-100 shadow-xl rounded-lg z-50">
            <p className="text-sm font-bold text-gray-800 mb-1">{data.name}</p>
            <p className="text-xs text-gray-500 flex justify-between gap-4">
                <span>Qtd:</span> <span className="font-mono text-gray-700 font-bold">{viewMode === 'qty' ? formatNumber(data.value) : '-'}</span>
            </p>
            <p className="text-xs text-gray-500 flex justify-between gap-4">
                <span>Valor:</span> <span className="font-mono text-primary-600 font-bold">{formatCurrency(data.monetary)}</span>
            </p>
          </div>
        );
      }
      return null;
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500 text-white min-h-0">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 shrink-0">
        <div className="flex items-center gap-3">
             <div className="hidden md:block rounded-lg bg-[#0F103A] p-2 text-[#EC1B23] border border-[#1A1B62] shadow-[0_0_18px_rgba(236,27,35,0.4)]">
                 <TrendingUp size={24} />
             </div>
             <div>
                <h1 className="text-2xl font-black text-white leading-tight tracking-tight">Painel de Controle</h1>
                <p className="text-xs text-gray-400">
                    {activeUnit ? `Análise detalhada: ${activeUnit}` : 'Visão consolidada da rede'}
                </p>
             </div>
        </div>

        <div className="w-full lg:w-auto flex flex-col md:flex-row gap-2 items-center">
            {(statusFilters.length > 0 || paymentFilters.length > 0) && (
                <button 
                    onClick={() => { setStatusFilters([]); setPaymentFilters([]); }}
                    className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center justify-center gap-1 px-3 py-2 bg-red-50 rounded-lg border border-red-100 transition-colors w-full md:w-auto"
                >
                    <X size={14} /> Limpar Filtros
                </button>
            )}
           {isUserUnitBound ? (
             <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 cursor-not-allowed w-full lg:w-auto shadow-sm">
               <Package size={16} />
               <span className="font-bold text-sm">{user.linkedDestUnit}</span>
             </div>
           ) : (
             <div className="relative w-full lg:w-auto group">
               <select 
                 value={selectedUnit}
                 onChange={(e) => setSelectedUnit(e.target.value)}
                 className="appearance-none bg-[#080816] border border-[#1A1B62] text-gray-100 py-2.5 pl-4 pr-10 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#EC1B23] focus:border-[#EC1B23] font-bold text-sm w-full lg:min-w-[280px] cursor-pointer hover:border-[#6E71DA] transition-colors"
               >
                 <option value="">Todas as Unidades</option>
                 {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
               </select>
               <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 group-hover:text-[#EC1B23] transition-colors">
                 <Filter size={16} />
               </div>
             </div>
           )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 shrink-0">
         <div className="xl:col-span-2 grid grid-cols-2 xl:grid-cols-1 gap-3 h-full">
             <div className="bg-gradient-to-br from-[#101143] via-[#1A1B62] to-[#EC1B23] rounded-xl p-4 shadow-[0_0_28px_rgba(0,0,0,0.8)] text-white flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute right-[-15px] top-[-15px] opacity-10 group-hover:opacity-20 transition-all">
                    <Package size={80} />
                </div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-wider mb-0.5">Pendências Totais</p>
                <h2 className="text-3xl font-black tracking-tight leading-none drop-shadow-[0_0_10px_rgba(0,0,0,0.7)]">
                  {formatNumber(mainKPIs.qty)}
                </h2>
             </div>
             <div className="rounded-xl p-4 shadow-[0_0_24px_rgba(0,0,0,0.7)] border border-[#2B2F8F] flex flex-col justify-center relative overflow-hidden bg-[#0B0F2A]">
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Valor em Risco</p>
                <h2 className="text-2xl font-black text-white tracking-tight leading-none">{formatCurrency(mainKPIs.val)}</h2>
                <div className="absolute right-2 top-2 bg-emerald-900/70 p-1.5 rounded-full text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.6)]">
                    <DollarSign size={16} />
                </div>
             </div>
         </div>

         <div className="xl:col-span-10 flex flex-col gap-2">
            <div className="bg-[#070A20] p-3 rounded-xl border border-[#1E226F] flex-1 shadow-[0_0_24px_rgba(0,0,0,0.7)]">
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 h-full">
                    {['FORA DO PRAZO', 'CRÍTICO', 'PRIORIDADE', 'VENCE AMANHÃ', 'NO PRAZO'].map(status => (
                        <FilterCard 
                            key={status}
                            label={status}
                            qty={statusAgg[status]?.qty || 0}
                            val={statusAgg[status]?.val || 0}
                            color={STATUS_COLORS[status]}
                            selected={statusFilters.includes(status)}
                            dimmed={statusFilters.length > 0}
                            onClick={() => setStatusFilters(prev => toggleFilter(prev, status))}
                        />
                    ))}
                 </div>
            </div>
            
            <div className="bg-[#070A20] p-3 rounded-xl border border-[#1E226F] shadow-[0_0_24px_rgba(0,0,0,0.7)]">
                 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 h-full">
                    {Object.keys(PAYMENT_COLORS).map(type => (
                        <FilterCard 
                            key={type}
                            label={type.replace('_', ' ')}
                            qty={paymentAgg[type]?.qty || 0}
                            val={paymentAgg[type]?.val || 0}
                            color={PAYMENT_COLORS[type]}
                            selected={paymentFilters.includes(type)}
                            dimmed={paymentFilters.length > 0}
                            onClick={() => setPaymentFilters(prev => toggleFilter(prev, type))}
                        />
                    ))}
                 </div>
            </div>
         </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        <div className="lg:col-span-2 bg-[#070A20] p-4 rounded-xl shadow-[0_0_28px_rgba(0,0,0,0.85)] border border-[#1E226F] flex flex-col h-full min-h-[450px]">
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 shrink-0 gap-2 text-white">
              <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                    <BarChart3 size={18} className="text-[#EC1B23]" />
                    {chartData.groupByClient ? 'Ranking de Clientes' : 'Agências Ofensoras'}
                  </h3>
                  
                  {!isUserUnitBound && activeUnit && (
                      <button 
                        onClick={() => setSelectedUnit('')}
                        className="flex items-center gap-1 text-[10px] font-bold bg-[#080816] hover:bg-[#0F103A] text-gray-100 px-2 py-1 rounded-full transition-colors border border-[#1A1B62] whitespace-nowrap"
                      >
                         <ArrowLeftCircle size={12} />
                         Limpar
                      </button>
                  )}
              </div>

              <div className="flex bg-[#0F103A] p-0.5 rounded-lg self-end sm:self-auto border border-[#1A1B62]">
                 <button 
                   onClick={() => setViewMode('qty')}
                   className={clsx("px-2 py-1 text-[10px] font-bold rounded-md transition-all", viewMode === 'qty' ? "bg-white text-[#1A1B62]" : "text-gray-300")}
                 >
                   QTD
                 </button>
                 <button 
                   onClick={() => setViewMode('value')}
                   className={clsx("px-2 py-1 text-[10px] font-bold rounded-md transition-all", viewMode === 'value' ? "bg-white text-[#1A1B62]" : "text-gray-300")}
                 >
                   R$
                 </button>
              </div>
           </div>
           <div className="flex flex-wrap gap-2 mb-3">
             <span className="text-[10px] font-bold uppercase tracking-wider bg-[#080816] border border-[#1A1B62] text-gray-300 px-2 py-1 rounded-lg">
               Qtd filtrada: {formatNumber(mainKPIs.qty)}
             </span>
             <span className="text-[10px] font-bold uppercase tracking-wider bg-[#080816] border border-[#1A1B62] text-gray-300 px-2 py-1 rounded-lg">
               Valor filtrado: {formatCurrency(mainKPIs.val)}
             </span>
           </div>
           
           <div className="flex-1 w-full min-h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart 
                 data={chartData.barData} 
                 layout="vertical"
                 margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
               >
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1F2937" />
                 <XAxis 
                    type="number" 
                    fontSize={9} 
                    tickFormatter={(val) => {
                      const n = typeof val === 'number' ? val : Number(val);
                      if (!Number.isFinite(n) || n === 0) return '-';
                      return viewMode === 'value' ? `R$ ${(n/1000).toFixed(0)}k` : n;
                    }} 
                    axisLine={false}
                    tickLine={false}
                 />
                 <YAxis 
                   dataKey="name" 
                   type="category" 
                   width={170} 
                   fontSize={10} 
                   tick={{fill: '#4b5563', fontWeight: 600}}
                   interval={0}
                   onClick={handleBarClick}
                   style={{ cursor: !activeUnit ? 'pointer' : 'default' }}
                 />
                 <Tooltip content={<CustomBarTooltip />} cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                 <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                 {Object.keys(PAYMENT_COLORS).map(key => (
                   <Bar 
                    key={key} 
                    dataKey={key} 
                    stackId="a" 
                    fill={PAYMENT_COLORS[key]} 
                    radius={[0, 2, 2, 0]} 
                    barSize={18} 
                    onClick={handleBarClick}
                    cursor={!activeUnit ? 'pointer' : 'default'}
                   />
                 ))}
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-[#070A20] p-4 rounded-xl shadow-[0_0_28px_rgba(0,0,0,0.85)] border border-[#1E226F] flex flex-col h-full min-h-[400px] text-white">
           <div className="flex justify-between items-center mb-4 shrink-0">
              <h3 className="font-bold text-white flex items-center gap-2 text-sm">
                <PieChartIcon size={18} className="text-[#EC1B23]" />
                Distribuição
              </h3>
              <div className="flex bg-[#0F103A] p-0.5 rounded-lg border border-[#1A1B62]">
                 <button 
                   onClick={() => setPieMode('status')}
                   className={clsx("px-2 py-0.5 text-[10px] font-bold rounded-md transition-all uppercase", pieMode === 'status' ? "bg-white text-[#1A1B62]" : "text-gray-300")}
                 >
                   Status
                 </button>
                 <button 
                   onClick={() => setPieMode('payment')}
                   className={clsx("px-2 py-0.5 text-[10px] font-bold rounded-md transition-all uppercase", pieMode === 'payment' ? "bg-white text-[#1A1B62]" : "text-gray-300")}
                 >
                   Pgto
                 </button>
              </div>
           </div>

           <div className="flex-1 min-h-0 relative">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={chartData.pieData}
                   cx="50%"
                   cy="50%"
                   innerRadius="50%"
                   outerRadius="80%"
                   paddingAngle={2}
                   dataKey="value"
                 >
                   {chartData.pieData.map((entry, index) => {
                      const color = pieMode === 'status' 
                        ? (STATUS_COLORS[entry.name] || '#ccc') 
                        : (PAYMENT_COLORS[entry.name] || '#ccc');
                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={color}
                          stroke="white"
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
                    wrapperStyle={{ fontSize: '10px', paddingTop: '10px', width: '100%' }} 
                 />
               </PieChart>
             </ResponsiveContainer>
             
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                 <div className="text-center">
                    <span className="text-[10px] text-gray-400 font-bold block uppercase">Total</span>
                    <span className="text-lg font-black text-white">
                      {(() => {
                        if (!activePieKey) return formatNumber(mainKPIs.qty);
                        const found = chartData.pieData.find(p => p.name === activePieKey);
                        if (!found) return '-';
                        return viewMode === 'qty' ? formatNumber(found.value) : formatCurrency(found.monetary);
                      })()}
                    </span>
                    {activePieKey && (
                      <span className="text-[10px] text-gray-400 font-bold block uppercase mt-1 tracking-wider">
                        {activePieKey}
                      </span>
                    )}
                 </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;