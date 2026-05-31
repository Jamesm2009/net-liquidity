export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { NextResponse } from 'next/server';
import { fetchFredSeries, nearestValue } from '@/lib/fred';
import { fetchSP500 } from '@/lib/market';
import { redis, DATA_KEY, UPDATED_KEY } from '@/lib/redis';
import type { DataPoint } from '@/types';

export async function GET(request: Request) {
  // Vercel automatically sends CRON_SECRET in the Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await redis.get(DATA_KEY);
    const existing: DataPoint[] = raw
      ? (typeof raw === 'string' ? JSON.parse(raw) : (raw as DataPoint[]))
      : [];

    if (existing.length === 0) {
      return NextResponse.json(
        { error: 'No data. Visit /api/seed?secret=YOUR_SECRET first.' },
        { status: 400 }
      );
    }

    const lastDate = existing[existing.length - 1].date;
    // Start the day after the last stored date
    const startDt = new Date(lastDate);
    startDt.setDate(startDt.getDate() + 1);
    const startDate = startDt.toISOString().split('T')[0];
    const endDate   = new Date().toISOString().split('T')[0];

    if (startDate > endDate) {
      return NextResponse.json({ message: 'Already up to date', lastDate });
    }

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const walcl = await fetchFredSeries('WALCL', startDate, endDate);
    await delay(500);
    const wtregen = await fetchFredSeries('WTREGEN', startDate, endDate);
    await delay(500);
    const rrpDaily = await fetchFredSeries('RRPONTSYD', startDate, endDate);


    const sp500Daily = await fetchSP500(startDate, endDate);

    const tregenMap     = new Map(wtregen.map(d => [d.date, d.value]));
    const rrpMap        = new Map(rrpDaily.map(d => [d.date, d.value]));
    const sp500Map      = new Map(sp500Daily.map(d => [d.date, d.value]));
    const existingDates = new Set(existing.map(d => d.date));

    const newPoints: DataPoint[] = [];

    for (const { date, value: fedAssetsRaw } of walcl) {
      const fedAssets = fedAssetsRaw / 1000; // WALCL is in millions on FRED, convert to billions
      if (existingDates.has(date)) continue;

      const tga   = tregenMap.get(date)         ?? nearestValue(tregenMap, date);
      const rrp   = nearestValue(rrpMap, date);
      const sp500 = nearestValue(sp500Map, date);

      if (tga == null || rrp == null || sp500 == null) continue;

      newPoints.push({
        date,
        fedAssets,
        tga,
        rrp,
        netLiquidity: fedAssets - tga - rrp,
        sp500,
      });
    }

    if (newPoints.length > 0) {
      const merged = [...existing, ...newPoints].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      await redis.set(DATA_KEY, JSON.stringify(merged));
    }

    await redis.set(UPDATED_KEY, new Date().toISOString());

    return NextResponse.json({
      success: true,
      newPoints: newPoints.length,
      total: existing.length + newPoints.length,
    });
  } catch (error) {
    console.error('Update error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
