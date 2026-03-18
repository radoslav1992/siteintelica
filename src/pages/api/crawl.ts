import type { APIRoute } from 'astro';
import { crawlSite } from '../../utils/site-crawler';
import { logAudit } from '../../db/client';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Premium feature.' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { domain, maxPages } = await context.request.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: 'domain is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];
    const pages = Math.min(maxPages || 20, 30);
    const result = await crawlSite(cleanDomain, pages);
    logAudit(user.id, 'crawl', cleanDomain, { pagesCrawled: result.pagesCrawled });

    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Crawl failed: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
