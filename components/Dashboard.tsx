
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Filter as FilterIcon, Table as TableIcon, LayoutDashboard, Search, X, ChevronDown, DollarSign, TrendingUp, Receipt, Wallet, Target, CheckCircle2, Calendar, LayoutGrid, BarChart3, List, Layers, ShoppingBag, PieChart as PieChartIcon } from 'lucide-react';
import { DashboardData } from '../types';

interface DashboardProps {
  data: DashboardData;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

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
  
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

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
      const prod = String(row[colProduto || ''] || 'Sem Produto');
      const camp = String(row[colCampaign || ''] || 'Orgânico');
      const term = String(row[colTerm || ''] || 'N/A');
      const key = `${prod}|${camp}|${term}`;

      if (!groups[key]) {
        groups[key] = { prod, camp, term, sales: 0, revenue: 0 };
      }
      groups[key].sales += 1;
      groups[key].revenue += Number(row[colFaturamento || '']) || 0;
    });
    return Object.values(groups).sort((a: any, b: any) => b.revenue - a.revenue);
  }, [filteredRows, colProduto, colCampaign, colTerm, colFaturamento]);

  // Dados para Gráficos
  const volumeStats = useMemo(() => {
    const today = new Date().toDateString();
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(new Date().getDate() - 7);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(new Date().getDate() - 30);

    let t = 0, s = 0, m = 0;
    data.rows.forEach(r => {
      const d = parseBrazilianDate(r[colData || '']);
      if (!d) return;
      if (d.toDateString() === today) t++;
      if (d >= sevenDaysAgo) s++;
      if (d >= thirtyDaysAgo) m++;
    });
    return { t, s, m };
  }, [data.rows, colData]);

  const salesByDay = useMemo(() => {
    const daily: Record<string, number> = {};
    filteredRows.forEach(row => {
      const d = parseBrazilianDate(row[colData || '']);
      if (d) {
        const key = d.toISOString().split('T')[0];
        daily[key] = (daily[key] || 0) + 1;
      }
    });
    return Object.entries(daily).map(([date, sales]) => ({ 
      date: date.split('-').reverse().slice(0, 2).join('/'),
      sales,
      full: date 
    })).sort((a, b) => a.full.localeCompare(b.full));
  }, [filteredRows, colData]);

  const getPieData = (col: string | undefined) => {
    if (!col) return [];
    const counts: Record<string, number> = {};
    filteredRows.forEach(row => {
      const val = String(row[col] || 'N/A').trim();
      counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Apenas TOP 5 para evitar bugs visuais
  };

  const formatBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const stats = useMemo(() => {
    let fat = 0;
    filteredRows.forEach(row => fat += Number(row[colFaturamento || '']) || 0);
    const imp = fat * 0.06;
    const gas = manualInvestment;
    const luc = fat - gas - imp;
    const roas = gas > 0 ? fat / gas : 0;
    return { fat, gas, imp, luc, roas };
  }, [filteredRows, colFaturamento, manualInvestment]);

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-slate-200/50 p-1.5 rounded-2xl w-full flex flex-wrap lg:flex-nowrap gap-2 sticky top-20 z-40 backdrop-blur-md shadow-sm border border-slate-200">
        <TabButton active={viewMode === 'central'} onClick={() => setViewMode('central')} label="Análise Central" icon={<LayoutGrid className="w-4 h-4" />} />
        <TabButton active={viewMode === 'utmdash'} onClick={() => setViewMode('utmdash')} label="UTM DASH" icon={<Layers className="w-4 h-4" />} />
        <TabButton active={viewMode === 'graphs'} onClick={() => setViewMode('graphs')} label="Análise Gráfica" icon={<BarChart3 className="w-4 h-4" />} />
        <TabButton active={viewMode === 'database'} onClick={() => setViewMode('database')} label="Base de Dados" icon={<List className="w-4 h-4" />} />
      </div>

      {viewMode === 'central' && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard title="Faturamento" value={formatBRL(stats.fat)} icon={<TrendingUp className="w-4 h-4" />} color="emerald" tag="Vendas" />
            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between mb-3">
                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg"><Wallet className="w-4 h-4" /></div>
                <span className="text-[9px] font-black uppercase bg-rose-50 text-rose-500 px-2 py-0.5 rounded-full">Manual</span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Investido Geral</p>
              <div className="flex items-center">
                <span className="text-xl font-black text-slate-800 tracking-tighter mr-1">R$</span>
                <input type="number" value={manualInvestment || ''} onChange={(e) => setManualInvestment(Number(e.target.value))} className="w-full bg-transparent border-none outline-none text-xl font-black text-slate-800 tracking-tighter focus:ring-0 p-0" placeholder="0,00" />
              </div>
            </div>
            <StatCard title="Impostos" value={formatBRL(stats.imp)} icon={<Receipt className="w-4 h-4" />} color="amber" tag="6%" />
            <StatCard title="ROAS" value={`${stats.roas.toFixed(2)}x`} icon={<Target className="w-4 h-4" />} color="indigo" tag="ROI" />
            <div className="bg-indigo-600 p-5 rounded-[28px] shadow-xl text-white relative overflow-hidden group">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200 mb-1">Lucro Estimado</p>
              <h3 className="text-2xl font-black tracking-tighter">{formatBRL(stats.luc)}</h3>
              <p className="text-[11px] font-bold text-indigo-100 mt-2">Margem: {stats.fat > 0 ? ((stats.luc/stats.fat)*100).toFixed(1) : 0}%</p>
              <DollarSign className="absolute -bottom-2 -right-2 w-16 h-16 text-white opacity-10" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><FilterIcon className="w-5 h-5" /></div>
                <h4 className="text-lg font-black text-slate-800 tracking-tighter uppercase">Filtros Avançados</h4>
              </div>
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Pesquisa rápida..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoricalFilterCols.map(col => (
                <FilterColumn key={col} col={col} uniqueValues={uniqueValuesMap[col]} filters={filters} toggleFilter={toggleFilter} searchTerm={columnSearchTerms[col] || ''} onSearchChange={(val: any) => setColumnSearchTerms(prev => ({ ...prev, [col]: val }))} />
              ))}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'utmdash' && (
        <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
          <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
            <div>
              <h4 className="font-black text-slate-800 tracking-tighter uppercase text-sm flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4 text-indigo-600" />
                Performance por UTM
              </h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Dados Agrupados (Produto + Campanha + Termo)</p>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 z-30 bg-white shadow-sm">
                <tr className="border-b border-slate-200">
                  <th className="px-8 py-5 font-black text-slate-400 uppercase tracking-widest">Produto / Campanha</th>
                  <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-center">Vendas</th>
                  <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest">Faturamento</th>
                  <th className="px-6 py-5 font-black text-indigo-600 uppercase tracking-widest bg-indigo-50/50">Invest.</th>
                  <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-center">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedData.map((group, idx) => {
                  const gas = groupInvestments[`${group.prod}|${group.camp}|${group.term}`] || 0;
                  const roi = gas > 0 ? group.revenue / gas : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="font-black text-slate-800 text-[12px] tracking-tight truncate max-w-[300px]">{group.prod}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[250px]">{group.camp} <span className="text-slate-300 mx-1">/</span> {group.term}</div>
                      </td>
                      <td className="px-6 py-5 text-center font-black text-slate-600">{group.sales}</td>
                      <td className="px-6 py-5 font-black text-slate-800">{formatBRL(group.revenue)}</td>
                      <td className="px-6 py-5 bg-indigo-50/30">
                        <div className="flex items-center space-x-1 border-b border-indigo-200 pb-0.5 group-hover:border-indigo-400 transition-all">
                          <span className="text-[10px] font-black text-indigo-400">R$</span>
                          <input
                            type="number"
                            className="bg-transparent border-none outline-none p-0 text-[11px] font-black text-indigo-700 w-20 focus:ring-0"
                            placeholder="0,00"
                            value={gas || ''}
                            onChange={(e) => setGroupInvestments(prev => ({...prev, [`${group.prod}|${group.camp}|${group.term}`]: Number(e.target.value)}))}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black ${roi >= 2 ? 'bg-emerald-100 text-emerald-700' : roi > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'}`}>
                          {roi.toFixed(2)}x
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'graphs' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GraphStatCard title="Hoje" value={volumeStats.t} color="indigo" />
            <GraphStatCard title="7 Dias" value={volumeStats.s} color="emerald" />
            <GraphStatCard title="30 Dias" value={volumeStats.m} color="amber" />
          </div>

          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> Evolução de Vendas
            </h4>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesByDay}>
                  <defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                  <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px'}} />
                  <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" dot={{r: 4, fill: '#6366f1'}} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <PieContainer title="Campanhas (TOP 5)" icon={<Target className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={getPieData(colCampaign)} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {getPieData(colCampaign).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'bold'}} />
                </PieChart>
              </ResponsiveContainer>
            </PieContainer>
            <PieContainer title="Termos (TOP 5)" icon={<Layers className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={getPieData(colTerm)} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {getPieData(colTerm).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'bold'}} />
                </PieChart>
              </ResponsiveContainer>
            </PieContainer>
            <PieContainer title="Produtos (TOP 5)" icon={<ShoppingBag className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={getPieData(colProduto)} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {getPieData(colProduto).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '10px', fontWeight: 'bold'}} />
                </PieChart>
              </ResponsiveContainer>
            </PieContainer>
          </div>
        </div>
      )}

      {viewMode === 'database' && (
        <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
          <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
             <h4 className="font-black text-slate-800 tracking-tighter uppercase text-sm">Registros Encontrados ({filteredRows.length})</h4>
          </div>
          <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
            <table className="w-full text-left text-[11px] border-collapse relative">
              <thead className="sticky top-0 z-20 bg-slate-50">
                <tr className="border-b border-slate-200">
                  {data.headers.map(h => (
                    <th key={h} className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr key={row._id} className="hover:bg-indigo-50/20 transition-colors">
                    {data.headers.map(h => (
                      <td key={h} className="px-6 py-3 text-slate-600 font-bold whitespace-nowrap">
                        {typeof row[h] === 'number' && h.toLowerCase().match(/(valor|faturamento|venda|spend)/) ? formatBRL(row[h]) : row[h]}
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

const PieContainer = ({ title, children, icon }: any) => (
  <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col h-[350px]">
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg">{icon}</div>
      <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{title}</h5>
    </div>
    <div className="flex-1 w-full overflow-hidden">
      {children}
    </div>
  </div>
);

const GraphStatCard = ({ title, value, color }: any) => (
  <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between">
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <h3 className={`text-3xl font-black tracking-tighter ${color === 'indigo' ? 'text-indigo-600' : color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`}>{value}</h3>
    </div>
    <div className={`p-3 rounded-2xl ${color === 'indigo' ? 'bg-indigo-50 text-indigo-600' : color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
       <Calendar className="w-6 h-6" />
    </div>
  </div>
);

const StatCard = ({ title, value, icon, color, tag }: any) => {
  const styles = colorMap[color] || colorMap.indigo;
  return (
    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm relative overflow-hidden group">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-1.5 ${styles.lightBg} ${styles.text} rounded-lg`}>{icon}</div>
        <span className={`text-[9px] font-black uppercase ${styles.lightBg} ${styles.text} px-2 py-0.5 rounded-full`}>{tag}</span>
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <h3 className="text-xl font-black text-slate-800 tracking-tighter truncate">{value}</h3>
    </div>
  );
};

const FilterColumn = ({ col, uniqueValues, filters, toggleFilter, searchTerm, onSearchChange }: any) => (
  <div className="space-y-3 flex flex-col">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{col}</label>
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
      <input type="text" placeholder={`Filtrar...`} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} />
    </div>
    <div className="max-h-44 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50 space-y-1 scrollbar-thin">
      {(uniqueValues || []).filter((o: any) => String(o).toLowerCase().includes(searchTerm.toLowerCase())).map((val: any) => (
        <button key={val} onClick={() => toggleFilter(col, val)} className={`w-full flex items-center justify-between p-2.5 rounded-xl text-[10px] font-bold transition-all text-left ${filters[col]?.includes(val) ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>
          <span className="truncate flex-1">{val}</span>
          {filters[col]?.includes(val) && <CheckCircle2 className="w-3.5 h-3.5 ml-2" />}
        </button>
      ))}
    </div>
  </div>
);

const TabButton = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} className={`flex items-center px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${active ? 'bg-white text-indigo-600 shadow-md scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}>
    <span className="mr-2">{icon}</span> {label}
  </button>
);

export default Dashboard;
