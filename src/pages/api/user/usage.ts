import type { APIRoute } from 'astro';
import { getUsageStats, getTotalUsage } from '../../../utils/rate-limit';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  const stats = getUsageStats(user.id, 30);
  const totalUsage = getTotalUsage(user.id);

  const dailyTotals: Record<string, number> = {};
  const endpointBreakdown: Record<string, number> = {};

  stats.forEach(row => {
    dailyTotals[row.day] = (dailyTotals[row.day] || 0) + row.count;
    endpointBreakdown[row.endpoint] = (endpointBreakdown[row.endpoint] || 0) + row.count;
  });

  return new Response(JSON.stringify({
    totalUsage,
    dailyTotals,
    endpointBreakdown,
    last30Days: stats,
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
