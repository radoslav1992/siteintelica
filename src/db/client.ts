import Database from 'better-sqlite3';
import { join } from 'node:path';

const dbPath = join(process.cwd(), 'siteintelica_scans.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Core Tables ──
db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    user_id TEXT,
    scan_data TEXT NOT NULL,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_domain ON scans(domain);

  CREATE TABLE IF NOT EXISTS user (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    api_key TEXT UNIQUE,
    webhook_url TEXT,
    plan TEXT DEFAULT 'free',
    scan_count_today INTEGER DEFAULT 0,
    scan_count_reset_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
  );
`);

// ── Premium Tables ──
db.exec(`
  CREATE TABLE IF NOT EXISTS monitored_domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    label TEXT,
    check_interval TEXT DEFAULT 'daily',
    last_checked_at DATETIME,
    last_scan_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id),
    UNIQUE(user_id, domain)
  );
  CREATE INDEX IF NOT EXISTS idx_monitored_user ON monitored_domains(user_id);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    domain TEXT,
    metadata TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id)
  );
  CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    action TEXT NOT NULL,
    target TEXT,
    metadata TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

  CREATE TABLE IF NOT EXISTS bulk_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    total_urls INTEGER DEFAULT 0,
    completed_urls INTEGER DEFAULT 0,
    results TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES user(id)
  );

  CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    latency_ms INTEGER,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id);
  CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(created_at);

  CREATE TABLE IF NOT EXISTS shared_reports (
    id TEXT PRIMARY KEY,
    scan_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    title TEXT,
    password_hash TEXT,
    view_count INTEGER DEFAULT 0,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id)
  );
  CREATE INDEX IF NOT EXISTS idx_shared_domain ON shared_reports(domain);
