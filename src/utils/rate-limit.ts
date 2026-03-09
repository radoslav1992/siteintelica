import db from '../db/client';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_MAX_REQUESTS = 60;
const PREMIUM_MAX_REQUESTS = 300;

try { db.exec(`
  CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    api_key TEXT,
    endpoint TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(api_key, created_at);
  CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id, created_at);
`); } catch {}

export function checkRateLimit(identifier: string, type: 'api_key' | 'user_id'): { allowed: boolean; remaining: number; limit: number } {
  const column = type === 'api_key' ? 'api_key' : 'user_id';
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const limit = type === 'api_key' ? PREMIUM_MAX_REQUESTS : DEFAULT_MAX_REQUESTS;

  try {
    const stmt = db.prepare(`SELECT COUNT(*) as count FROM api_usage WHERE ${column} = ? AND created_at > ?`);
    const row = stmt.get(identifier, windowStart) as { count: number };
    const remaining = Math.max(0, limit - row.count);
    return { allowed: row.count < limit, remaining, limit };
  } catch {
    return { allowed: true, remaining: limit, limit };
  }
}

export function recordUsage(endpoint: string, userId?: string, apiKey?: string) {
  try {
    const stmt = db.prepare('INSERT INTO api_usage (user_id, api_key, endpoint) VALUES (?, ?, ?)');
    stmt.run(userId ?? null, apiKey ?? null, endpoint);
  } catch {}
}

export function getUsageStats(userId: string, days: number = 30) {
  try {
    const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const stmt = db.prepare(`
      SELECT DATE(created_at) as day, endpoint, COUNT(*) as count
      FROM api_usage
      WHERE user_id = ? AND created_at > ?
      GROUP BY DATE(created_at), endpoint
      ORDER BY day DESC
    `);
    return stmt.all(userId, windowStart) as { day: string; endpoint: string; count: number }[];
  } catch {
    return [];
  }
}

export function getTotalUsage(userId: string): number {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM api_usage WHERE user_id = ?');
    const row = stmt.get(userId) as { count: number };
    return row.count;
  } catch {
    return 0;
  }
}
