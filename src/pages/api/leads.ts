import type { APIRoute } from 'astro';
import { searchByMultipleTechnologies, getTechnologyStats, logAudit } from '../../db/client';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Premium account required for Lead Generation.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await context.request.json();
    const include: string[] = data.include || [];
    const exclude: string[] = data.exclude || [];
    const limit: number = Math.min(data.limit || 100, 500);

    if (include.length === 0) {
      return new Response(JSON.stringify({ error: 'Provide at least one technology to search for in "include" array.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const results = searchByMultipleTechnologies(include, exclude, limit);
    logAudit(user.id, 'lead_search', null, { include, exclude, resultCount: results.length });

    return new Response(JSON.stringify({
      query: { include, exclude },
      resultCount: results.length,
      results,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Lead search failed: ' + (error.message || 'Unknown error') }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const stats = getTechnologyStats();
  return new Response(JSON.stringify({ technologies: stats.slice(0, 100) }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
