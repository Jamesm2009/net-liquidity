export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { fetchFredSeries, nearestValue } from '@/lib/fred';
import { fetchSP500 } from '@/lib/market';
import { redis, DATA_KEY, UPDATED_KEY } from '@/lib/redis';
import type { DataPoint } from '@/types';

export const maxDuration = 60;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET() {
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setFullYear(start.getFullYear() - 3);
    const startDate = start.toISOString().split('T')[0];

    console.log(`Seeding from ${startDate} to ${endDate}...`);

    const walcl = await fetchFredSeries('WALCL', startDate, endDate);
    await delay(3000);
    const wtregen = await fetchFredSeries('WTREGEN', startDate, endDate);
    await delay(3000);
    const rrpDaily = await fetchFredSeries('RRPONTSYD', startDate, endDate);
    await delay(3000);
    const sp500Daily = await fetchSP500(startDate, endDate);

    const tregenMap = new Map(wtregen.map(d => [d.date, d.value / 1000]));
    const rrpMap    = new Map(rrpDaily.map(d => [d.date, d.value]));
    const sp500Map  = new Map(sp500Daily.map(d => [d.date, d.value]));

    const dataPoints: DataPoint[] = [];

    for (const { date, value: fedAssetsRaw } of walcl) {
      const fedAssets = fedAssetsRaw / 1000;
      const tga   = tregenMap.get(date) ?? nearestValue(tregenMap, date);
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

    dataPoints.sort((a, b) => a.date.localeCompare(b.date));

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
