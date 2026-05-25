const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

export async function fetchFredSeries(
  seriesId: string,
  startDate: string,
  endDate: string
): Promise<{ date: string; value: number }[]> {
  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: process.env.FRED_API_KEY!,
    file_type: 'json',
    observation_start: startDate,
    observation_end: endDate,
  });

  const res = await fetch(`${FRED_BASE}?${params}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`FRED API error for ${seriesId}: ${res.status}`);

  const data = await res.json();

  return (data.observations ?? [])
    .filter((o: { value: string }) => o.value !== '.' && o.value !== 'NA')
    .map((o: { date: string; value: string }) => ({
      date: o.date,
      value: parseFloat(o.value),
    }));
}

/**
 * For a given target date, find the nearest value in a date→value map,
 * searching up to `maxDays` days backwards (for weekends / holidays).
 */
export function nearestValue(
  map: Map<string, number>,
  date: string,
  maxDays = 7
): number | null {
  if (map.has(date)) return map.get(date)!;
  for (let i = 1; i <= maxDays; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (map.has(key)) return map.get(key)!;
  }
  return null;
}
