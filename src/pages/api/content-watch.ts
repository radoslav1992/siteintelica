import type { APIRoute } from 'astro';
import { addContentWatch, removeContentWatch, getContentWatches, checkAllWatches, getWatchSnapshots } from '../../utils/content-tracker';
import { createNotification, logAudit } from '../../db/client';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const { action, url, selector, label, watchId } = await context.request.json();

    if (action === 'add') {
      if (!url || !selector) {
        return new Response(JSON.stringify({ error: 'url and selector are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      const result = addContentWatch(user.id, fullUrl, selector, label);
      if (result.success) logAudit(user.id, 'content_watch_add', url, { selector });
      return new Response(JSON.stringify(result), { status: result.success ? 201 : 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'remove') {
      if (!watchId) return new Response(JSON.stringify({ error: 'watchId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const success = removeContentWatch(user.id, watchId);
      return new Response(JSON.stringify({ success }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'check') {
      const changes = await checkAllWatches(user.id);
      changes.forEach(c => {
        createNotification(user.id, 'content_change', `Content changed: ${c.label || c.selector}`, `On ${c.url} — selector "${c.selector}" has new content.`, new URL(c.url).hostname);
      });
      return new Response(JSON.stringify({ checked: true, changes }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'snapshots') {
      if (!watchId) return new Response(JSON.stringify({ error: 'watchId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const snapshots = getWatchSnapshots(watchId);
      return new Response(JSON.stringify(snapshots), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: add, remove, check, snapshots' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const watches = getContentWatches(user.id);
  return new Response(JSON.stringify(watches), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
