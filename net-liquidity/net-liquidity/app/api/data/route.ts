import { NextResponse } from 'next/server';
import { redis, DATA_KEY, UPDATED_KEY } from '@/lib/redis';
import type { DataPoint } from '@/types';

export const revalidate = 3600; // cache for 1 hour

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const years = Math.min(parseInt(searchParams.get('years') ?? '3'), 3);

  const [raw, lastUpdated] = await Promise.all([
    redis.get(DATA_KEY),
    redis.get(UPDATED_KEY),
  ]);

  if (!raw) {
    return NextResponse.json({ error: 'No data found. Run /api/seed first.' }, { status: 404 });
  }

  const data: DataPoint[] = typeof raw === 'string' ? JSON.parse(raw) : (raw as DataPoint[]);

  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const filtered = data.filter(d => d.date >= cutoffStr);

  return NextResponse.json({
    data: filtered,
    lastUpdated,
    count: filtered.length,
  });
}
