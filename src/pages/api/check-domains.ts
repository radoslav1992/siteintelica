import type { APIRoute } from 'astro';
import { runChangeDetection } from '../../utils/change-detector';

export const prerender = false;

/**
 * Trigger change detection for all monitored domains.
 * In production, this would be called by a cron job (e.g., every hour).
 * Can also be triggered manually from the dashboard.
 */
export const POST: APIRoute = async (context) => {
  const user = context.locals.user;

  // Allow authenticated users or cron secrets
  const cronSecret = context.request.headers.get('x-cron-secret');
  const isAuthorized = !!user || cronSecret === (import.meta.env.CRON_SECRET || 'siteintelica-cron');

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const result = await runChangeDetection();
    return new Response(JSON.stringify({
      success: true,
      ...result,
      message: `Checked ${result.checked} domain(s), found ${result.changes} change(s).`,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Change detection failed: ' + error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
