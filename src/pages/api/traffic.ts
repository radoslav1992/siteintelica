import type { APIRoute } from 'astro';
import { getTrafficIntelligence } from '../../utils/traffic-intel';
import { getLastScan, logAudit } from '../../db/client';

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

  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];

  // Get tech stack from latest scan if available
  const lastScan = getLastScan(cleanDomain);
  const techs = lastScan?.data?.technologies?.map((t: any) => t.name) || [];

  const traffic = await getTrafficIntelligence(cleanDomain, techs);
  logAudit(user.id, 'traffic_intel', cleanDomain);

  return new Response(JSON.stringify(traffic), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