`);

// ── Schema migrations for existing databases ──
const migrations = [
  'ALTER TABLE user ADD COLUMN webhook_url TEXT',
  'ALTER TABLE user ADD COLUMN plan TEXT DEFAULT \'free\'',
  'ALTER TABLE user ADD COLUMN scan_count_today INTEGER DEFAULT 0',
  // SQLite forbids DEFAULT CURRENT_TIMESTAMP in ALTER TABLE — use a fixed fallback
  'ALTER TABLE user ADD COLUMN scan_count_reset_at DATETIME DEFAULT \'2025-01-01 00:00:00\'',
  'ALTER TABLE user ADD COLUMN created_at DATETIME DEFAULT \'2025-01-01 00:00:00\'',
  'ALTER TABLE scans ADD COLUMN user_id TEXT',
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column likely exists */ }
}

// Post-migration indexes (columns may not exist until migrations run)
try { db.exec('CREATE INDEX IF NOT EXISTS idx_scans_user ON scans(user_id)'); } catch { }

// ── Rate Limiting ──
const PLAN_LIMITS: Record<string, number> = {
  free: 10,
  pro: 200,
  enterprise: 99999,
};

export function checkRateLimit(userId: string | null, plan: string = 'free'): { allowed: boolean; remaining: number; limit: number } {
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

  if (!userId) {
    return { allowed: true, remaining: limit, limit };
  }

  const user = db.prepare('SELECT scan_count_today, scan_count_reset_at FROM user WHERE id = ?').get(userId) as any;
  if (!user) return { allowed: true, remaining: limit, limit };

  const resetAt = new Date(user.scan_count_reset_at);
  const now = new Date();

  if (now.toDateString() !== resetAt.toDateString()) {
    db.prepare('UPDATE user SET scan_count_today = 0, scan_count_reset_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    return { allowed: true, remaining: limit, limit };
  }

  const remaining = limit - (user.scan_count_today || 0);
  return { allowed: remaining > 0, remaining: Math.max(0, remaining), limit };
}

export function incrementScanCount(userId: string) {
  db.prepare('UPDATE user SET scan_count_today = scan_count_today + 1 WHERE id = ?').run(userId);
}

// ── Audit Log ──
export function logAudit(userId: string | null, action: string, target?: string, metadata?: any, ip?: string) {
  db.prepare('INSERT INTO audit_log (user_id, action, target, metadata, ip_address) VALUES (?, ?, ?, ?, ?)')
    .run(userId, action, target || null, metadata ? JSON.stringify(metadata) : null, ip || null);
}

// ── API Usage ──
export function logApiUsage(userId: string | null, endpoint: string, method: string, statusCode: number, latencyMs: number, ip?: string) {
  db.prepare('INSERT INTO api_usage (user_id, endpoint, method, status_code, latency_ms, ip_address) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, endpoint, method, statusCode, latencyMs, ip || null);
}

export function getApiUsageStats(userId: string): { today: number; thisWeek: number; thisMonth: number } {
  const today = (db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND date(created_at) = date('now')").get(userId) as any)?.c || 0;
  const thisWeek = (db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND created_at >= datetime('now', '-7 days')").get(userId) as any)?.c || 0;
  const thisMonth = (db.prepare("SELECT COUNT(*) as c FROM api_usage WHERE user_id = ? AND created_at >= datetime('now', '-30 days')").get(userId) as any)?.c || 0;
  return { today, thisWeek, thisMonth };
}

// ── Scans ──
export function saveScan(domain: string, data: any, userId?: string) {
  try {
    db.prepare('INSERT INTO scans (domain, scan_data, user_id) VALUES (?, ?, ?)')
      .run(domain, JSON.stringify(data), userId || null);
  } catch (error) {
    console.error('Failed to save scan to DB:', error);
  }
}

export function getLastScan(domain: string) {
  try {
    const result = db.prepare('SELECT scan_data, scanned_at FROM scans WHERE domain = ? ORDER BY scanned_at DESC LIMIT 1')
      .get(domain) as { scan_data: string; scanned_at: string } | undefined;
    if (result) return { data: JSON.parse(result.scan_data), scannedAt: result.scanned_at };
    return null;
  } catch (error) {
    console.error('Failed to retrieve scan from DB:', error);
    return null;
  }
}

export function getRecentScans(limit: number = 10) {
  try {
    return db.prepare('SELECT domain, scanned_at FROM scans ORDER BY scanned_at DESC LIMIT ?')
      .all(limit) as { domain: string; scanned_at: string }[];
  } catch {
    return [];
  }
}

export function getDomainHistory(domain: string, limit: number = 50) {
  try {
    return db.prepare('SELECT id, scan_data, scanned_at FROM scans WHERE domain = ? ORDER BY scanned_at DESC LIMIT ?')
      .all(domain, limit) as { id: number; scan_data: string; scanned_at: string }[];
  } catch {
    return [];
  }
}

export function getTrendsData() {
  try {
    const rows = db.prepare('SELECT scan_data FROM scans ORDER BY scanned_at DESC LIMIT 1000')
      .all() as { scan_data: string }[];

    const techCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};

    rows.forEach(row => {
      try {
        const data = JSON.parse(row.scan_data);
        if (data.technologies) {
          data.technologies.forEach((tech: any) => {
            techCounts[tech.name] = (techCounts[tech.name] || 0) + 1;
            if (tech.categories) {
              tech.categories.forEach((cat: any) => {
                categoryCounts[cat.name] = (categoryCounts[cat.name] || 0) + 1;
              });
            }
          });
        }
      } catch { }
    });

    const topTechnologies = Object.entries(techCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const topCategories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return { totalScans: rows.length, topTechnologies, topCategories };
  } catch {
    return { totalScans: 0, topTechnologies: [], topCategories: [] };
  }
}

export function getUserScans(userId: string, limit: number = 50) {
  try {
    return db.prepare('SELECT id, domain, scanned_at FROM scans WHERE user_id = ? ORDER BY scanned_at DESC LIMIT ?')
      .all(userId, limit) as { id: number; domain: string; scanned_at: string }[];
  } catch {
    try {
      return db.prepare('SELECT id, domain, scanned_at FROM scans ORDER BY scanned_at DESC LIMIT ?')
        .all(limit) as { id: number; domain: string; scanned_at: string }[];
    } catch {
      return [];
    }
  }
}

export function getLeaderboard() {
  try {
    return db.prepare(`
      SELECT domain, COUNT(*) as scan_count, MAX(scanned_at) as last_scanned
      FROM scans GROUP BY domain ORDER BY scan_count DESC LIMIT 25
    `).all() as { domain: string; scan_count: number; last_scanned: string }[];
  } catch {
    return [];
  }
}

export function getPublicReport(domain: string) {
  try {
    const result = db.prepare('SELECT scan_data, scanned_at FROM scans WHERE domain = ? ORDER BY scanned_at DESC LIMIT 1')
      .get(domain) as { scan_data: string; scanned_at: string } | undefined;
    if (result) return { data: JSON.parse(result.scan_data), scannedAt: result.scanned_at };
    return null;
  } catch {
    return null;
  }
}

// ── Technology Search (Lead Generation) ──
export function searchByTechnology(techName: string, limit: number = 100): { domain: string; scanned_at: string; techs: string[] }[] {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT domain, scan_data, MAX(scanned_at) as scanned_at
      FROM scans WHERE scan_data LIKE ? GROUP BY domain ORDER BY scanned_at DESC LIMIT ?
    `).all(`%"name":"${techName}"%`, limit) as { domain: string; scan_data: string; scanned_at: string }[];

    return rows.map(row => {
      const data = JSON.parse(row.scan_data);
      const techs = (data.technologies || []).map((t: any) => t.name);
      return { domain: row.domain, scanned_at: row.scanned_at, techs };
    });
  } catch {
    return [];
  }
}

