import Database from 'better-sqlite3';
import { join } from 'node:path';

// Store DB in the project root for persistence across dev reloads
const dbPath = join(process.cwd(), 'siteintelica_scans.db');
const db = new Database(dbPath, { verbose: console.log });

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

// Try to patch existing databases with the new webhook_url column if it doesn't exist
try {
  db.exec('ALTER TABLE user ADD COLUMN webhook_url TEXT');
} catch (e) {
  // Ignore, likely already exists
}

export function saveScan(domain: string, data: any) {
  try {
    const stmt = db.prepare('INSERT INTO scans (domain, scan_data) VALUES (?, ?)');
    stmt.run(domain, JSON.stringify(data));
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
    // Join scans with a user lookup — for now we match by the domain being scanned while logged in.
    // A future upgrade could add a user_id column to scans.
    const stmt = db.prepare('SELECT id, domain, scanned_at FROM scans ORDER BY scanned_at DESC LIMIT ?');
    return stmt.all(limit) as { id: number, domain: string, scanned_at: string }[];
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

export default db;
