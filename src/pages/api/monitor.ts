import type { APIRoute } from 'astro';
import { addMonitoredDomain, removeMonitoredDomain, getMonitoredDomains, logAudit, createNotification } from '../../db/client';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Premium account required for Domain Monitoring.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await context.request.json();
    const { action } = data;

    if (action === 'remove') {
      const domain = data.domain;
      if (!domain) {
        return new Response(JSON.stringify({ error: 'Domain required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      removeMonitoredDomain(user.id, domain);
      logAudit(user.id, 'monitor_remove', domain);
      return new Response(JSON.stringify({ success: true, message: `Stopped monitoring ${domain}` }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Default: add domain
    const url = data.url;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return new Response(JSON.stringify({ error: 'Invalid URL provided. Please include http:// or https://' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const domain = new URL(url).hostname;
    const label = data.label || null;
    const interval = data.interval || 'daily';

    if (!['hourly', 'daily', 'weekly'].includes(interval)) {
      return new Response(JSON.stringify({ error: 'Invalid interval. Use: hourly, daily, or weekly.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    // Limit monitored domains per user
    const existing = getMonitoredDomains(user.id);
    const MAX_MONITORED = 25;
    if (existing.length >= MAX_MONITORED) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_MONITORED} monitored domains reached. Remove one first.` }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    addMonitoredDomain(user.id, domain, label, interval);
    logAudit(user.id, 'monitor_add', domain, { interval });

    createNotification(
      user.id,
      'monitor',
      `Now monitoring ${domain}`,
      `You'll be notified when the tech stack changes. Check interval: ${interval}.`,
      domain
    );

    return new Response(JSON.stringify({
      success: true,
      domain,
      interval,
      message: `Now monitoring ${domain} (${interval} checks).`,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Monitor error: ' + (error.message || 'Unknown error') }), {
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

  const domains = getMonitoredDomains(user.id);

  const enriched = domains.map((d: any) => {
    let techCount = 0;
    let securityGrade = null;
    let performanceScore = null;

    if (d.latest_scan_data) {
      try {
        const scanData = JSON.parse(d.latest_scan_data);
        techCount = (scanData.technologies || []).length;
        securityGrade = scanData.securityGrade?.grade || null;
        performanceScore = scanData.performance?.score || null;
      } catch { }
    }

    return {
      id: d.id,
      domain: d.domain,
      label: d.label,
      interval: d.check_interval,
      lastChecked: d.last_checked_at,
      isActive: !!d.is_active,
      createdAt: d.created_at,
      techCount,
      securityGrade,
      performanceScore,
    };
  });

  return new Response(JSON.stringify({ domains: enriched }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
