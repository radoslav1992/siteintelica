import type { APIRoute } from 'astro';
import { findSimilarSites } from '../../utils/similar-sites';
import { getLastScan } from '../../db/client';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Premium feature.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const domain = context.url.searchParams.get('domain');
  if (!domain) {
    return new Response(JSON.stringify({ error: 'domain query param required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const lastScan = getLastScan(domain);
  if (!lastScan) {
    return new Response(JSON.stringify({ error: `No scan data for ${domain}. Scan it first.` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const techs = (lastScan.data.technologies || []).map((t: any) => t.name);
  const similar = findSimilarSites(domain, techs, 15);

  return new Response(JSON.stringify({ domain, techCount: techs.length, similar }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
