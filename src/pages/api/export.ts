import type { APIRoute } from 'astro';
import { getDomainHistory, getUserScans, logAudit } from '../../db/client';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const format = context.url.searchParams.get('format') || 'json';
  const domain = context.url.searchParams.get('domain');
  const type = context.url.searchParams.get('type') || 'scans';

  logAudit(user.id, 'export', null, { format, domain, type });

  if (type === 'history' && domain) {
    const scans = getDomainHistory(domain, 100);
    const rows = scans.map(s => {
      const data = JSON.parse(s.scan_data);
      const techs = (data.technologies || []).map((t: any) => t.name);
      return {
        domain,
        scannedAt: s.scanned_at,
        techCount: techs.length,
        technologies: techs.join('; '),
        performanceScore: data.performance?.score ?? '',
        seoScore: data.performance?.seo ?? '',
        securityGrade: data.securityGrade?.grade ?? '',
      };
    });

    if (format === 'csv') {
      return csvResponse(rows, `siteintelica_history_${domain}.csv`);
    }
    return jsonResponse(rows, `siteintelica_history_${domain}.json`);
  }

  // Default: export user scan list
  const scans = getUserScans(user.id, 500);
  if (format === 'csv') {
    return csvResponse(scans, 'siteintelica_scans.csv');
  }
  return jsonResponse(scans, 'siteintelica_scans.json');
};

function csvResponse(rows: any[], filename: string): Response {
  if (rows.length === 0) {
    return new Response('No data', { status: 200, headers: { 'Content-Type': 'text/csv' } });
  }

  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')),
  ];

  return new Response(csvLines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function jsonResponse(data: any, filename: string): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
