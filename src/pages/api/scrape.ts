import type { APIRoute } from 'astro';
import { smartScrape } from '../../utils/scraper';
import { logAudit } from '../../db/client';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Premium feature.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await context.request.json();
    let { url, selectors } = body;

    if (!url) {
      return new Response(JSON.stringify({ error: 'url is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!url.startsWith('http')) url = `https://${url}`;

    const result = await smartScrape(url, selectors);
    logAudit(user.id, 'scrape', url, { selectorsCount: selectors ? Object.keys(selectors).length : 0 });

    if (result.statusCode === 403 || result.statusCode === 429) {
      return new Response(JSON.stringify({
        ...result,
        warning: `Site returned HTTP ${result.statusCode}. The page may use anti-bot protection (Cloudflare, WAF). We tried browser headers, Google Cache, and Wayback Machine as fallbacks. The data shown may be partial or from a cached version.`,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Scrape failed: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
