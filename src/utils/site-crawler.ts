/**
 * Site Crawler — follows internal links up to N pages, building a page map
 * with SEO health data per page (title, description, word count, status, issues).
 */

import { fetchPage } from './scraper';
import * as cheerio from 'cheerio';

const MAX_PAGES = 30;
const CRAWL_DELAY_MS = 300;

export interface CrawledPage {
  url: string;
  statusCode: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  h1: string | null;
  h1Count: number;
  wordCount: number;
  imageCount: number;
  imagesWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
  loadTimeMs: number;
  issues: string[];
}

export interface CrawlResult {
  domain: string;
  pagesFound: number;
  pagesCrawled: number;
  pages: CrawledPage[];
  siteIssues: { issue: string; count: number; severity: 'error' | 'warning' | 'info' }[];
  summary: {
    avgWordCount: number;
    avgLoadTimeMs: number;
    totalIssues: number;
    healthPercent: number;
  };
}

function extractInternalUrls($: cheerio.CheerioAPI, baseUrl: URL): string[] {
  const urls = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    try {
      const resolved = new URL(href, baseUrl.origin);
      if (resolved.hostname === baseUrl.hostname) {
        resolved.hash = '';
        resolved.search = '';
        const clean = resolved.href.replace(/\/$/, '');
        if (!clean.match(/\.(pdf|zip|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|ico)$/i)) {
          urls.add(clean);
        }
      }
    } catch { }
  });
  return [...urls];
}

function analyzePage(html: string, url: string, statusCode: number, loadTimeMs: number): CrawledPage {
  const $ = cheerio.load(html);
  const issues: string[] = [];

  const title = $('title').text().trim() || null;
  const description = $('meta[name="description"]').attr('content')?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const h1s = $('h1');
  const h1 = h1s.first().text().trim() || null;
  const h1Count = h1s.length;

  $('script, style, noscript, svg').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  const images = $('img');
  const imageCount = images.length;
  let imagesWithoutAlt = 0;
  images.each((_, el) => {
    if (!$(el).attr('alt')?.trim()) imagesWithoutAlt++;
  });

  const allLinks = $('a[href]');
  let internalLinks = 0;
  let externalLinks = 0;
  try {
    const baseHost = new URL(url).hostname;
    allLinks.each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      try {
        const resolved = new URL(href, url);
        if (resolved.hostname === baseHost) internalLinks++;
        else externalLinks++;
      } catch { }
    });
  } catch { }

  // Issues
  if (!title) issues.push('Missing <title> tag');
  else if (title.length < 15) issues.push('Title too short (< 15 chars)');
  else if (title.length > 70) issues.push('Title too long (> 70 chars)');

  if (!description) issues.push('Missing meta description');
  else if (description.length < 50) issues.push('Meta description too short');
  else if (description.length > 160) issues.push('Meta description too long');

  if (h1Count === 0) issues.push('Missing H1 heading');
  else if (h1Count > 1) issues.push(`Multiple H1 tags (${h1Count})`);

  if (wordCount < 100) issues.push('Thin content (< 100 words)');
  if (imagesWithoutAlt > 0) issues.push(`${imagesWithoutAlt} image(s) missing alt text`);
  if (loadTimeMs > 3000) issues.push(`Slow page load (${(loadTimeMs / 1000).toFixed(1)}s)`);
  if (!canonical) issues.push('Missing canonical URL');

  return {
    url, statusCode, title, description, canonical,
    h1, h1Count, wordCount, imageCount, imagesWithoutAlt,
    internalLinks, externalLinks, loadTimeMs, issues,
  };
}

export async function crawlSite(domain: string, maxPages: number = MAX_PAGES): Promise<CrawlResult> {
  const startUrl = `https://${domain}`;
  const baseUrl = new URL(startUrl);
  const visited = new Set<string>();
  const queue: string[] = [startUrl.replace(/\/$/, '')];
  const pages: CrawledPage[] = [];

  const effectiveMax = Math.min(maxPages, MAX_PAGES);

  while (queue.length > 0 && visited.size < effectiveMax) {
    const url = queue.shift()!;
    const normalizedUrl = url.replace(/\/$/, '');
    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);

    try {
      const start = Date.now();
      const { html, statusCode } = await fetchPage(url);
      const loadTimeMs = Date.now() - start;

      const page = analyzePage(html, url, statusCode, loadTimeMs);
      pages.push(page);

      if (statusCode < 400) {
        const $ = cheerio.load(html);
        const discovered = extractInternalUrls($, baseUrl);
        discovered.forEach(u => {
          const norm = u.replace(/\/$/, '');
          if (!visited.has(norm) && !queue.includes(norm)) queue.push(norm);
        });
      }

      if (visited.size < effectiveMax) {
        await new Promise(r => setTimeout(r, CRAWL_DELAY_MS));
      }
    } catch {
      pages.push({
        url, statusCode: 0, title: null, description: null, canonical: null,
        h1: null, h1Count: 0, wordCount: 0, imageCount: 0, imagesWithoutAlt: 0,
        internalLinks: 0, externalLinks: 0, loadTimeMs: 0, issues: ['Failed to fetch page'],
      });
    }
  }

  // Aggregate issues
  const issueCounts = new Map<string, number>();
  pages.forEach(p => p.issues.forEach(i => {
    const key = i.replace(/\d+/g, 'N').replace(/\(.*\)/, '');
    issueCounts.set(key, (issueCounts.get(key) || 0) + 1);
  }));

  const siteIssues = [...issueCounts.entries()]
    .map(([issue, count]) => {
      const severity: 'error' | 'warning' | 'info' =
        issue.includes('Missing <title>') || issue.includes('Missing H') ? 'error' :
        issue.includes('Thin content') || issue.includes('Slow') ? 'warning' : 'info';
      return { issue, count, severity };
    })
    .sort((a, b) => b.count - a.count);

  const totalIssues = pages.reduce((s, p) => s + p.issues.length, 0);
  const avgWordCount = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + p.wordCount, 0) / pages.length) : 0;
  const avgLoadTimeMs = pages.length > 0 ? Math.round(pages.reduce((s, p) => s + p.loadTimeMs, 0) / pages.length) : 0;
  const maxIssues = pages.length * 8;
  const healthPercent = maxIssues > 0 ? Math.round(((maxIssues - totalIssues) / maxIssues) * 100) : 100;

  return {
    domain,
    pagesFound: visited.size + queue.length,
    pagesCrawled: pages.length,
    pages,
    siteIssues,
    summary: { avgWordCount, avgLoadTimeMs, totalIssues, healthPercent },
  };
}
