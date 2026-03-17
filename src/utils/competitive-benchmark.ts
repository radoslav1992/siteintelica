/**
 * Competitive Benchmark — compare a domain's scores against the aggregate
 * average of all domains in the database. Shows percentile ranking.
 */

import db from '../db/client';

export interface BenchmarkMetric {
  metric: string;
  value: number | string | null;
  average: number | string | null;
  percentile: number;
  verdict: 'above' | 'average' | 'below';
}

export interface CompetitiveBenchmark {
  domain: string;
  totalDomainsCompared: number;
  metrics: BenchmarkMetric[];
  overallPercentile: number;
  summary: string;
}

function percentileOf(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  return Math.round((below / sorted.length) * 100);
}

function verdict(percentile: number): BenchmarkMetric['verdict'] {
  if (percentile >= 60) return 'above';
  if (percentile >= 40) return 'average';
  return 'below';
}

export function generateBenchmark(domain: string, scanData: any): CompetitiveBenchmark {
  try {
    const rows = db.prepare(`
      SELECT scan_data FROM (
        SELECT scan_data, ROW_NUMBER() OVER (PARTITION BY domain ORDER BY scanned_at DESC) rn
        FROM scans WHERE domain != ?
      ) WHERE rn = 1 LIMIT 300
    `).all(domain) as { scan_data: string }[];

    const allPerf: number[] = [];
    const allSeo: number[] = [];
    const allA11y: number[] = [];
    const allSecurity: number[] = [];
    const allTechCount: number[] = [];

    rows.forEach(row => {
      try {
        const d = JSON.parse(row.scan_data);
        if (d.performance?.score != null) allPerf.push(d.performance.score);
        if (d.performance?.seo != null) allSeo.push(d.performance.seo);
        if (d.performance?.accessibility != null) allA11y.push(d.performance.accessibility);
        if (d.securityGrade?.score != null) allSecurity.push(d.securityGrade.score);
        if (d.technologies) allTechCount.push(d.technologies.length);
      } catch { }
    });

    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;

    const perfScore = scanData.performance?.score ?? null;
    const seoScore = scanData.performance?.seo ?? null;
    const a11yScore = scanData.performance?.accessibility ?? null;
    const secScore = scanData.securityGrade?.score ?? null;
    const techCount = scanData.technologies?.length ?? null;

    const metrics: BenchmarkMetric[] = [];

    if (perfScore !== null) {
      const pctl = percentileOf(perfScore, allPerf);
      metrics.push({ metric: 'Performance', value: perfScore, average: avg(allPerf), percentile: pctl, verdict: verdict(pctl) });
    }
    if (seoScore !== null) {
      const pctl = percentileOf(seoScore, allSeo);
      metrics.push({ metric: 'SEO', value: seoScore, average: avg(allSeo), percentile: pctl, verdict: verdict(pctl) });
    }
    if (a11yScore !== null) {
      const pctl = percentileOf(a11yScore, allA11y);
      metrics.push({ metric: 'Accessibility', value: a11yScore, average: avg(allA11y), percentile: pctl, verdict: verdict(pctl) });
    }
    if (secScore !== null) {
      const pctl = percentileOf(secScore, allSecurity);
      metrics.push({ metric: 'Security', value: secScore, average: avg(allSecurity), percentile: pctl, verdict: verdict(pctl) });
    }
    if (techCount !== null) {
      const pctl = percentileOf(techCount, allTechCount);
      metrics.push({ metric: 'Tech Stack Size', value: techCount, average: avg(allTechCount), percentile: pctl, verdict: verdict(pctl) });
    }

    const overallPercentile = metrics.length > 0
      ? Math.round(metrics.reduce((s, m) => s + m.percentile, 0) / metrics.length)
      : 50;

    let summary: string;
    if (overallPercentile >= 80) summary = `${domain} is in the top ${100 - overallPercentile}% of all scanned sites — outperforming the vast majority.`;
    else if (overallPercentile >= 60) summary = `${domain} is above average, performing better than ${overallPercentile}% of scanned sites.`;
    else if (overallPercentile >= 40) summary = `${domain} is near the average — on par with most sites but has clear room for improvement.`;
    else summary = `${domain} is below average — ranking lower than ${100 - overallPercentile}% of scanned sites. Prioritize the improvement actions above.`;

    return { domain, totalDomainsCompared: rows.length, metrics, overallPercentile, summary };
  } catch {
    return { domain, totalDomainsCompared: 0, metrics: [], overallPercentile: 50, summary: 'Not enough data for benchmarking.' };
  }
}
