import { NextResponse } from 'next/server';
import { fetchFredSeries, nearestValue } from '@/lib/fred';
import { fetchSP500 } from '@/lib/market';
import { redis, DATA_KEY, UPDATED_KEY } from '@/lib/redis';
import type { DataPoint } from '@/types';

export const maxDuration = 60; // seconds — long fetch, needs extended timeout

export async function GET() {
  // Auth temporarily removed for initial seed — add back after data loads

  try {
    const endDate = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setFullYear(start.getFullYear() - 3);
    const startDate = start.toISOString().split('T')[0];

    console.log(`Seeding from ${startDate} to ${endDate}...`);

    // Fetch all FRED series in parallel
    const [walcl, wtregen, rrpDaily] = await Promise.all([
      fetchFredSeries('WALCL', startDate, endDate),       // Fed total assets (weekly)
      fetchFredSeries('WTREGEN', startDate, endDate),     // Treasury Gen. Account (weekly)
      fetchFredSeries('RRPONTSYD', startDate, endDate),   // Overnight RRP (daily)
    ]);

    // Fetch S&P 500 daily prices
    const sp500Daily = await fetchSP500(startDate, endDate);

    // Build lookup maps for fast access
    const tregenMap = new Map(wtregen.map(d => [d.date, d.value / 1000])); // WTREGEN is in millions on FRED, convert to billions
    const rrpMap    = new Map(rrpDaily.map(d => [d.date, d.value]));
    const sp500Map  = new Map(sp500Daily.map(d => [d.date, d.value]));

    // WALCL provides the canonical weekly dates (Wednesdays)
    // For each date, look up the other series (using nearest-day fallback)
    const dataPoints: DataPoint[] = [];

    for (const { date, value: fedAssetsRaw } of walcl) {
      const fedAssets = fedAssetsRaw / 1000; // WALCL is in millions on FRED, convert to billions
      const tga   = tregenMap.get(date)         ?? nearestValue(tregenMap, date);
      const rrp   = nearestValue(rrpMap, date);
      const sp500 = nearestValue(sp500Map, date);

      if (tga == null || rrp == null || sp500 == null) continue;

      dataPoints.push({
        date,
        fedAssets,
        tga,
        rrp,
        netLiquidity: fedAssets - tga - rrp,
        sp500,
      });
    }

    // Sort chronologically
    dataPoints.sort((a, b) => a.date.localeCompare(b.date));

    // Persist to Redis
    await redis.set(DATA_KEY, JSON.stringify(dataPoints));
    await redis.set(UPDATED_KEY, new Date().toISOString());

    return NextResponse.json({
      success: true,
      count: dataPoints.length,
      startDate: dataPoints[0]?.date,
      endDate: dataPoints[dataPoints.length - 1]?.date,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
