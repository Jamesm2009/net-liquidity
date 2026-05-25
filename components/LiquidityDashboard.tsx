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

interface CustomTooltipProps {
  active?: boolean;
  payload?: { color: string; name: string; value: number }[];
  label?: string;
}

function MainTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-[#0d1421] border border-[#1e2d42] rounded-lg p-3 shadow-2xl text-xs font-mono">
      <p className="text-[#64748b] mb-2">{fmtDateFull(label)}</p>
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
      <p className="text-[#64748b] mb-2">{fmtDateFull(label)}</p>
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
      <p className="text-[#64748b] text-xs font-mono uppercase tracking-widest mb-1">{label}</p>
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

export default function LiquidityDashboard() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [years, setYears] = useState<1 | 2 | 3>(3);
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

  return (
    <div className="min-h-screen bg-[#060a12] p-6 md:p-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-mono font-bold text-white tracking-tight">
              Fed Net Liquidity Monitor
            </h1>
            <p className="text-[#64748b] text-sm font-mono mt-1">
              Net Liquidity = Fed Assets − Treasury General Account − Reverse Repo
            </p>
          </div>
          <div className="text-right">
            {lastUpdated && (
              <p className="text-[#64748b] text-xs font-mono">
                Updated {new Date(lastUpdated).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </p>
            )}
            <div className="flex gap-2 mt-2">
              {YEARS_OPTIONS.map(y => (
                <button
                  key={y}
                  onClick={() => setYears(y)}
                  className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                    years === y
                      ? 'bg-[#00d4ff] text-[#060a12] font-bold'
                      : 'border border-[#1e2d42] text-[#64748b] hover:border-[#00d4ff] hover:text-white'
                  }`}
                >
                  {y}Y
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-96 text-[#64748b] font-mono text-sm">
          <span className="animate-pulse">Loading market data...</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-900/20 border border-rose-800 rounded-xl p-6 text-center font-mono">
          <p className="text-rose-400 text-sm">{error}</p>
          <p className="text-[#64748b] text-xs mt-2">
            Make sure you have run <code className="text-amber-400">/api/seed</code> to load initial data.
          </p>
        </div>
      )}

      {!loading && !error && latest && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
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
            <p className="text-[#64748b] text-xs font-mono mb-4">
              Fed Assets (adds liquidity) · TGA & RRP (drain liquidity)
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="#1e2d42" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fill: '#64748b', fontSize: 11, fontFamily: 'monospace' }}
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
                  tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
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

          {/* Footer */}
          <p className="text-center text-[#2d3f55] text-xs font-mono mt-6">
            Sources: Federal Reserve (FRED) · Yahoo Finance · Updated weekly (Wed) with WALCL release
          </p>
        </>
      )}
    </div>
  );
}
