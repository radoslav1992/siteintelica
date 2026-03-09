/**
 * Chrome UX Report (CrUX) API client.
 * Returns real-user field metrics (LCP, CLS, INP, FCP, TTFB) for origins that
 * appear in the CrUX dataset (~10M+ origins with enough traffic).
 */

const CRUX_API_BASE = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';
const FETCH_TIMEOUT = 6000;

export interface CruxMetric {
  p75: number;
  good: number;
  needsImprovement: number;
  poor: number;
  unit: string;
}

export interface CruxData {
  found: boolean;
  origin: string;
  formFactor: string;
  collectionPeriod?: { firstDate: string; lastDate: string };
  metrics: {
    lcp?: CruxMetric;
    cls?: CruxMetric;
    inp?: CruxMetric;
    fcp?: CruxMetric;
    ttfb?: CruxMetric;
  };
}

function parseMetric(metric: any, unit: string): CruxMetric | undefined {
  if (!metric?.percentiles?.p75 || !metric?.histogram) return undefined;
  const bins = metric.histogram;
  const total = bins.reduce((s: number, b: any) => s + (b.density || 0), 0);
  return {
    p75: metric.percentiles.p75,
    good: total > 0 ? Math.round(((bins[0]?.density || 0) / total) * 100) : 0,
    needsImprovement: total > 0 ? Math.round(((bins[1]?.density || 0) / total) * 100) : 0,
    poor: total > 0 ? Math.round(((bins[2]?.density || 0) / total) * 100) : 0,
    unit,
  };
}

export async function fetchCruxData(origin: string, apiKey?: string): Promise<CruxData> {
  const key = apiKey || process.env.CRUX_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) return { found: false, origin, formFactor: 'ALL_FORM_FACTORS', metrics: {} };

  try {
    const res = await fetch(`${CRUX_API_BASE}?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: origin.startsWith('http') ? origin : `https://${origin}`,
        formFactor: 'ALL_FORM_FACTORS',
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) return { found: false, origin, formFactor: 'ALL_FORM_FACTORS', metrics: {} };

    const data = await res.json();
    const record = data.record;
    if (!record?.metrics) return { found: false, origin, formFactor: 'ALL_FORM_FACTORS', metrics: {} };

    const m = record.metrics;
    const period = record.collectionPeriod;

    return {
      found: true,
      origin,
      formFactor: record.key?.formFactor || 'ALL_FORM_FACTORS',
      collectionPeriod: period ? {
        firstDate: `${period.firstDate.year}-${String(period.firstDate.month).padStart(2, '0')}-${String(period.firstDate.day).padStart(2, '0')}`,
        lastDate: `${period.lastDate.year}-${String(period.lastDate.month).padStart(2, '0')}-${String(period.lastDate.day).padStart(2, '0')}`,
      } : undefined,
      metrics: {
        lcp: parseMetric(m.largest_contentful_paint, 'ms'),
        cls: parseMetric(m.cumulative_layout_shift, ''),
        inp: parseMetric(m.interaction_to_next_paint, 'ms'),
        fcp: parseMetric(m.first_contentful_paint, 'ms'),
        ttfb: parseMetric(m.experimental_time_to_first_byte, 'ms'),
      },
    };
  } catch {
    return { found: false, origin, formFactor: 'ALL_FORM_FACTORS', metrics: {} };
  }
}

/**
 * If CrUX has data for a domain, that domain has meaningful real-world traffic.
 * The CrUX dataset only includes origins with sufficient traffic volume.
 */
export function cruxTrafficTier(crux: CruxData): 'high' | 'medium' | 'none' {
  if (!crux.found) return 'none';
  const lcp = crux.metrics.lcp;
  if (!lcp) return 'medium';
  return lcp.good >= 60 ? 'high' : 'medium';
}
