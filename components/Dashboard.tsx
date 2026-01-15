
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line
} from 'recharts';
import { Filter as FilterIcon, Table as TableIcon, LayoutDashboard, Search, X, ChevronDown, DollarSign, TrendingUp, Receipt, Wallet, Target, CheckCircle2, Calendar, LayoutGrid, BarChart3, List, Layers } from 'lucide-react';
import { DashboardData } from '../types';

interface DashboardProps {
  data: DashboardData;
}

const colorMap: Record<string, { bg: string, text: string, lightBg: string }> = {
  emerald: { bg: 'bg-emerald-600', text: 'text-emerald-600', lightBg: 'bg-emerald-50' },
  rose: { bg: 'bg-rose-600', text: 'text-rose-600', lightBg: 'bg-rose-50' },
  amber: { bg: 'bg-amber-600', text: 'text-amber-600', lightBg: 'bg-amber-50' },
  indigo: { bg: 'bg-indigo-600', text: 'text-indigo-600', lightBg: 'bg-indigo-50' },
};

type ViewMode = 'central' | 'utmdash' | 'graphs' | 'database';
type DatePreset = 'all' | 'today' | '7days' | '15days' | '30days' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('central');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [columnSearchTerms, setColumnSearchTerms] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [manualInvestment, setManualInvestment] = useState<number>(0);
  const [groupInvestments, setGroupInvestments] = useState<Record<string, number>>({});
  const [activeHeaderFilter, setActiveHeaderFilter] = useState<string | null>(null);
  
  // Estados de Data
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Adiciona índice original estável
  const rowsWithIndex = useMemo(() => {
    return data.rows.map((row, index) => ({ ...row, _id: index }));
  }, [data.rows]);

  const findHeader = (keys: string[], indexHint?: number) => {
    if (indexHint !== undefined && data.headers[indexHint]) return data.headers[indexHint];
    return data.headers.find(h => keys.some(k => h.toLowerCase() === k.toLowerCase() || h.toLowerCase().includes(k.toLowerCase())));
  };

  const colData = findHeader(['data', 'data da venda'], 1);
  const colProduto = findHeader(['produto', 'nome do produto'], 7);
  const colFaturamento = findHeader(['valor', 'valor da venda', 'venda'], 11);
  const colCampaign = findHeader(['utm_campaign', 'campanha'], 29);
  const colTerm = findHeader(['utm_term', 'termo'], 30);

  const categoricalFilterCols = [colProduto, colCampaign, colTerm].filter(Boolean) as string[];

  const parseBrazilianDate = (dateStr: any) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split(' ')[0].split('/');
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    const isoDate = new Date(dateStr);
    return isNaN(isoDate.getTime()) ? null : isoDate;
  };

  const uniqueValuesMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    categoricalFilterCols.forEach(col => {
      const vals = Array.from(new Set<string>(data.rows.map(r => String(r[col] ?? '')).filter(v => v !== '')));
      map[col] = vals.sort();
    });
    return map;
  }, [data.rows, categoricalFilterCols]);

  const toggleFilter = (column: string, value: string) => {
    setFilters(prev => {
      const current = prev[column] || [];
      const updated = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      return { ...prev, [column]: updated.length > 0 ? updated : [] };
    });
  };

  const clearAllFilters = () => {
    setFilters({});
    setSearchTerm('');
    setColumnSearchTerms({});
    setDatePreset('all');
    setActiveHeaderFilter(null);
  };

  const filteredRows = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return rowsWithIndex.filter(row => {
      if (colData && datePreset !== 'all') {
        const rowDate = parseBrazilianDate(row[colData]);
        if (!rowDate) return false;
        if (datePreset === 'today') {
          const today = new Date();
          if (rowDate.toDateString() !== today.toDateString()) return false;
        } else if (datePreset === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(now.getDate() - 7);
          if (rowDate < sevenDaysAgo) return false;
        } else if (datePreset === '15days') {
          const fifteenDaysAgo = new Date();
          fifteenDaysAgo.setDate(now.getDate() - 15);
          if (rowDate < fifteenDaysAgo) return false;
        } else if (datePreset === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(now.getDate() - 30);
          if (rowDate < thirtyDaysAgo) return false;
        } else if (datePreset === 'custom' && customStartDate && customEndDate) {
          const start = new Date(customStartDate);
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (rowDate < start || rowDate > end) return false;
        }
      }
      const matchesFilters = Object.entries(filters).every(([col, vals]) => {
        const selectedValues = vals as string[];
        if (!selectedValues || selectedValues.length === 0) return true;
        return selectedValues.includes(String(row[col]));
      });
      const matchesSearch = searchTerm === '' || data.headers.some(h => 
        String(row[h]).toLowerCase().includes(searchTerm.toLowerCase())
      );
      return matchesFilters && matchesSearch;
    });
  }, [rowsWithIndex, filters, searchTerm, datePreset, customStartDate, customEndDate, colData]);

  // Agrupamento para UTM DASH
  const groupedData = useMemo(() => {
    const groups: Record<string, any> = {};
    
    filteredRows.forEach(row => {
      // Normalização robusta para evitar agrupamentos errôneos por espaços invisíveis
      const prod = String(row[colProduto || ''] || 'N/A').trim();
      const camp = String(row[colCampaign || ''] || 'N/A').trim();
      const term = String(row[colTerm || ''] || 'N/A').trim();
      const key = `${prod}|${camp}|${term}`;
      
      if (!groups[key]) {
        groups[key] = {
          key,
          product: prod,
          campaign: camp,
          term: term,
          salesCount: 0,
          totalRevenue: 0,
          dates: new Set<string>(),
        };
      }
      
      groups[key].salesCount += 1;
      groups[key].totalRevenue += Number(row[colFaturamento || '']) || 0;
      const dateOnly = String(row[colData || '']).split(' ')[0];
      groups[key].dates.add(dateOnly);
    });

    return Object.values(groups).sort((a, b) => b.salesCount - a.salesCount);
  }, [filteredRows, colProduto, colCampaign, colTerm, colFaturamento, colData]);

  const stats = useMemo(() => {
    let fat = 0;
    filteredRows.forEach(row => {
      fat += Number(row[colFaturamento || '']) || 0;
    });
    const imp = fat * 0.06;
    const gas = manualInvestment;
    const luc = fat - gas - imp;
    const avgRoas = gas > 0 ? fat / gas : 0;
    return { fat, gas, imp, luc, roas: avgRoas };
  }, [filteredRows, colFaturamento, manualInvestment]);

  const categoricalHeaders = data.headers.filter(h => data.types[h] === 'string' && !h.toLowerCase().includes('id'));
  const metricHeaders = data.headers.filter(h => data.types[h] === 'number' && !h.toLowerCase().includes('id'));
  const [chartCat, setChartCat] = useState(colProduto || colCampaign || categoricalHeaders[0] || '');
  const [chartMet, setChartMet] = useState(colFaturamento || metricHeaders[0] || '');

  const chartData = useMemo(() => {
    if (!chartCat || !chartMet) return [];
    const aggregated: Record<string, number> = {};
    filteredRows.forEach(row => {
      const k = String(row[chartCat]) || 'N/A';
      const v = Number(row[chartMet]) || 0;
      aggregated[k] = (aggregated[k] || 0) + v;
    });
    return Object.entries(aggregated)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [filteredRows, chartCat, chartMet]);

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6 pb-20 w-full">
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Menu Superior */}
      <div className="bg-slate-200/50 p-1.5 rounded-2xl w-full flex flex-wrap lg:flex-nowrap gap-2 sticky top-20 z-40 backdrop-blur-md shadow-sm border border-slate-200">
        <TabButton active={viewMode === 'central'} onClick={() => setViewMode('central')} label="Análise Central" icon={<LayoutGrid className="w-4 h-4 mr-2" />} />
        <TabButton active={viewMode === 'utmdash'} onClick={() => setViewMode('utmdash')} label="UTM DASH (Agrupado)" icon={<Layers className="w-4 h-4 mr-2" />} />
        <TabButton active={viewMode === 'graphs'} onClick={() => setViewMode('graphs')} label="Análise Gráfica" icon={<BarChart3 className="w-4 h-4 mr-2" />} />
        <TabButton active={viewMode === 'database'} onClick={() => setViewMode('database')} label="Base de Dados" icon={<List className="w-4 h-4 mr-2" />} />
      </div>

      {/* View: Análise Central */}
      {viewMode === 'central' && (
        <div className="space-y-8 animate-in fade-in duration-500 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard title="Faturamento" value={formatBRL(stats.fat)} icon={<TrendingUp className="w-4 h-4" />} color="emerald" tag="Vendas" />
            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm relative group overflow-hidden ring-2 ring-transparent hover:ring-rose-100 transition-all">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Wallet className="w-4 h-4" /></div>
                  <span className="text-[9px] font-black uppercase bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">Tráfego</span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Investido Geral</p>
                <div className="flex items-center">
                  <span className="text-xl font-black text-slate-800 tracking-tighter mr-1">R$</span>
                  <input
                    type="number"
                    value={manualInvestment || ''}
                    onChange={(e) => setManualInvestment(Number(e.target.value))}
                    className="w-full bg-transparent border-none outline-none text-xl font-black text-slate-800 tracking-tighter focus:ring-0 p-0"
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
            <StatCard title="Impostos" value={formatBRL(stats.imp)} icon={<Receipt className="w-4 h-4" />} color="amber" tag="6%" />
            <StatCard title="ROAS" value={`${stats.roas.toFixed(2)}x`} icon={<Target className="w-4 h-4" />} color="indigo" tag="ROI" />
            <div className="bg-indigo-600 p-5 rounded-[28px] shadow-xl text-white relative overflow-hidden group">
              <div className="relative z-10">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Lucro Estimado</p>
                <h3 className="text-2xl font-black tracking-tighter">{formatBRL(stats.luc)}</h3>
                <p className="text-[11px] font-bold text-indigo-100 mt-2">Margem: {stats.fat > 0 ? ((stats.luc/stats.fat)*100).toFixed(1) : 0}%</p>
              </div>
              <DollarSign className="absolute -bottom-2 -right-2 w-16 h-16 text-white opacity-10" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-8 w-full">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><FilterIcon className="w-5 h-5" /></div>
                <h4 className="text-lg font-black text-slate-800 tracking-tighter uppercase">Filtros Avançados</h4>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={clearAllFilters} className="px-4 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-all flex items-center">
                  <X className="w-4 h-4 mr-1" /> LIMPAR
                </button>
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Pesquisa rápida..."
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoricalFilterCols.map(col => (
                <FilterColumn 
                  key={col} 
                  col={col} 
                  uniqueValues={uniqueValuesMap[col]} 
                  filters={filters} 
                  toggleFilter={toggleFilter} 
                  searchTerm={columnSearchTerms[col] || ''} 
                  onSearchChange={(val) => setColumnSearchTerms(prev => ({ ...prev, [col]: val }))} 
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* View: UTM DASH (Refatorado para Agrupamento) */}
      {viewMode === 'utmdash' && (
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300 w-full">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h4 className="font-black text-slate-800 tracking-tighter uppercase text-sm flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                UTM Performance Agrupado ({groupedData.length} clusters)
              </h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Agrupado por Produto + Campanha + Termo</p>
            </div>
            <div className="text-[10px] font-black text-slate-400 uppercase flex flex-wrap gap-4">
              <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-emerald-500 mr-2" /> Lucro Positivo</span>
              <span className="flex items-center"><div className="w-2 h-2 rounded-full bg-rose-500 mr-2" /> Prejuízo</span>
              <button onClick={clearAllFilters} className="text-rose-500 hover:text-rose-600 ml-2 flex items-center">
                <X className="w-3 h-3 mr-1" /> Resetar
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[750px] scrollbar-thin">
            <table className="w-full text-left text-[11px] border-collapse relative table-fixed">
              <thead className="sticky top-0 z-30 bg-slate-50 shadow-sm">
                <tr className="border-b border-slate-200">
                  <HeaderCell 
                    label="Período" 
                    id="date"
                    width="120px"
                    active={activeHeaderFilter === 'date'}
                    onClick={() => setActiveHeaderFilter(activeHeaderFilter === 'date' ? null : 'date')}
                    hasFilter={datePreset !== 'all'}
                  >
                    <div className="p-4 w-64 space-y-4 text-slate-800">
                      <div className="flex flex-wrap gap-2">
                        {['all', 'today', '7days', '15days', '30days', 'custom'].map(id => (
                          <button key={id} onClick={() => setDatePreset(id as DatePreset)} className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${datePreset === id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                            {id === 'all' ? 'Tudo' : id}
                          </button>
                        ))}
                      </div>
                      {datePreset === 'custom' && (
                        <div className="space-y-2">
                          <input type="date" className="w-full bg-slate-50 border rounded-lg px-2 py-1 text-[10px]" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} />
                          <input type="date" className="w-full bg-slate-50 border rounded-lg px-2 py-1 text-[10px]" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} />
                        </div>
                      )}
                    </div>
                  </HeaderCell>

                  <HeaderCell 
                    label="Produto" 
                    id="prod"
                    width="200px"
                    active={activeHeaderFilter === 'prod'}
                    onClick={() => setActiveHeaderFilter(activeHeaderFilter === 'prod' ? null : 'prod')}
                    hasFilter={filters[colProduto || '']?.length > 0}
                  >
                    <HeaderFilterPopup 
                      col={colProduto || ''} 
                      options={uniqueValuesMap[colProduto || '']} 
                      filters={filters} 
                      toggleFilter={toggleFilter} 
                      searchTerm={columnSearchTerms[colProduto || ''] || ''}
                      onSearchChange={(v) => setColumnSearchTerms(prev => ({...prev, [colProduto || '']: v}))}
                    />
                  </HeaderCell>

                  <HeaderCell 
                    label="Campanha" 
                    id="camp"
                    width="35%"
                    active={activeHeaderFilter === 'camp'}
                    onClick={() => setActiveHeaderFilter(activeHeaderFilter === 'camp' ? null : 'camp')}
                    hasFilter={filters[colCampaign || '']?.length > 0}
                  >
                    <HeaderFilterPopup 
                      col={colCampaign || ''} 
                      options={uniqueValuesMap[colCampaign || '']} 
                      filters={filters} 
                      toggleFilter={toggleFilter} 
                      searchTerm={columnSearchTerms[colCampaign || ''] || ''}
                      onSearchChange={(v) => setColumnSearchTerms(prev => ({...prev, [colCampaign || '']: v}))}
                    />
                  </HeaderCell>

                  <HeaderCell 
                    label="UTM Term" 
                    id="term"
                    width="25%"
                    active={activeHeaderFilter === 'term'}
                    onClick={() => setActiveHeaderFilter(activeHeaderFilter === 'term' ? null : 'term')}
                    hasFilter={filters[colTerm || '']?.length > 0}
                  >
                    <HeaderFilterPopup 
                      col={colTerm || ''} 
                      options={uniqueValuesMap[colTerm || '']} 
                      filters={filters} 
                      toggleFilter={toggleFilter} 
                      searchTerm={columnSearchTerms[colTerm || ''] || ''}
                      onSearchChange={(v) => setColumnSearchTerms(prev => ({...prev, [colTerm || '']: v}))}
                    />
                  </HeaderCell>

                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-center w-24">Vendas</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest w-32">Faturamento</th>
                  <th className="px-4 py-4 font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/50 w-40">Invest. Total</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest w-32">CPA Médio</th>
                  <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-center w-28">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedData.map((group) => {
                  const revenue = group.totalRevenue;
                  const invest = groupInvestments[group.key] || 0;
                  const taxes = revenue * 0.06;
                  const profit = revenue - invest - taxes;
                  const roi = invest > 0 ? revenue / invest : 0;
                  const cpa = invest > 0 ? invest / group.salesCount : 0;
                  const isProfitable = profit > 0;
                  const dateList = Array.from(group.dates).sort();
                  const dateRange = dateList.length > 1 ? `${dateList[0]} > ${dateList[dateList.length - 1]}` : dateList[0];

                  return (
                    <tr key={group.key} className={`transition-colors ${invest > 0 ? (isProfitable ? 'bg-emerald-50/40 hover:bg-emerald-100/60' : 'bg-rose-50/40 hover:bg-rose-100/60') : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-4 font-bold text-slate-400 text-[9px] uppercase tracking-tighter align-top">{dateRange}</td>
                      <td className="px-4 py-4 font-bold text-slate-700 whitespace-normal break-words align-top">{group.product}</td>
                      <td className="px-4 py-4 font-medium text-slate-600 whitespace-normal break-all align-top leading-relaxed">{group.campaign}</td>
                      <td className="px-4 py-4 font-medium text-slate-500 whitespace-normal break-all align-top leading-relaxed">{group.term}</td>
                      <td className="px-4 py-4 font-black text-indigo-600 text-center text-lg tracking-tighter align-top">{group.salesCount}</td>
                      <td className="px-4 py-4 font-black text-slate-800 align-top">{formatBRL(revenue)}</td>
                      <td className="px-4 py-4 bg-indigo-50/10 align-top">
                        <div className="flex items-center bg-white border border-indigo-200 rounded-xl px-2 py-1.5 w-full shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                          <span className="text-slate-400 mr-1.5 font-black text-[10px]">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            className="bg-transparent border-none w-full text-[11px] font-black text-slate-900 outline-none p-0"
                            placeholder="0,00"
                            value={groupInvestments[group.key] === undefined ? '' : groupInvestments[group.key]}
                            onChange={(e) => {
                                const valStr = e.target.value;
                                const val = valStr === '' ? undefined : parseFloat(valStr);
                                setGroupInvestments(prev => ({...prev, [group.key]: val as any}));
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 font-black text-slate-600 align-top">{formatBRL(cpa)}</td>
                      <td className="px-4 py-4 text-center align-top">
                        <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase inline-block shadow-sm ${invest === 0 ? 'bg-slate-200 text-slate-500' : isProfitable ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                          {invest === 0 ? 'Pendente' : `${roi.toFixed(2)}x ROI`}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View: Análise Gráfica */}
      {viewMode === 'graphs' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 w-full">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap gap-6 items-center">
            <ChartControl label="Agrupar por:" val={chartCat} setVal={setChartCat} options={categoricalHeaders} />
            <ChartControl label="Métrica:" val={chartMet} setVal={setChartMet} options={metricHeaders} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8">Performance por {chartCat}</h4>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Bar dataKey="value" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
              <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-8">Volume Histórico</h4>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...chartData].reverse()}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={5} dot={{r: 6, fill: '#6366f1', strokeWidth: 3, stroke: '#fff'}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View: Base de Dados */}
      {viewMode === 'database' && (
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden w-full">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h4 className="font-black text-slate-800 tracking-tighter uppercase text-sm">Registro Completo ({filteredRows.length})</h4>
          </div>
          <div className="overflow-x-auto max-h-[750px] scrollbar-thin">
            <table className="w-full text-left text-[11px] border-collapse relative">
              <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
                <tr className="border-b border-slate-200">
                  {data.headers.map(h => (
                    <th key={h} className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row._id} className="hover:bg-indigo-50/30 transition-colors">
                    {data.headers.map(h => (
                      <td key={h} className="px-6 py-3 text-slate-600 font-bold whitespace-nowrap">
                        {typeof row[h] === 'number' && h.toLowerCase().match(/(valor|faturamento|gasto|lucro|imposto|spend|receita)/) ? formatBRL(row[h]) : row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Componentes Auxiliares
const HeaderCell = ({ label, children, active, onClick, hasFilter, width }: any) => {
  const ref = useRef<HTMLTableHeaderCellElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (active && ref.current && !ref.current.contains(e.target as Node)) {
        onClick();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [active, onClick]);

  return (
    <th ref={ref} className="px-4 py-4 relative group" style={{ width }}>
      <button 
        onClick={onClick}
        className={`flex items-center font-black uppercase tracking-widest transition-all hover:text-indigo-600 ${hasFilter ? 'text-indigo-600 scale-105' : 'text-slate-400'}`}
      >
        {label}
        {hasFilter ? <FilterIcon className="w-3 h-3 ml-1.5 fill-current" /> : <ChevronDown className="w-3 h-3 ml-1.5 opacity-40 group-hover:opacity-100" />}
      </button>
      {active && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 animate-in fade-in zoom-in duration-150 origin-top-left min-w-[300px]">
          {children}
        </div>
      )}
    </th>
  );
};

const HeaderFilterPopup = ({ col, options, filters, toggleFilter, searchTerm, onSearchChange }: any) => {
  const filtered = (options || []).filter((o: string) => String(o).toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="p-4 flex flex-col space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
        <input 
          type="text" 
          placeholder="Pesquisar na lista..." 
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-700"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="max-h-56 overflow-y-auto scrollbar-thin space-y-1 pr-1">
        {filtered.length > 0 ? filtered.map((val: string) => (
          <button
            key={val}
            onClick={(e) => { e.stopPropagation(); toggleFilter(col, val); }}
            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-[10px] font-bold text-left transition-all ${
              filters[col]?.includes(val) ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-100 text-slate-600'
            }`}
          >
            <span className="truncate flex-1">{val}</span>
            {filters[col]?.includes(val) && <CheckCircle2 className="w-3 h-3 ml-1.5" />}
          </button>
        )) : (
          <div className="text-[10px] font-bold text-slate-400 text-center py-4">Nenhum resultado</div>
        )}
      </div>
    </div>
  );
};

