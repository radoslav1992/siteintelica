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
`);

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

export default db;
