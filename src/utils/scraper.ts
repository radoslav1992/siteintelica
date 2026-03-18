/**
 * Smart Scraper — general-purpose URL scraping engine.
 * Extracts structured data, text, links, images, emails, phones, social profiles,
 * meta tags, Open Graph, JSON-LD, and custom CSS selectors.
 */

import * as cheerio from 'cheerio';

const FETCH_TIMEOUT_MS = 15000;
const MAX_BODY_SIZE = 5 * 1024 * 1024;

const BROWSER_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
];

const BROWSER_HEADERS: Record<string, string> = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  twitter: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/,
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9\-]+)/,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/([a-zA-Z0-9.\-]+)/,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/,
  github: /https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9\-]+)/,
  youtube: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|channel\/|c\/)([a-zA-Z0-9\-_]+)/,
};

export interface ScrapeResult {
  url: string;
  statusCode: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  language: string | null;
  meta: Record<string, string>;
  openGraph: Record<string, string>;
  jsonLd: any[];
  headings: { level: number; text: string }[];
  links: { href: string; text: string; isExternal: boolean }[];
  images: { src: string; alt: string; width?: string; height?: string }[];
  emails: string[];
  phones: string[];
  socialProfiles: Record<string, string>;
  text: string;
  wordCount: number;
  customSelectors?: Record<string, string[]>;
  fetchedAt: string;
}

export async function fetchPage(url: string): Promise<{ html: string; statusCode: number; headers: Record<string, string> }> {
  const ua = BROWSER_UAS[Math.floor(Math.random() * BROWSER_UAS.length)];
  const parsedUrl = new URL(url);

  const requestHeaders: Record<string, string> = {
    ...BROWSER_HEADERS,
    'User-Agent': ua,
    'Host': parsedUrl.host,
    'Referer': `${parsedUrl.protocol}//${parsedUrl.host}/`,
  };

  // Attempt 1: full browser headers
  let res = await fetch(url, {
    headers: requestHeaders,
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  // Attempt 2: if blocked, try Google cache as fallback
  if (res.status === 403 || res.status === 429) {
    try {
      const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
      const cacheRes = await fetch(cacheUrl, {
        headers: { 'User-Agent': ua, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (cacheRes.ok) {
        res = cacheRes;
      }
    } catch { }
  }

  // Attempt 3: if still blocked, try archive.org's latest snapshot
  if (res.status === 403 || res.status === 429) {
    try {
      const archiveUrl = `https://web.archive.org/web/2024/${url}`;
      const archiveRes = await fetch(archiveUrl, {
        headers: { 'User-Agent': ua, 'Accept': 'text/html' },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (archiveRes.ok) {
        res = archiveRes;
      }
    } catch { }
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    throw new Error('Response too large');
  }

  const html = await res.text();
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { headers[k] = v; });

  return { html, statusCode: res.status, headers };
}

export function scrapeHtml(html: string, url: string, statusCode: number, selectors?: Record<string, string>): ScrapeResult {
  const $ = cheerio.load(html);
  const baseUrl = new URL(url);

  const resolveUrl = (href: string | undefined): string => {
    if (!href) return '';
    try { return new URL(href, url).href; } catch { return href; }
  };

  // Meta tags
  const meta: Record<string, string> = {};
  $('meta[name], meta[property]').each((_, el) => {
    const key = $(el).attr('name') || $(el).attr('property') || '';
    const content = $(el).attr('content') || '';
    if (key && content) meta[key] = content;
  });

  // Open Graph
  const openGraph: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property')?.replace('og:', '') || '';
    const content = $(el).attr('content') || '';
    if (prop && content) openGraph[prop] = content;
  });

  // JSON-LD
  const jsonLd: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try { jsonLd.push(JSON.parse($(el).html() || '')); } catch { }
  });

  // Headings
  const headings: ScrapeResult['headings'] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = parseInt(el.tagName.replace('h', ''));
    const text = $(el).text().trim();
    if (text) headings.push({ level, text });
  });

  // Links
  const links: ScrapeResult['links'] = [];
  const seenHrefs = new Set<string>();
  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href') || '';
    if (rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
    const href = resolveUrl(rawHref);
    if (seenHrefs.has(href)) return;
    seenHrefs.add(href);
    const text = $(el).text().trim().substring(0, 200);
    const isExternal = !href.includes(baseUrl.hostname);
    links.push({ href, text, isExternal });
  });

  // Images
  const images: ScrapeResult['images'] = [];
  $('img[src]').each((_, el) => {
    const src = resolveUrl($(el).attr('src'));
    if (!src) return;
    images.push({
      src,
      alt: $(el).attr('alt') || '',
      width: $(el).attr('width') || undefined,
      height: $(el).attr('height') || undefined,
    });
  });

  // Emails
  const bodyText = $('body').text();
  const hrefEmails = $('a[href^="mailto:"]').map((_, el) => $(el).attr('href')?.replace('mailto:', '').split('?')[0]).get();
  const textEmails = bodyText.match(EMAIL_REGEX) || [];
  const emails = [...new Set([...hrefEmails, ...textEmails])].filter(e => !e.includes('.png') && !e.includes('.jpg') && !e.includes('.svg'));

  // Phones
  const hrefPhones = $('a[href^="tel:"]').map((_, el) => $(el).attr('href')?.replace('tel:', '')).get();
  const textPhones = bodyText.match(PHONE_REGEX) || [];
  const phones = [...new Set([...hrefPhones, ...textPhones.map(p => p.trim())])].filter(p => p.length >= 7 && p.length <= 20);

  // Social profiles
  const socialProfiles: Record<string, string> = {};
  const allHrefs = $('a[href]').map((_, el) => $(el).attr('href') || '').get().join(' ') + ' ' + html;
  Object.entries(SOCIAL_PATTERNS).forEach(([platform, regex]) => {
    const match = allHrefs.match(regex);
    if (match) socialProfiles[platform] = match[0];
  });

  // Clean text
  $('script, style, noscript, svg, iframe').remove();
  const text = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 50000);
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  // Custom CSS selectors
  let customSelectors: Record<string, string[]> | undefined;
  if (selectors && Object.keys(selectors).length > 0) {
    customSelectors = {};
    const $fresh = cheerio.load(html);
    Object.entries(selectors).forEach(([name, selector]) => {
      try {
        const results: string[] = [];
        $fresh(selector).each((_, el) => {
          results.push($fresh(el).text().trim());
        });
        customSelectors![name] = results;
      } catch {
        customSelectors![name] = [`Error: invalid selector "${selector}"`];
      }
    });
  }

  return {
    url,
    statusCode,
    title: $('title').text().trim() || null,
    description: meta['description'] || null,
    canonical: $('link[rel="canonical"]').attr('href') || null,
    language: $('html').attr('lang') || null,
    meta,
    openGraph,
    jsonLd,
    headings,
    links,
    images,
    emails,
    phones,
    socialProfiles,
    text,
    wordCount,
    customSelectors,
    fetchedAt: new Date().toISOString(),
  };
}

export async function smartScrape(url: string, selectors?: Record<string, string>): Promise<ScrapeResult> {
  const { html, statusCode } = await fetchPage(url);
  return scrapeHtml(html, url, statusCode, selectors);
}
