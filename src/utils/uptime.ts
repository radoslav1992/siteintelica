/**
 * Uptime Monitor — simple HTTP health checks with latency tracking.
 * Checks both HTTP status and SSL validity.
 */

import db from '../db/client';

// Create uptime_checks table
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS uptime_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL,
      status_code INTEGER,
      latency_ms INTEGER,
      is_up INTEGER DEFAULT 1,
      ssl_days_left INTEGER,
      error TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_uptime_domain ON uptime_checks(domain);
    CREATE INDEX IF NOT EXISTS idx_uptime_date ON uptime_checks(checked_at);
  `);
} catch { }

export interface UptimeCheck {
  statusCode: number;
  latencyMs: number;
  isUp: boolean;
  sslDaysLeft: number | null;
  error: string | null;
  checkedAt: string;
}

export interface UptimeStats {
  domain: string;
  uptimePercent: number;
  avgLatencyMs: number;
  checksCount: number;
  lastCheck: UptimeCheck | null;
  history: UptimeCheck[];
  sslDaysLeft: number | null;
  statusText: string;
}

export async function checkUptime(domain: string): Promise<UptimeCheck> {
  const url = `https://${domain}`;
  let statusCode = 0;
  let latencyMs = 0;
  let isUp = false;
  let sslDaysLeft: number | null = null;
  let error: string | null = null;

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
      headers: { 'User-Agent': 'SiteIntelica Uptime/1.0' },
    });
    latencyMs = Date.now() - start;
    statusCode = res.status;
    isUp = statusCode >= 200 && statusCode < 400;
  } catch (e: any) {
    latencyMs = Date.now() - start;
    error = e.message || 'Connection failed';
  }

  // SSL check
  try {
    const tls = await import('node:tls');
    sslDaysLeft = await new Promise<number | null>((resolve) => {
      const socket = tls.connect({ port: 443, host: domain, servername: domain, rejectUnauthorized: false }, () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (cert?.valid_to) {
          const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000);
          resolve(days);
        } else {
          resolve(null);
        }
      });
      socket.on('error', () => resolve(null));
      socket.setTimeout(3000, () => { socket.destroy(); resolve(null); });
    });
  } catch {
    sslDaysLeft = null;
  }

  // Save to DB
  try {
    db.prepare('INSERT INTO uptime_checks (domain, status_code, latency_ms, is_up, ssl_days_left, error) VALUES (?, ?, ?, ?, ?, ?)')
      .run(domain, statusCode, latencyMs, isUp ? 1 : 0, sslDaysLeft, error);
  } catch { }

  return { statusCode, latencyMs, isUp, sslDaysLeft, error, checkedAt: new Date().toISOString() };
}

export function getUptimeStats(domain: string, days: number = 30): UptimeStats {
  try {
    const checks = db.prepare(`
      SELECT status_code, latency_ms, is_up, ssl_days_left, error, checked_at
      FROM uptime_checks WHERE domain = ? AND checked_at >= datetime('now', ?)
      ORDER BY checked_at DESC LIMIT 500
    `).all(domain, `-${days} days`) as any[];

    if (checks.length === 0) {
      return { domain, uptimePercent: 0, avgLatencyMs: 0, checksCount: 0, lastCheck: null, history: [], sslDaysLeft: null, statusText: 'No data' };
    }

    const upCount = checks.filter(c => c.is_up).length;
    const uptimePercent = Math.round((upCount / checks.length) * 10000) / 100;
    const avgLatencyMs = Math.round(checks.reduce((s: number, c: any) => s + c.latency_ms, 0) / checks.length);
    const lastCheck = checks[0];

    let statusText: string;
    if (uptimePercent >= 99.9) statusText = 'Excellent — near-perfect uptime';
    else if (uptimePercent >= 99) statusText = 'Good — minor interruptions';
    else if (uptimePercent >= 95) statusText = 'Fair — noticeable downtime';
    else statusText = 'Poor — significant reliability issues';

    const history: UptimeCheck[] = checks.map((c: any) => ({
      statusCode: c.status_code,
      latencyMs: c.latency_ms,
      isUp: !!c.is_up,
      sslDaysLeft: c.ssl_days_left,
      error: c.error,
      checkedAt: c.checked_at,
    }));

    return {
      domain,
      uptimePercent,
      avgLatencyMs,
      checksCount: checks.length,
      lastCheck: history[0],
      history: history.slice(0, 50),
      sslDaysLeft: lastCheck.ssl_days_left,
      statusText,
    };
  } catch {
    return { domain, uptimePercent: 0, avgLatencyMs: 0, checksCount: 0, lastCheck: null, history: [], sslDaysLeft: null, statusText: 'Error' };
  }
}
