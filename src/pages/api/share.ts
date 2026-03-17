import type { APIRoute } from 'astro';
import { createSharedReport, getLatestScanId, getUserSharedReports, logAudit } from '../../db/client';
import { randomBytes } from 'node:crypto';

export const prerender = false;

const MAX_SHARES_PER_USER = 50;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { domain, title, expiresInDays } = await context.request.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const existing = getUserSharedReports(user.id);
    if (existing.length >= MAX_SHARES_PER_USER) {
      return new Response(JSON.stringify({ error: `Max ${MAX_SHARES_PER_USER} shared reports. Delete some first.` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const scanId = getLatestScanId(domain);
    if (!scanId) {
      return new Response(JSON.stringify({ error: `No scan found for ${domain}. Analyze it first.` }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const id = randomBytes(12).toString('base64url');
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : undefined;

    const success = createSharedReport(id, scanId, user.id, domain, title, expiresAt);
    if (!success) {
      return new Response(JSON.stringify({ error: 'Failed to create shared report' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    logAudit(user.id, 'share_create', domain, { reportId: id });

    const shareUrl = `${context.url.origin}/shared/${id}`;
    return new Response(JSON.stringify({ id, url: shareUrl, expiresAt }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const reports = getUserSharedReports(user.id);
  return new Response(JSON.stringify(reports), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