const FilterColumn = ({ col, uniqueValues, filters, toggleFilter, searchTerm, onSearchChange }: any) => (
  <div className="space-y-3 flex flex-col">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{col}</label>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
      <input
        type="text"
        placeholder={`Buscar em ${col.toLowerCase()}...`}
        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
    <div className="flex-1 max-h-52 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50 space-y-1 scrollbar-thin shadow-inner">
      {(uniqueValues || []).filter((o: any) => String(o).toLowerCase().includes(searchTerm.toLowerCase())).map((val: any) => (
        <button
          key={val}
          onClick={() => toggleFilter(col, val)}
          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-[10px] font-bold transition-all text-left ${
            filters[col]?.includes(val) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <span className="truncate flex-1">{val}</span>
          {filters[col]?.includes(val) && <CheckCircle2 className="w-3.5 h-3.5 ml-2 flex-shrink-0" />}
        </button>
      ))}
    </div>
  </div>
);

const StatCard = ({ title, value, icon, color, tag }: any) => {
  const styles = colorMap[color] || colorMap.indigo;
  return (
    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm relative group overflow-hidden">
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-1.5 ${styles.lightBg} ${styles.text} rounded-lg`}>{icon}</div>
          <span className={`text-[9px] font-black uppercase ${styles.lightBg} ${styles.text} px-2 py-0.5 rounded-full`}>{tag}</span>
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-xl font-black text-slate-800 tracking-tighter truncate">{value}</h3>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label, icon }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
      active ? 'bg-white text-indigo-600 shadow-md scale-105' : 'text-slate-500 hover:text-slate-800'
    }`}
  >
    {icon} {label}
  </button>
);

const ChartControl = ({ label, val, setVal, options }: any) => (
  <div className="flex items-center space-x-3">
    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <div className="relative">
      <select 
        value={val} 
        onChange={e => setVal(e.target.value)}
        className="appearance-none bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none pr-8 cursor-pointer shadow-sm"
      >
        {options.map((o: string) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
    </div>
  </div>
);

export default Dashboard;
