import Database from 'better-sqlite3';
import { join } from 'node:path';

// Store DB in the project root for persistence across dev reloads
const dbPath = join(process.cwd(), 'siteintelica_scans.db');
const db = new Database(dbPath);

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL,
    scan_data TEXT NOT NULL,
    scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_domain ON scans(domain);

  CREATE TABLE IF NOT EXISTS user (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    hashed_password TEXT NOT NULL,
    api_key TEXT UNIQUE,
    webhook_url TEXT
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT NOT NULL PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id)
  );
`);

// Patch existing databases with new columns if they don't exist
try { db.exec('ALTER TABLE user ADD COLUMN webhook_url TEXT'); } catch {}
try { db.exec('ALTER TABLE scans ADD COLUMN user_id TEXT REFERENCES user(id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id)'); } catch {}

export function saveScan(domain: string, data: any, userId?: string) {
  try {
    const stmt = db.prepare('INSERT INTO scans (domain, scan_data, user_id) VALUES (?, ?, ?)');
    stmt.run(domain, JSON.stringify(data), userId ?? null);
  } catch (error) {
    console.error('Failed to save scan to DB:', error);
  }
}

export function getLastScan(domain: string) {
  try {
    const stmt = db.prepare('SELECT scan_data, scanned_at FROM scans WHERE domain = ? ORDER BY scanned_at DESC LIMIT 1');
    const result = stmt.get(domain) as { scan_data: string, scanned_at: string } | undefined;

    if (result) {
      return {
        data: JSON.parse(result.scan_data),
        scannedAt: result.scanned_at
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to retrieve scan from DB:', error);
    return null;
  }
}

export function getRecentScans(limit: number = 10) {
  try {
    const stmt = db.prepare('SELECT domain, scanned_at FROM scans ORDER BY scanned_at DESC LIMIT ?');
    return stmt.all(limit) as { domain: string, scanned_at: string }[];
  } catch (error) {
    console.error('Failed to retrieve recent scans:', error);
    return [];
  }
}

export function getTrendsData() {
  try {
    // Fetch up to the last 1000 scans to aggregate trends
    const stmt = db.prepare('SELECT scan_data FROM scans ORDER BY scanned_at DESC LIMIT 1000');
    const rows = stmt.all() as { scan_data: string }[];

    const techCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    let totalScans = rows.length;

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
      } catch (e) {
        // Ignore parsing errors for individual rows
      }
    });

    // Convert to sorted arrays
    const topTechnologies = Object.entries(techCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);

    const topCategories = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return {
      totalScans,
      topTechnologies,
      topCategories
    };
  } catch (error) {
    console.error('Failed to aggregate trends data:', error);
    return { totalScans: 0, topTechnologies: [], topCategories: [] };
  }
}

export function getUserScans(userId: string, limit: number = 50) {
  try {
    const stmt = db.prepare('SELECT id, domain, scanned_at FROM scans WHERE user_id = ? ORDER BY scanned_at DESC LIMIT ?');
    return stmt.all(userId, limit) as { id: number, domain: string, scanned_at: string }[];
  } catch (error) {
    console.error('Failed to retrieve user scans:', error);
    return [];
  }
}

export function getLeaderboard() {
  try {
    const stmt = db.prepare(`
      SELECT domain, COUNT(*) as scan_count, MAX(scanned_at) as last_scanned
      FROM scans
      GROUP BY domain
      ORDER BY scan_count DESC
      LIMIT 25
    `);
    return stmt.all() as { domain: string, scan_count: number, last_scanned: string }[];
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    return [];
  }
}

export function getPublicReport(domain: string) {
  try {
    const stmt = db.prepare('SELECT scan_data, scanned_at FROM scans WHERE domain = ? ORDER BY scanned_at DESC LIMIT 1');
    const result = stmt.get(domain) as { scan_data: string, scanned_at: string } | undefined;
    if (result) {
      return {
        data: JSON.parse(result.scan_data),
        scannedAt: result.scanned_at
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get public report:', error);
    return null;
  }
}

export function getScanHistory(domain: string, limit: number = 20) {
  try {
    const stmt = db.prepare('SELECT scan_data, scanned_at FROM scans WHERE domain = ? ORDER BY scanned_at DESC LIMIT ?');
    return stmt.all(domain, limit) as { scan_data: string, scanned_at: string }[];
  } catch (error) {
    console.error('Failed to retrieve scan history:', error);
    return [];
  }
}

export function getTechAggregation(techName: string) {
  try {
    const stmt = db.prepare('SELECT scan_data, domain FROM scans ORDER BY scanned_at DESC LIMIT 2000');
    const rows = stmt.all() as { scan_data: string, domain: string }[];

    const domains: string[] = [];
    const companions: Record<string, number> = {};
    const perfScores: number[] = [];

    rows.forEach(row => {
      try {
        const data = JSON.parse(row.scan_data);
        const techs: string[] = (data.technologies || []).map((t: any) => t.name);
        if (!techs.includes(techName)) return;

        domains.push(row.domain);
        techs.filter(t => t !== techName).forEach(t => {
          companions[t] = (companions[t] || 0) + 1;
        });
        if (data.performance?.score != null) {
          perfScores.push(data.performance.score);
        }
      } catch {}
    });

    const topCompanions = Object.entries(companions)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const avgPerf = perfScores.length > 0
      ? Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
      : null;

    return {
      totalSites: domains.length,
      uniqueDomains: [...new Set(domains)].length,
      topCompanions,
      avgPerformance: avgPerf,
      perfDistribution: perfScores,
    };
  } catch (error) {
    console.error('Failed to aggregate tech data:', error);
    return { totalSites: 0, uniqueDomains: 0, topCompanions: [], avgPerformance: null, perfDistribution: [] };
  }
}

export default db;
