import type { APIRoute } from 'astro';
import { checkUptime, getUptimeStats } from '../../utils/uptime';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const data = await context.request.json();
    const domain = data.domain;
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await checkUptime(domain);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const domain = context.url.searchParams.get('domain');
  if (!domain) {
    return new Response(JSON.stringify({ error: 'domain query param required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const days = parseInt(context.url.searchParams.get('days') || '30');
  const stats = getUptimeStats(domain, days);
  return new Response(JSON.stringify(stats), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