export function searchByMultipleTechnologies(include: string[], exclude: string[] = [], limit: number = 100) {
  try {
    const rows = db.prepare(`
      SELECT DISTINCT domain, scan_data, MAX(scanned_at) as scanned_at
      FROM scans GROUP BY domain ORDER BY scanned_at DESC LIMIT 2000
    `).all() as { domain: string; scan_data: string; scanned_at: string }[];

    return rows
      .map(row => {
        const data = JSON.parse(row.scan_data);
        const techs: string[] = (data.technologies || []).map((t: any) => t.name);
        return { domain: row.domain, scanned_at: row.scanned_at, techs, data };
      })
      .filter(r => {
        const hasAll = include.every(t => r.techs.some(rt => rt.toLowerCase().includes(t.toLowerCase())));
        const hasNone = exclude.every(t => !r.techs.some(rt => rt.toLowerCase().includes(t.toLowerCase())));
        return hasAll && hasNone;
      })
      .slice(0, limit)
      .map(({ domain, scanned_at, techs }) => ({ domain, scanned_at, techs }));
  } catch {
    return [];
  }
}

export function getTechnologyStats(): { name: string; count: number; percentage: number }[] {
  try {
    const rows = db.prepare(`
      SELECT scan_data FROM (SELECT scan_data, ROW_NUMBER() OVER (PARTITION BY domain ORDER BY scanned_at DESC) rn FROM scans) WHERE rn = 1
    `).all() as { scan_data: string }[];

    const totalDomains = rows.length;
    const counts: Record<string, number> = {};

    rows.forEach(row => {
      try {
        const data = JSON.parse(row.scan_data);
        (data.technologies || []).forEach((t: any) => {
          counts[t.name] = (counts[t.name] || 0) + 1;
        });
      } catch { }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, percentage: totalDomains > 0 ? Math.round((count / totalDomains) * 10000) / 100 : 0 }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

// ── Monitoring ──
export function addMonitoredDomain(userId: string, domain: string, label?: string, interval: string = 'daily') {
  db.prepare('INSERT OR IGNORE INTO monitored_domains (user_id, domain, label, check_interval) VALUES (?, ?, ?, ?)')
    .run(userId, domain, label || null, interval);
}

export function removeMonitoredDomain(userId: string, domain: string) {
  db.prepare('DELETE FROM monitored_domains WHERE user_id = ? AND domain = ?').run(userId, domain);
}

export function getMonitoredDomains(userId: string) {
  return db.prepare(`
    SELECT md.*, s.scan_data as latest_scan_data
    FROM monitored_domains md
    LEFT JOIN scans s ON s.domain = md.domain AND s.id = (SELECT MAX(id) FROM scans WHERE domain = md.domain)
    WHERE md.user_id = ? AND md.is_active = 1
    ORDER BY md.created_at DESC
  `).all(userId) as any[];
}

export function getDomainsToCheck(): any[] {
  return db.prepare(`
    SELECT md.*, u.webhook_url, u.email
    FROM monitored_domains md
    JOIN user u ON u.id = md.user_id
    WHERE md.is_active = 1
    AND (md.last_checked_at IS NULL OR
         (md.check_interval = 'daily' AND md.last_checked_at < datetime('now', '-1 day')) OR
         (md.check_interval = 'weekly' AND md.last_checked_at < datetime('now', '-7 days')) OR
         (md.check_interval = 'hourly' AND md.last_checked_at < datetime('now', '-1 hour'))
    )
  `).all() as any[];
}

export function updateMonitorCheck(monitorId: number, scanId?: number) {
  db.prepare('UPDATE monitored_domains SET last_checked_at = CURRENT_TIMESTAMP, last_scan_id = ? WHERE id = ?')
    .run(scanId || null, monitorId);
}

// ── Notifications ──
export function createNotification(userId: string, type: string, title: string, body: string, domain?: string, metadata?: any) {
  db.prepare('INSERT INTO notifications (user_id, type, title, body, domain, metadata) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, type, title, body, domain || null, metadata ? JSON.stringify(metadata) : null);
}

export function getNotifications(userId: string, limit: number = 50) {
  return db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as any[];
}

export function getUnreadNotificationCount(userId: string): number {
  return (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId) as any)?.c || 0;
}

export function markNotificationsRead(userId: string, ids?: number[]) {
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`).run(userId, ...ids);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  }
}

// ── Bulk Jobs ──
export function createBulkJob(userId: string, totalUrls: number): number {
  const result = db.prepare('INSERT INTO bulk_jobs (user_id, total_urls) VALUES (?, ?)').run(userId, totalUrls);
  return Number(result.lastInsertRowid);
}

export function updateBulkJob(jobId: number, completedUrls: number, status: string, results?: any) {
  if (results) {
    db.prepare('UPDATE bulk_jobs SET completed_urls = ?, status = ?, results = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(completedUrls, status, JSON.stringify(results), jobId);
  } else {
    db.prepare('UPDATE bulk_jobs SET completed_urls = ?, status = ? WHERE id = ?')
      .run(completedUrls, status, jobId);
  }
}

export function getBulkJobs(userId: string) {
  return db.prepare('SELECT id, status, total_urls, completed_urls, created_at, completed_at FROM bulk_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(userId) as any[];
}

export function getBulkJobResult(jobId: number, userId: string) {
  return db.prepare('SELECT * FROM bulk_jobs WHERE id = ? AND user_id = ?').get(jobId, userId) as any;
}

// ── Tech Aggregation (for /tech/[slug] deep dive) ──
export function getTechAggregation(techName: string) {
  try {
    const rows = db.prepare('SELECT domain, scan_data FROM scans ORDER BY scanned_at DESC LIMIT 2000')
      .all() as { domain: string; scan_data: string }[];

    let totalSites = 0;
    const domains = new Set<string>();
    const companionCounts: Record<string, number> = {};
    const perfScores: number[] = [];

    rows.forEach(row => {
      try {
        const data = JSON.parse(row.scan_data);
        const techs: string[] = (data.technologies || []).map((t: any) => t.name);
        if (!techs.some(t => t.toLowerCase() === techName.toLowerCase())) return;

        totalSites++;
        domains.add(row.domain);

        techs.forEach(t => {
          if (t.toLowerCase() !== techName.toLowerCase()) {
            companionCounts[t] = (companionCounts[t] || 0) + 1;
          }
        });

        const perfScore = data.performance?.score;
        if (typeof perfScore === 'number') perfScores.push(perfScore);
      } catch { }
    });

    const topCompanions = Object.entries(companionCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const avgPerformance = perfScores.length > 0
      ? Math.round(perfScores.reduce((s, v) => s + v, 0) / perfScores.length)
      : null;

    return { totalSites, uniqueDomains: domains.size, topCompanions, avgPerformance };
  } catch {
    return { totalSites: 0, uniqueDomains: 0, topCompanions: [], avgPerformance: null };
  }
}

// ── Shared Reports ──
export function createSharedReport(id: string, scanId: number, userId: string, domain: string, title?: string, expiresAt?: string): boolean {
  try {
    db.prepare('INSERT INTO shared_reports (id, scan_id, user_id, domain, title, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(id, scanId, userId, domain, title || null, expiresAt || null);
    return true;
  } catch { return false; }
}

export function getSharedReport(id: string) {
  try {
    const report = db.prepare(`
      SELECT sr.*, s.scan_data, s.scanned_at
      FROM shared_reports sr
      JOIN scans s ON s.id = sr.scan_id
      WHERE sr.id = ? AND (sr.expires_at IS NULL OR sr.expires_at > datetime('now'))
    `).get(id) as any;

    if (report) {
      db.prepare('UPDATE shared_reports SET view_count = view_count + 1 WHERE id = ?').run(id);
      return { ...report, scan_data: JSON.parse(report.scan_data) };
    }
    return null;
  } catch { return null; }
}

export function getUserSharedReports(userId: string) {
  try {
    return db.prepare('SELECT id, domain, title, view_count, expires_at, created_at FROM shared_reports WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];
  } catch { return []; }
}

export function getScanById(scanId: number) {
  try {
    const row = db.prepare('SELECT id, domain, scan_data, scanned_at FROM scans WHERE id = ?').get(scanId) as any;
    if (row) return { ...row, scan_data: JSON.parse(row.scan_data) };
    return null;
  } catch { return null; }
}

export function getLatestScanId(domain: string): number | null {
  try {
    const row = db.prepare('SELECT id FROM scans WHERE domain = ? ORDER BY scanned_at DESC LIMIT 1').get(domain) as any;
    return row?.id ?? null;
  } catch { return null; }
}

export default db;
