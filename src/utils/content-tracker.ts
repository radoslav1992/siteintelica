/**
 * Content Change Tracker — monitors specific CSS selectors on a page for text changes.
 * Stores snapshots and computes diffs between them.
 */

import db from '../db/client';
import { fetchPage } from './scraper';
import * as cheerio from 'cheerio';

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS content_watches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      selector TEXT NOT NULL,
      label TEXT,
      last_content TEXT,
      last_checked_at DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(id),
      UNIQUE(user_id, url, selector)
    );
    CREATE TABLE IF NOT EXISTS content_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      watch_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (watch_id) REFERENCES content_watches(id)
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_watch ON content_snapshots(watch_id);
  `);
} catch { }

export interface ContentWatch {
  id: number;
  url: string;
  selector: string;
  label: string | null;
  lastContent: string | null;
  lastCheckedAt: string | null;
}

export interface ContentChange {
  watchId: number;
  url: string;
  selector: string;
  label: string | null;
  previousContent: string;
  currentContent: string;
  changedAt: string;
}

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

export function addContentWatch(userId: string, url: string, selector: string, label?: string): { success: boolean; id?: number; error?: string } {
  try {
    const count = (db.prepare('SELECT COUNT(*) as c FROM content_watches WHERE user_id = ? AND is_active = 1').get(userId) as any)?.c || 0;
    if (count >= 25) return { success: false, error: 'Max 25 active watches' };

    const result = db.prepare('INSERT INTO content_watches (user_id, url, selector, label) VALUES (?, ?, ?, ?)').run(userId, url, selector, label || null);
    return { success: true, id: Number(result.lastInsertRowid) };
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return { success: false, error: 'Already watching this URL + selector' };
    return { success: false, error: e.message };
  }
}

export function removeContentWatch(userId: string, watchId: number): boolean {
  const result = db.prepare('UPDATE content_watches SET is_active = 0 WHERE id = ? AND user_id = ?').run(watchId, userId);
  return result.changes > 0;
}

export function getContentWatches(userId: string): ContentWatch[] {
  return (db.prepare('SELECT id, url, selector, label, last_content, last_checked_at FROM content_watches WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC').all(userId) as any[])
    .map(r => ({
      id: r.id,
      url: r.url,
      selector: r.selector,
      label: r.label,
      lastContent: r.last_content,
      lastCheckedAt: r.last_checked_at,
    }));
}

export function getWatchSnapshots(watchId: number, limit: number = 20): { content: string; capturedAt: string }[] {
  return (db.prepare('SELECT content, captured_at FROM content_snapshots WHERE watch_id = ? ORDER BY captured_at DESC LIMIT ?').all(watchId, limit) as any[])
    .map(r => ({ content: r.content, capturedAt: r.captured_at }));
}

export async function checkContentWatch(watchId: number): Promise<ContentChange | null> {
  const watch = db.prepare('SELECT * FROM content_watches WHERE id = ? AND is_active = 1').get(watchId) as any;
  if (!watch) return null;

  try {
    const { html } = await fetchPage(watch.url);
    const $ = cheerio.load(html);
    const currentContent = $(watch.selector).text().replace(/\s+/g, ' ').trim();
    const hash = simpleHash(currentContent);

    const lastSnapshot = db.prepare('SELECT content_hash FROM content_snapshots WHERE watch_id = ? ORDER BY captured_at DESC LIMIT 1').get(watchId) as any;

    db.prepare('INSERT INTO content_snapshots (watch_id, content, content_hash) VALUES (?, ?, ?)').run(watchId, currentContent, hash);
    db.prepare('UPDATE content_watches SET last_content = ?, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?').run(currentContent, watchId);

    if (lastSnapshot && lastSnapshot.content_hash !== hash) {
      const prevContent = (db.prepare('SELECT content FROM content_snapshots WHERE watch_id = ? ORDER BY captured_at DESC LIMIT 1 OFFSET 1').get(watchId) as any)?.content || '';
      return {
        watchId,
        url: watch.url,
        selector: watch.selector,
        label: watch.label,
        previousContent: prevContent,
        currentContent,
        changedAt: new Date().toISOString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function checkAllWatches(userId: string): Promise<ContentChange[]> {
  const watches = db.prepare('SELECT id FROM content_watches WHERE user_id = ? AND is_active = 1').all(userId) as any[];
  const changes: ContentChange[] = [];

  for (const w of watches) {
    const change = await checkContentWatch(w.id);
    if (change) changes.push(change);
    await new Promise(r => setTimeout(r, 300));
  }

  return changes;
}
