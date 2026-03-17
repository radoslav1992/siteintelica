/**
 * Similar Sites Finder — finds domains with the most overlapping tech stacks.
 * Uses Jaccard similarity to rank domains by technology overlap.
 */

import db from '../db/client';

export interface SimilarSite {
  domain: string;
  similarity: number;
  sharedTechs: string[];
  uniqueTechs: string[];
  scannedAt: string;
}

export function findSimilarSites(targetDomain: string, targetTechs: string[], limit: number = 10): SimilarSite[] {
  try {
    const rows = db.prepare(`
      SELECT domain, scan_data, MAX(scanned_at) as scanned_at
      FROM scans
      WHERE domain != ?
      GROUP BY domain
      ORDER BY scanned_at DESC
      LIMIT 500
    `).all(targetDomain) as { domain: string; scan_data: string; scanned_at: string }[];

    const targetSet = new Set(targetTechs.map(t => t.toLowerCase()));
    if (targetSet.size === 0) return [];

    return rows
      .map(row => {
        try {
          const data = JSON.parse(row.scan_data);
          const techs: string[] = (data.technologies || []).map((t: any) => t.name);
          const otherSet = new Set(techs.map(t => t.toLowerCase()));

          const intersection = [...targetSet].filter(t => otherSet.has(t));
          const union = new Set([...targetSet, ...otherSet]);
          const similarity = union.size > 0 ? Math.round((intersection.length / union.size) * 100) : 0;

          if (similarity < 15) return null;

          const sharedTechs = techs.filter(t => targetSet.has(t.toLowerCase()));
          const uniqueTechs = techs.filter(t => !targetSet.has(t.toLowerCase())).slice(0, 8);

          return {
            domain: row.domain,
            similarity,
            sharedTechs,
            uniqueTechs,
            scannedAt: row.scanned_at,
          };
        } catch {
          return null;
        }
      })
      .filter((s): s is SimilarSite => s !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch {
    return [];
  }
}
