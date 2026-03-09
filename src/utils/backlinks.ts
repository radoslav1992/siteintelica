/**
 * Backlink estimation via the CommonCrawl Index API and Open PageRank.
 * Both are free; CommonCrawl gives referring domain count, Open PageRank gives a 0-10 score.
 */

const COMMONCRAWL_INDEX = 'https://index.commoncrawl.org/CC-MAIN-2025-08-index';
const OPEN_PAGERANK_API = 'https://openpagerank.com/api/v1.0/getPageRank';
const FETCH_TIMEOUT = 8000;

export interface BacklinkData {
  referringDomains: number;
  sampleLinks: { from: string; to: string }[];
  pageRank: number | null;
  pageRankSource: string;
}

export async function estimateBacklinks(domain: string, openPageRankKey?: string): Promise<BacklinkData> {
  const result: BacklinkData = {
    referringDomains: 0,
    sampleLinks: [],
    pageRank: null,
    pageRankSource: 'Open PageRank',
  };

  const [ccResult, prResult] = await Promise.allSettled([
    fetchCommonCrawlLinks(domain),
    fetchOpenPageRank(domain, openPageRankKey),
  ]);

  if (ccResult.status === 'fulfilled') {
    result.referringDomains = ccResult.value.referringDomains;
    result.sampleLinks = ccResult.value.sampleLinks;
  }

  if (prResult.status === 'fulfilled' && prResult.value !== null) {
    result.pageRank = prResult.value;
  }

  return result;
}

async function fetchCommonCrawlLinks(domain: string): Promise<{ referringDomains: number; sampleLinks: { from: string; to: string }[] }> {
  try {
    const params = new URLSearchParams({
      url: `*.${domain}`,
      output: 'json',
      limit: '50',
      fl: 'url,filename',
    });

    const res = await fetch(`${COMMONCRAWL_INDEX}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) return { referringDomains: 0, sampleLinks: [] };

    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    const domains = new Set<string>();
    const samples: { from: string; to: string }[] = [];

    lines.forEach(line => {
      try {
        const record = JSON.parse(line);
        const fromUrl = record.url || '';
        const fromDomain = new URL(fromUrl).hostname;
        if (fromDomain && fromDomain !== domain && !fromDomain.endsWith(`.${domain}`)) {
          domains.add(fromDomain);
          if (samples.length < 10) {
            samples.push({ from: fromDomain, to: domain });
          }
        }
      } catch {}
    });

    return { referringDomains: domains.size, sampleLinks: samples };
  } catch {
    return { referringDomains: 0, sampleLinks: [] };
  }
}

async function fetchOpenPageRank(domain: string, apiKey?: string): Promise<number | null> {
  const key = apiKey || process.env.OPEN_PAGERANK_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${OPEN_PAGERANK_API}?domains[]=${encodeURIComponent(domain)}`, {
      headers: { 'API-OPR': key },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const entry = data?.response?.[0];
    if (entry && entry.page_rank_decimal != null) {
      return Math.round(entry.page_rank_decimal * 10) / 10;
    }
    return null;
  } catch {
    return null;
  }
}
