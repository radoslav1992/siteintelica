import type { APIRoute } from 'astro';
import { getDomainHistory } from '../../../db/client';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const domain = context.params.domain;
  if (!domain) {
    return new Response(JSON.stringify({ error: 'Domain parameter required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const scans = getDomainHistory(domain, 50);

  const timeline = scans.map(scan => {
    try {
      const data = JSON.parse(scan.scan_data);
      const techs: string[] = (data.technologies || []).map((t: any) => t.name);
      return {
        id: scan.id,
        scannedAt: scan.scanned_at,
        techCount: techs.length,
        technologies: techs,
        performanceScore: data.performance?.score ?? null,
        seoScore: data.performance?.seo ?? null,
        accessibilityScore: data.performance?.accessibility ?? null,
        securityGrade: data.securityGrade?.grade ?? null,
        securityScore: data.securityGrade?.score ?? null,
      };
    } catch {
      return { id: scan.id, scannedAt: scan.scanned_at, techCount: 0, technologies: [], performanceScore: null, seoScore: null, accessibilityScore: null, securityGrade: null, securityScore: null };
    }
  });

  // Compute tech stack diffs between consecutive scans
  const diffs: { date: string; added: string[]; removed: string[] }[] = [];
  for (let i = 0; i < timeline.length - 1; i++) {
    const current = new Set(timeline[i].technologies);
    const previous = new Set(timeline[i + 1].technologies);
    const added = timeline[i].technologies.filter(t => !previous.has(t));
    const removed = timeline[i + 1].technologies.filter(t => !current.has(t));
    if (added.length > 0 || removed.length > 0) {
      diffs.push({ date: timeline[i].scannedAt, added, removed });
    }
  }

  return new Response(JSON.stringify({
    domain,
    scanCount: timeline.length,
    timeline,
    diffs,
    latestScan: timeline[0] || null,
    oldestScan: timeline[timeline.length - 1] || null,
  }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
