import type { APIRoute } from 'astro';
import { getNotifications, getUnreadNotificationCount, markNotificationsRead } from '../../db/client';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const notifications = getNotifications(user.id, 50);
  const unreadCount = getUnreadNotificationCount(user.id);

  return new Response(JSON.stringify({ notifications, unreadCount }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await context.request.json();
    const { action, ids } = data;

    if (action === 'mark_read') {
      markNotificationsRead(user.id, ids);
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
