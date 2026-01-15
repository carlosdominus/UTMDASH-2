
import React, { useState } from 'react';
import { BrainCircuit, RefreshCw } from 'lucide-react';
import { DashboardData, DataRow } from './types';
import Dashboard from './components/Dashboard';
import { analyzeDataWithGemini } from './services/geminiService';

const Logo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-layers2-icon lucide-layers-2">
    <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/>
    <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/>
  </svg>
);

const App: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  const parseCSV = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return null;

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const cleanAndParse = (val: string) => {
      if (val === undefined || val === null || val.trim() === '') return '';
      
      let cleaned = val.trim().replace(/^"|"$/g, '');
      
      if (cleaned.includes('R$') || cleaned.includes('%') || /^-?[\d\.]+,[\d]+$/.test(cleaned)) {
        cleaned = cleaned
          .replace('R$', '')
          .replace('%', '')
          .replace(/\s/g, '');
        
        if (cleaned.includes(',') && cleaned.includes('.')) {
          cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        } else if (cleaned.includes(',')) {
          cleaned = cleaned.replace(',', '.');
        }
      }
      
      const num = Number(cleaned);
      return !isNaN(num) && cleaned !== '' ? num : cleaned;
    };

    const rows = lines.slice(1).map(line => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim());
      const row: DataRow = {};
      headers.forEach((header, index) => {
        row[header] = cleanAndParse(values[index] || '');
      });
      return row;
    });

    const types: Record<string, 'number' | 'string'> = {};
    headers.forEach(header => {
      const firstVal = rows.find(r => r[header] !== undefined && r[header] !== '' && typeof r[header] === 'number')?.[header];
      types[header] = typeof firstVal === 'number' ? 'number' : 'string';
    });

    return { headers, rows, types };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed) setData(parsed);
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const loadFromUrl = async () => {
    if (!sheetUrl) return;
    setLoading(true);
    try {
      let targetUrl = sheetUrl;
      if (sheetUrl.includes('/edit')) {
        targetUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv');
      }
      const response = await fetch(targetUrl);
      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      if (parsed) setData(parsed);
    } catch (error) {
      alert("Erro ao carregar link. Certifique-se de que a planilha está 'Publicada na Web' como CSV.");
    } finally {
      setLoading(false);
    }
  };

  const generateAIInsights = async () => {
    if (!data) return;
    setAnalyzing(true);
    const result = await analyzeDataWithGemini(data);
    setInsights(result);
    setAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[98%] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-indigo-200 shadow-lg text-white">
              <Logo />
            </div>
            <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase">utmdash</h1>
          </div>
          <div className="flex space-x-3">
            {data && (
              <button
                onClick={generateAIInsights}
                disabled={analyzing}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                <BrainCircuit className="w-4 h-4 mr-2" />
                {analyzing ? 'Analisando...' : 'Insights IA'}
              </button>
            )}
            <button onClick={() => { setData(null); setInsights(null); }} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[98%] mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {!data ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[40px] border border-slate-200 shadow-sm">
            <h2 className="text-3xl font-black mb-2 text-slate-800 tracking-tighter">utmdash & Perfect Pay</h2>
            <p className="text-slate-500 mb-10 max-w-sm text-center font-medium">Análise de ROI e Gestão de Tráfego nativa para relatórios Perfect Pay.</p>
            <div className="w-full max-w-md space-y-4">
              <input
                type="text"
                placeholder="Link CSV da Perfect Pay / Google Sheets"
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
              />
              <button
                onClick={loadFromUrl}
                disabled={loading || !sheetUrl}
                className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50"
              >
                {loading ? 'SINCRONIZANDO...' : 'CONECTAR VENDAS'}
              </button>
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest text-slate-400"><span className="px-2 bg-white">OU</span></div>
              </div>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-indigo-100 border-dashed rounded-2xl cursor-pointer bg-indigo-50/30 hover:bg-indigo-50 transition-all">
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Importar Arquivo .csv</span>
                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {insights && (
              <div className="bg-indigo-950 rounded-[32px] p-8 text-white shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 border border-white/10">
                <h3 className="text-xl font-black mb-4 flex items-center text-indigo-400"><BrainCircuit className="w-6 h-6 mr-2" /> ESTRATÉGIA IA</h3>
                <div className="prose prose-invert max-w-none text-indigo-100 font-medium whitespace-pre-line">{insights}</div>
              </div>
            )}
            <Dashboard data={data} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
