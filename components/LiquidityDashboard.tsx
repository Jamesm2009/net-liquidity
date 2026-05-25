'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { DataPoint } from '@/types';

const YEARS_OPTIONS = [1, 2, 3] as const;

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function fmtDateFull(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


// Rolling Pearson correlation between Net Liquidity and S&P 500
function rollingCorrelation(data: DataPoint[], window: number): { date: string; correlation: number }[] {
  const results: { date: string; correlation: number }[] = [];
  for (let i = window - 1; i < data.length; i++) {
    const slice = data.slice(i - window + 1, i + 1);
    const n = slice.length;
    const xArr = slice.map(d => d.netLiquidity);
    const yArr = slice.map(d => d.sp500);
    const xMean = xArr.reduce((a, b) => a + b, 0) / n;
    const yMean = yArr.reduce((a, b) => a + b, 0) / n;
    const num = xArr.reduce((sum, x, j) => sum + (x - xMean) * (yArr[j] - yMean), 0);
    const den = Math.sqrt(
      xArr.reduce((s, x) => s + (x - xMean) ** 2, 0) *
      yArr.reduce((s, y) => s + (y - yMean) ** 2, 0)
    );
    results.push({ date: slice[slice.length - 1].date, correlation: den === 0 ? 0 : num / den });
  }
  return results;
}

function corrColor(r: number): string {
  if (r >= 0.5)  return '#22c55e';
  if (r >= 0.2)  return '#86efac';
  if (r >= -0.2) return '#f5a623';
  if (r >= -0.5) return '#f87171';
  return '#ef4444';
}

function corrLabel(r: number): string {
  if (r >= 0.5)  return 'Strong positive — liquidity & equities moving together';
  if (r >= 0.2)  return 'Moderate positive — broadly supportive';
  if (r >= -0.2) return 'Weak / decorrelated — other forces dominating';
  if (r >= -0.5) return 'Moderate inverse — divergence building';
  return 'Strong inverse — significant divergence';
}

interface CorrTooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function CorrTooltip({ active, payload, label }: CorrTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const r = payload[0].value;
  return (
    <div className="bg-[#0d1421] border border-[#1e2d42] rounded-lg p-3 shadow-2xl text-xs font-mono max-w-xs">
      <p className="text-[#cbd5e1] mb-1">{fmtDateFull(label)}</p>
      <p className="font-bold mb-1" style={{ color: corrColor(r) }}>
        r = {r.toFixed(2)}
      </p>
      <p className="text-[#cbd5e1] leading-relaxed">{corrLabel(r)}</p>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}

function MainTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-[#0d1421] border border-[#1e2d42] rounded-lg p-3 shadow-2xl text-xs font-mono">
      <p className="text-[#cbd5e1] mb-2">{fmtDateFull(label)}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-6 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-semibold">
            {p.name === 'S&P 500' ? fmt(p.value) : `$${fmt(p.value)}B`}
          </span>
        </div>
      ))}
    </div>
  );
}

function ComponentTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-[#0d1421] border border-[#1e2d42] rounded-lg p-3 shadow-2xl text-xs font-mono">
      <p className="text-[#cbd5e1] mb-2">{fmtDateFull(label)}</p>
      {payload.map(p => (
        <div key={p.name} className="flex justify-between gap-6 mb-1">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="text-white font-semibold">${fmt(p.value)}B</span>
        </div>
      ))}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  color: string;
}

