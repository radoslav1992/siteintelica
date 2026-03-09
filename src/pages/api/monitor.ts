import type { APIRoute } from 'astro';
import db from '../../db/client';

export const prerender = false;

try { db.exec(`
  CREATE TABLE IF NOT EXISTS watched_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_checked DATETIME,
    FOREIGN KEY (user_id) REFERENCES user(id),
    UNIQUE(user_id, domain)
  );
`); } catch {}

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const stmt = db.prepare(`
      SELECT wd.id, wd.domain, wd.created_at, wd.last_checked,
             s.scan_data, s.scanned_at as last_scan_date
      FROM watched_domains wd
      LEFT JOIN scans s ON s.domain = wd.domain
        AND s.scanned_at = (SELECT MAX(s2.scanned_at) FROM scans s2 WHERE s2.domain = wd.domain)
      WHERE wd.user_id = ?
      ORDER BY wd.created_at DESC
    `);
    const watchlist = stmt.all(user.id) as any[];

    const result = watchlist.map(w => {
      let techCount = 0;
      let securityGrade = '?';
      let perfScore = null;
      if (w.scan_data) {
        try {
          const data = JSON.parse(w.scan_data);
          techCount = (data.technologies || []).length;
          securityGrade = data.securityGrade?.grade || '?';
          perfScore = data.performance?.score ?? null;
        } catch {}
      }
      return {
        id: w.id,
        domain: w.domain,
        createdAt: w.created_at,
        lastChecked: w.last_checked,
        lastScanDate: w.last_scan_date,
        techCount,
        securityGrade,
        perfScore,
      };
    });

    return new Response(JSON.stringify({ watchlist: result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const { domain, action } = await context.request.json();
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Domain is required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'remove') {
      db.prepare('DELETE FROM watched_domains WHERE user_id = ? AND domain = ?').run(user.id, domain);
      return new Response(JSON.stringify({ success: true, message: 'Removed from watchlist.' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const existing = db.prepare('SELECT COUNT(*) as count FROM watched_domains WHERE user_id = ?').get(user.id) as { count: number };
    if (existing.count >= 20) {
      return new Response(JSON.stringify({ error: 'Maximum 20 watched domains allowed.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    db.prepare('INSERT OR IGNORE INTO watched_domains (user_id, domain) VALUES (?, ?)').run(user.id, domain);

    return new Response(JSON.stringify({ success: true, message: `Now watching ${domain}.` }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};
