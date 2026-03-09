import type { APIRoute } from 'astro';
import { getWaybackSnapshots, getWaybackPageCount } from '../../utils/wayback';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Premium account required.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { domain } = await context.request.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain is required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const [snapshots, pageCount] = await Promise.all([
      getWaybackSnapshots(domain),
      getWaybackPageCount(domain),
    ]);

    return new Response(JSON.stringify({ snapshots, archivedPages: pageCount }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Wayback lookup failed.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};