function StatCard({ label, value, change, color }: StatCardProps) {
  return (
    <div className="bg-[#0d1421] border border-[#1e2d42] rounded-xl p-4">
      <p className="text-[#cbd5e1] text-xs font-mono uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white text-xl font-mono font-bold" style={{ color }}>
        {value}
      </p>
      {change !== undefined && (
        <p className={`text-xs font-mono mt-1 ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% vs 3 months ago
        </p>
      )}
    </div>
  );
}


interface GuideItem {
  signal: string;
  meaning: string;
  color: string;
}

const GUIDE_ITEMS: GuideItem[] = [
  {
    signal: 'Net Liquidity rising',
    meaning: 'More cash in the financial system. Historically supportive for equities — the S&P 500 tends to follow Net Liquidity higher with a short lag.',
    color: '#22c55e',
  },
  {
    signal: 'Net Liquidity falling',
    meaning: 'Cash being absorbed from the system. Has historically preceded equity weakness or consolidation, particularly when the decline is sustained.',
    color: '#ef4444',
  },
  {
    signal: 'Fed Assets declining',
    meaning: 'The Fed is doing Quantitative Tightening (QT) — shrinking its balance sheet by not reinvesting maturing bonds. This directly removes reserves from the banking system.',
    color: '#22c55e',
  },
  {
    signal: 'TGA rising',
    meaning: "The Treasury's cash balance at the Fed is growing — money is flowing out of the banking system into the government's account. Acts like a stealth tightening.",
    color: '#ef4444',
  },
  {
    signal: 'TGA falling',
    meaning: 'Government spending is injecting cash back into the system. A TGA drawdown is typically a short-term liquidity tailwind for markets.',
    color: '#22c55e',
  },
  {
    signal: 'RRP draining toward zero',
    meaning: "Money market funds pull cash from the Fed overnight facility back into markets. The 2023-24 RRP drain ($2.5T to near $0) was a major hidden tailwind for equities.",
    color: '#a855f7',
  },
];

const FORMULA_ITEMS = [
  { label: 'Fed Assets', sign: '+', desc: 'Total Fed balance sheet — adds reserves to the system', color: '#22c55e' },
  { label: 'TGA', sign: '−', desc: 'Treasury cash at the Fed — parked money, not in markets', color: '#ef4444' },
  { label: 'Reverse Repo', sign: '−', desc: 'Cash parked at Fed overnight by money markets', color: '#a855f7' },
];

function HowToReadThis() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6 border border-[#1e2d42] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#0d1421] transition-colors"
      >
        <span className="text-white font-mono text-sm font-semibold uppercase tracking-widest">
          How to Read This Dashboard
        </span>
        <span className="text-[#cbd5e1] font-mono text-lg leading-none">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-6 bg-[#0d1421] space-y-6">

          {/* The formula */}
          <div>
            <p className="text-[#cbd5e1] text-xs font-mono uppercase tracking-widest mb-3">The Formula</p>
            <div className="bg-[#060a12] rounded-xl p-4 font-mono text-sm">
              <p className="text-white mb-3">
                <span className="text-[#00d4ff] font-bold">Net Liquidity</span>
                <span className="text-[#cbd5e1]"> = </span>
                {FORMULA_ITEMS.map((item, i) => (
                  <span key={item.label}>
                    {i > 0 && <span className="text-[#cbd5e1] mx-2">{item.sign}</span>}
                    <span style={{ color: item.color }}>{item.label}</span>
                  </span>
                ))}
              </p>
              <div className="space-y-1 border-t border-[#1e2d42] pt-3">
                {FORMULA_ITEMS.map(item => (
                  <p key={item.label} className="text-xs text-[#cbd5e1]">
                    <span style={{ color: item.color }} className="font-semibold">{item.sign} {item.label}:</span>
                    {' '}{item.desc}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {/* Signal guide */}
          <div>
            <p className="text-[#cbd5e1] text-xs font-mono uppercase tracking-widest mb-3">Signal Guide</p>
            <div className="space-y-3">
              {GUIDE_ITEMS.map(item => (
                <div key={item.signal} className="flex gap-3">
                  <div
                    className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color, marginTop: '5px' }}
                  />
                  <div>
                    <p className="text-white text-xs font-mono font-semibold">{item.signal}</p>
                    <p className="text-[#cbd5e1] text-xs font-mono mt-0.5 leading-relaxed">{item.meaning}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Caveats */}
          <div className="bg-amber-900/10 border border-amber-800/30 rounded-xl p-4">
            <p className="text-amber-400 text-xs font-mono font-semibold mb-1">Important caveats</p>
            <p className="text-[#cbd5e1] text-xs font-mono leading-relaxed">
              Net Liquidity is a macro backdrop indicator, not a precise market timer. The correlation with equities is real (~0.6 historically) but imperfect — sentiment, earnings, and geopolitics all independently move markets. Use it as one lens among many, not as a standalone buy/sell signal.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}

export default function LiquidityDashboard() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [years, setYears] = useState<1 | 2 | 3>(3);
  const [showGuide, setShowGuide] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/data?years=${years}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json.data);
      setLastUpdated(json.lastUpdated);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [years]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const latest  = data[data.length - 1];
  const q3ago   = data[Math.max(0, data.length - 13)]; // ~13 weeks = 3 months
  const nlChange = latest && q3ago
    ? ((latest.netLiquidity - q3ago.netLiquidity) / Math.abs(q3ago.netLiquidity)) * 100
    : undefined;
  const spxChange = latest && q3ago
    ? ((latest.sp500 - q3ago.sp500) / q3ago.sp500) * 100
    : undefined;

  // Thin the data for performance — max 156 points is fine, no thinning needed
  const chartData = data;

  // Rolling 26-week (6-month) correlation between Net Liquidity and S&P 500
  const CORR_WINDOW = 26;
  const corrData = rollingCorrelation(data, CORR_WINDOW);
  const latestCorr = corrData[corrData.length - 1]?.correlation ?? null;

  return (
    <div className="min-h-screen bg-[#060a12] p-6 md:p-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-mono font-bold text-white tracking-tight">
              Fed Net Liquidity Monitor
            </h1>
            <p className="text-[#cbd5e1] text-sm font-mono mt-1">
              Net Liquidity = Fed Assets − Treasury General Account − Reverse Repo
            </p>
          </div>
          <div className="text-right">
            {lastUpdated && (
              <p className="text-[#cbd5e1] text-xs font-mono">
                Updated {new Date(lastUpdated).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </p>
            )}
            <div className="flex gap-2 mt-2 items-center">
              {YEARS_OPTIONS.map(y => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                    years === y
                      ? 'bg-[#00d4ff] text-[#060a12] font-bold'
                      : 'border border-[#1e2d42] text-[#cbd5e1] hover:border-[#00d4ff] hover:text-white'
                  }`}
                >
                  {y}Y
                </button>
              ))}
              <div className="w-px h-4 bg-[#1e2d42] mx-1" />
              <button
                onClick={() => setShowGuide(true)}
                className="px-3 py-1 rounded text-xs font-mono border border-[#1e2d42] text-[#cbd5e1] hover:border-[#00d4ff] hover:text-white transition-all"
              >
                ? How to Read
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* How to Read Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-10 overflow-y-auto">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowGuide(false)} />
          <div className="relative bg-[#0d1421] border border-[#1e2d42] rounded-2xl w-full max-w-2xl my-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e2d42]">
              <h2 className="text-white font-mono text-sm font-semibold uppercase tracking-widest">
                How to Read This Dashboard
              </h2>
              <button
                onClick={() => setShowGuide(false)}
                className="text-[#cbd5e1] hover:text-white font-mono text-xl leading-none transition-colors"
              >
                x
              </button>
            </div>
            <div className="px-6 py-5 space-y-6 max-h-[80vh] overflow-y-auto">

              {/* Formula */}
              <div>
                <p className="text-[#cbd5e1] text-xs font-mono uppercase tracking-widest mb-3">The Formula</p>
                <div className="bg-[#060a12] rounded-xl p-4 font-mono text-sm">
                  <p className="text-white mb-3">
                    <span className="text-[#00d4ff] font-bold">Net Liquidity</span>
                    <span className="text-[#cbd5e1]"> = </span>
                    {FORMULA_ITEMS.map((item, i) => (
                      <span key={item.label}>
                        {i > 0 && <span className="text-[#cbd5e1] mx-2">{item.sign}</span>}
                        <span style={{ color: item.color }}>{item.label}</span>
                      </span>
                    ))}
                  </p>
                  <div className="space-y-1 border-t border-[#1e2d42] pt-3">
                    {FORMULA_ITEMS.map(item => (
                      <p key={item.label} className="text-xs text-[#cbd5e1]">
                        <span style={{ color: item.color }} className="font-semibold">{item.sign} {item.label}:</span>
                        {" "}{item.desc}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Signal Guide */}
              <div>
                <p className="text-[#cbd5e1] text-xs font-mono uppercase tracking-widest mb-3">Signal Guide</p>
                <div className="space-y-3">
                  {GUIDE_ITEMS.map(item => (
                    <div key={item.signal} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: item.color }} />
                      <div>
                        <p className="text-white text-xs font-mono font-semibold">{item.signal}</p>
                        <p className="text-[#cbd5e1] text-xs font-mono mt-0.5 leading-relaxed">{item.meaning}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Caveats */}
              <div className="bg-amber-900/10 border border-amber-800/30 rounded-xl p-4">
                <p className="text-amber-400 text-xs font-mono font-semibold mb-1">Important caveats</p>
                <p className="text-[#cbd5e1] text-xs font-mono leading-relaxed">
                  Net Liquidity is a macro backdrop indicator, not a precise market timer. The correlation with equities is real but imperfect — sentiment, earnings, and geopolitics all independently move markets. Use it as one lens among many, not as a standalone buy/sell signal.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-96 text-[#cbd5e1] font-mono text-sm">
          <span className="animate-pulse">Loading market data...</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-900/20 border border-rose-800 rounded-xl p-6 text-center font-mono">
          <p className="text-rose-400 text-sm">{error}</p>
          <p className="text-[#cbd5e1] text-xs mt-2">
            Make sure you have run <code className="text-amber-400">/api/seed</code> to load initial data.
          </p>
        </div>
      )}

      {!loading && !error && latest && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              label="Net Liquidity"
              value={`$${fmt(latest.netLiquidity)}B`}
              change={nlChange}
              color="#00d4ff"
            />
            <StatCard
              label="S&P 500"
              value={fmt(latest.sp500)}
              change={spxChange}
              color="#f5a623"
            />
            <StatCard
              label="Fed Assets"
              value={`$${fmt(latest.fedAssets)}B`}
              color="#22c55e"
            />
            <StatCard
              label="Overnight RRP"
              value={`$${fmt(latest.rrp)}B`}
              color="#a855f7"
            />
            {latestCorr !== null && (
              <div className="bg-[#0d1421] border border-[#1e2d42] rounded-xl p-4">
                <p className="text-[#cbd5e1] text-xs font-mono uppercase tracking-widest mb-1">26W Correlation</p>
                <p className="text-xl font-mono font-bold" style={{ color: corrColor(latestCorr) }}>
                  r = {latestCorr.toFixed(2)}
                </p>
                <p className="text-xs font-mono mt-1 leading-tight" style={{ color: corrColor(latestCorr) }}>
                  {corrLabel(latestCorr)}
                </p>
              </div>
            )}
          </div>

          {/* Main Chart — Net Liquidity vs S&P 500 */}
          <div className="bg-[#0d1421] border border-[#1e2d42] rounded-2xl p-5 mb-6">
            <h2 className="text-white font-mono text-sm font-semibold mb-4 uppercase tracking-widest">
              Net Liquidity vs S&P 500
            </h2>
            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="nlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e2d42' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="nl"
                  orientation="left"
                  tickFormatter={v => `$${fmt(v)}B`}
                  tick={{ fill: '#00d4ff', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="spx"
                  orientation="right"
                  tickFormatter={v => fmt(v)}
                  tick={{ fill: '#f5a623', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={65}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<MainTooltip />} />
                <Legend
                  wrapperStyle={{ fontFamily: 'monospace', fontSize: 12, paddingTop: 16 }}
                  formatter={(value) => (
                    <span style={{ color: value === 'Net Liquidity' ? '#00d4ff' : '#f5a623' }}>
                      {value}
                    </span>
                  )}
                />
                <Area
                  yAxisId="nl"
                  type="monotone"
                  dataKey="netLiquidity"
                  name="Net Liquidity"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  fill="url(#nlGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#00d4ff' }}
                />
                <Line
                  yAxisId="spx"
                  type="monotone"
                  dataKey="sp500"
                  name="S&P 500"
                  stroke="#f5a623"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f5a623' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Component Chart — Fed Assets, TGA, RRP */}
          <div className="bg-[#0d1421] border border-[#1e2d42] rounded-2xl p-5">
            <h2 className="text-white font-mono text-sm font-semibold mb-1 uppercase tracking-widest">
              Liquidity Components
            </h2>
            <p className="text-[#cbd5e1] text-xs font-mono mb-4">
              Fed Assets (adds liquidity) · TGA & RRP (drain liquidity)
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e2d42' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="assets"
                  orientation="left"
                  tickFormatter={v => `$${fmt(v)}B`}
                  tick={{ fill: '#22c55e', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                  domain={['auto', 'auto']}
                />
                <YAxis
                  yAxisId="drains"
                  orientation="right"
                  tickFormatter={v => `$${fmt(v)}B`}
                  tick={{ fill: '#cbd5e1', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<ComponentTooltip />} />
                <Legend
                  wrapperStyle={{ fontFamily: 'monospace', fontSize: 12, paddingTop: 16 }}
                  formatter={(value) => {
                    const colors: Record<string, string> = {
                      'Fed Assets': '#22c55e',
                      'TGA': '#ef4444',
                      'Reverse Repo': '#a855f7',
                    };
                    return <span style={{ color: colors[value] ?? '#fff' }}>{value}</span>;
                  }}
                />
                <Line
                  yAxisId="assets"
                  type="monotone"
                  dataKey="fedAssets"
                  name="Fed Assets"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="drains"
                  type="monotone"
                  dataKey="tga"
                  name="TGA"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="drains"
                  type="monotone"
                  dataKey="rrp"
                  name="Reverse Repo"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>


          {/* Rolling Correlation Chart */}
          <div className="bg-[#0d1421] border border-[#1e2d42] rounded-2xl p-5 mt-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-white font-mono text-sm font-semibold uppercase tracking-widest">
                26-Week Rolling Correlation
              </h2>
              {latestCorr !== null && (
                <span className="text-xs font-mono font-bold px-2 py-1 rounded" style={{ color: corrColor(latestCorr), border: `1px solid ${corrColor(latestCorr)}40`, background: `${corrColor(latestCorr)}10` }}>
                  Current: r = {latestCorr.toFixed(2)}
                </span>
              )}
            </div>
            <p className="text-[#cbd5e1] text-xs font-mono mb-4">
              Pearson r between Net Liquidity and S&P 500 over trailing 26 weeks. Ranges from -1 (perfect inverse) to +1 (perfect alignment).
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={corrData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="corrGradientPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="corrGradientNeg" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fill: '#cbd5e1', fontSize: 11, fontFamily: 'monospace' }}
                  axisLine={{ stroke: '#1e2d42' }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[-1, 1]}
                  ticks={[-1, -0.5, 0, 0.5, 1]}
                  tickFormatter={v => v.toFixed(1)}
                  tick={{ fill: '#cbd5e1', fontSize: 10, fontFamily: 'monospace' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip content={<CorrTooltip />} />
                <ReferenceLine y={0}    stroke="#334155" strokeWidth={1.5} />
                <ReferenceLine y={0.5}  stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.3} />
                <ReferenceLine y={-0.5} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.3} />
                <Area
                  type="monotone"
                  dataKey="correlation"
                  stroke="none"
                  fill="url(#corrGradientPos)"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="correlation"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#00d4ff' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-4 mt-3">
              {[
                { label: 'Strong positive (>0.5)', color: '#22c55e' },
                { label: 'Moderate (0.2-0.5)', color: '#86efac' },
                { label: 'Decorrelated', color: '#f5a623' },
                { label: 'Moderate inverse', color: '#f87171' },
                { label: 'Strong inverse (<-0.5)', color: '#ef4444' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[#cbd5e1] text-xs font-mono">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-[#64748b] text-xs font-mono mt-6">
            Sources: Federal Reserve (FRED) · Yahoo Finance · Updated weekly (Wed) with WALCL release
          </p>
        </>
      )}
    </div>
  );
}
