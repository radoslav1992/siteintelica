import { lucia } from "./lib/auth";
import { defineMiddleware } from "astro:middleware";
import { logApiUsage } from "./db/client";

export const onRequest = defineMiddleware(async (context, next) => {
  const startTime = Date.now();

  // Session validation
  const sessionId = context.cookies.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    context.locals.user = null;
    context.locals.session = null;
  } else {
    const { session, user } = await lucia.validateSession(sessionId);
    if (session && session.fresh) {
      const sessionCookie = lucia.createSessionCookie(session.id);
      context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
    if (!session) {
      const sessionCookie = lucia.createBlankSessionCookie();
      context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
    context.locals.user = user;
    context.locals.session = session;
  }

  const response = await next();

  // Log API usage for /api/* routes
  const pathname = context.url.pathname;
  if (pathname.startsWith('/api/')) {
    const latency = Date.now() - startTime;
    const ip = context.request.headers.get('x-forwarded-for') || context.request.headers.get('cf-connecting-ip') || 'unknown';
    try {
      logApiUsage(context.locals.user?.id || null, pathname, context.request.method, response.status, latency, ip);
    } catch { }
  }

  return response;
});
