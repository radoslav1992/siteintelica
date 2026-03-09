import type { APIRoute } from 'astro';
import db from '../../../db/client';

export const prerender = false;

const CHECK_INTERVAL = 30000;

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };

      sendEvent('connected', { message: 'Monitoring active', timestamp: new Date().toISOString() });

      const checkForChanges = () => {
        if (closed) return;
        try {
          const stmt = db.prepare(`
            SELECT wd.domain, wd.last_checked
            FROM watched_domains wd
            WHERE wd.user_id = ?
          `);
          const watched = stmt.all(user.id) as { domain: string; last_checked: string | null }[];

          watched.forEach(w => {
            const scanStmt = db.prepare(`
              SELECT scan_data, scanned_at FROM scans
              WHERE domain = ? AND scanned_at > COALESCE(?, '1970-01-01')
              ORDER BY scanned_at DESC LIMIT 1
            `);
            const newScan = scanStmt.get(w.domain, w.last_checked) as { scan_data: string; scanned_at: string } | undefined;

            if (newScan) {
              db.prepare('UPDATE watched_domains SET last_checked = ? WHERE user_id = ? AND domain = ?')
                .run(newScan.scanned_at, user.id, w.domain);

              try {
                const data = JSON.parse(newScan.scan_data);
                sendEvent('update', {
                  domain: w.domain,
                  scannedAt: newScan.scanned_at,
                  techCount: (data.technologies || []).length,
                  securityGrade: data.securityGrade?.grade || '?',
                  perfScore: data.performance?.score ?? null,
                });
              } catch {}
            }
          });

          sendEvent('heartbeat', { timestamp: new Date().toISOString() });
        } catch {}
      };

      const interval = setInterval(checkForChanges, CHECK_INTERVAL);
      checkForChanges();

      context.request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};
