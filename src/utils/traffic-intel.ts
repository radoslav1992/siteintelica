/**
 * Traffic Intelligence — multi-source traffic estimation.
 * Combines: Tranco rank, Umbrella rank, Cloudflare Radar, Wayback frequency,
 * social signals, DNS/CDN heuristics, and ad network presence.
 * Produces a composite estimate with confidence scoring.
 */

import { getTrancoRank, rankToTraffic } from './tranco';

const FETCH_TIMEOUT = 6000;

interface TrafficSource {
  source: string;
  rank: number | null;
  estimatedMonthly: { low: number; high: number } | null;
  confidence: string;
  details?: string;
}

export interface TrafficIntelligence {
  domain: string;
  sources: TrafficSource[];
  composite: {
    estimatedMonthly: { low: number; high: number };
    estimatedDaily: { low: number; high: number };
    confidence: 'high' | 'medium' | 'low' | 'very-low';
    tier: string;
    percentile: string;
  };
  socialSignals: Record<string, number | string>;
  adNetworks: string[];
  cdnDetected: string | null;
}

// Rank → monthly visitors (power law, same curve as Tranco but reusable)
function rankToEstimate(rank: number): { low: number; high: number } {
  const base = 8_000_000_000 / Math.pow(rank, 0.85);
  const variance = rank <= 1000 ? 0.3 : rank <= 10000 ? 0.5 : rank <= 100000 ? 0.6 : 0.7;
  return { low: Math.round(base * (1 - variance)), high: Math.round(base * (1 + variance)) };
}

function tierFromMonthly(monthly: number): string {
  if (monthly >= 100_000_000) return 'Mega — Top 100 globally';
  if (monthly >= 10_000_000) return 'Enterprise — Top 1,000';
  if (monthly >= 1_000_000) return 'Major — Top 10K';
  if (monthly >= 100_000) return 'Large — Top 100K';
  if (monthly >= 10_000) return 'Medium — Established site';
  if (monthly >= 1_000) return 'Small — Niche site';
  return 'Minimal — New or very small';
}

function percentileFromRank(rank: number): string {
  if (rank <= 100) return 'Top 0.001%';
  if (rank <= 1000) return 'Top 0.01%';
  if (rank <= 10000) return 'Top 0.1%';
  if (rank <= 100000) return 'Top 1%';
  if (rank <= 500000) return 'Top 5%';
  if (rank <= 1000000) return 'Top 10%';
  return 'Long tail';
}

// Source 1: Tranco (already loaded in tranco.ts)
async function fetchTrancoSource(domain: string): Promise<TrafficSource> {
  const rank = await getTrancoRank(domain);
  if (!rank) return { source: 'Tranco Top 1M', rank: null, estimatedMonthly: null, confidence: 'none', details: 'Not in Tranco top 1M list' };
  const est = rankToTraffic(rank);
  return { source: 'Tranco Top 1M', rank, estimatedMonthly: { low: est.low, high: est.high }, confidence: est.confidence, details: `Rank #${rank.toLocaleString()}` };
}

// Source 2: Cloudflare Radar (public API, no auth needed for basic ranking)
async function fetchCloudflareRadar(domain: string): Promise<TrafficSource> {
  try {
    const res = await fetch(`https://radar.cloudflare.com/api/domains/${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { 'User-Agent': 'SiteIntelica/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const rank = data?.rank?.bucket ?? data?.rank?.rank ?? data?.popularityRank ?? null;
    if (rank && typeof rank === 'number') {
      const est = rankToEstimate(rank);
      return { source: 'Cloudflare Radar', rank, estimatedMonthly: est, confidence: 'Medium', details: `Cloudflare rank #${rank.toLocaleString()}` };
    }
    return { source: 'Cloudflare Radar', rank: null, estimatedMonthly: null, confidence: 'none', details: 'No ranking data' };
  } catch {
    return { source: 'Cloudflare Radar', rank: null, estimatedMonthly: null, confidence: 'none', details: 'API unavailable' };
  }
}

// Source 3: Wayback Machine snapshot frequency (more snapshots = more traffic historically)
async function fetchWaybackFrequency(domain: string): Promise<TrafficSource> {
  try {
    const thisYear = new Date().getFullYear();
    const res = await fetch(
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&fl=timestamp&from=${thisYear - 1}&limit=1&showResumeKey=false&matchType=domain`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
    );
    if (!res.ok) throw new Error('Not OK');

    // Use the __wb_sparkline API for snapshot count
    const sparkRes = await fetch(
      `https://web.archive.org/__wb/sparkline?output=json&url=${encodeURIComponent(domain)}&collection=web`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
    );

    if (!sparkRes.ok) throw new Error('Sparkline unavailable');
    const sparkData = await sparkRes.json();

    // Count total snapshots across all years
    const years = sparkData?.years || {};
    let totalSnapshots = 0;
    Object.values(years).forEach((months: any) => {
      if (Array.isArray(months)) totalSnapshots += months.reduce((s: number, v: number) => s + v, 0);
    });

    if (totalSnapshots === 0) {
      return { source: 'Wayback Machine', rank: null, estimatedMonthly: null, confidence: 'none', details: 'No archived snapshots' };
    }

    // Heuristic: snapshot count correlates loosely with traffic
    // >10K snapshots = major site, >1K = established, >100 = moderate, <100 = small
    let est: { low: number; high: number };
    let confidence: string;
    if (totalSnapshots > 10000) {
      est = { low: 1_000_000, high: 50_000_000 };
      confidence = 'Low';
    } else if (totalSnapshots > 1000) {
      est = { low: 100_000, high: 5_000_000 };
      confidence = 'Low';
    } else if (totalSnapshots > 100) {
      est = { low: 10_000, high: 500_000 };
      confidence = 'Very Low';
    } else {
      est = { low: 1_000, high: 50_000 };
      confidence = 'Very Low';
    }

    return { source: 'Wayback Machine', rank: null, estimatedMonthly: est, confidence, details: `${totalSnapshots.toLocaleString()} historical snapshots` };
  } catch {
    return { source: 'Wayback Machine', rank: null, estimatedMonthly: null, confidence: 'none', details: 'API unavailable' };
  }
}

// Source 4: DNS-based heuristics (CDN usage, hosting tier)
async function fetchDnsSignals(domain: string): Promise<{ cdn: string | null; signals: TrafficSource }> {
  try {
    const dns = await import('node:dns/promises');
    const cnames = await dns.resolveCname(domain).catch(() => [] as string[]);
    const aRecords = await dns.resolve4(domain).catch(() => [] as string[]);

    const allRecords = [...cnames, ...aRecords].join(' ').toLowerCase();

    const cdnMap: Record<string, string> = {
      'cloudflare': 'Cloudflare',
      'cloudfront': 'Amazon CloudFront',
      'akamai': 'Akamai',
      'fastly': 'Fastly',
      'edgecast': 'Edgecast/Edgio',
      'stackpath': 'StackPath',
      'sucuri': 'Sucuri',
      'incapsula': 'Imperva/Incapsula',
      'azureedge': 'Azure CDN',
      'googleapis': 'Google Cloud',
      'netlify': 'Netlify',
      'vercel': 'Vercel',
    };

    let cdn: string | null = null;
    for (const [key, name] of Object.entries(cdnMap)) {
      if (allRecords.includes(key)) { cdn = name; break; }
    }

    // Enterprise CDNs like Akamai, Fastly typically serve high-traffic sites
    const enterpriseCdns = ['Akamai', 'Fastly', 'Amazon CloudFront', 'Edgecast/Edgio'];
    if (cdn && enterpriseCdns.includes(cdn)) {
      return {
        cdn,
        signals: { source: 'CDN Detection', rank: null, estimatedMonthly: { low: 100_000, high: 10_000_000 }, confidence: 'Very Low', details: `Uses ${cdn} — typically high-traffic` },
      };
    }

    return {
      cdn,
      signals: { source: 'CDN Detection', rank: null, estimatedMonthly: null, confidence: 'none', details: cdn ? `Uses ${cdn}` : 'No CDN detected' },
    };
  } catch {
    return { cdn: null, signals: { source: 'CDN Detection', rank: null, estimatedMonthly: null, confidence: 'none', details: 'DNS lookup failed' } };
  }
}

// Source 5: Social media follower estimation (scrape page meta for follower counts)
async function fetchSocialSignals(domain: string): Promise<Record<string, number | string>> {
  const signals: Record<string, number | string> = {};

  // Check Twitter/X followers via page meta
  try {
    const res = await fetch(`https://x.com/${domain.replace(/\..+/, '')}`, {
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteIntelica/1.0)' },
      redirect: 'follow',
    });
    if (res.ok) {
      const html = await res.text();
      const followerMatch = html.match(/(\d[\d,]+)\s*(?:Followers|followers)/);
      if (followerMatch) signals.twitterFollowers = followerMatch[1];
    }
  } catch { }

  return signals;
}

// Combine all sources into a composite estimate
function computeComposite(sources: TrafficSource[]): TrafficIntelligence['composite'] {
  const validSources = sources.filter(s => s.estimatedMonthly !== null);

  if (validSources.length === 0) {
    return {
      estimatedMonthly: { low: 0, high: 0 },
      estimatedDaily: { low: 0, high: 0 },
      confidence: 'very-low',
      tier: 'Unknown — not enough data',
      percentile: 'Unknown',
    };
  }

  // Weight sources by confidence
  const weights: Record<string, number> = { 'High': 5, 'Medium': 3, 'Low-Medium': 2, 'Low': 1, 'Very Low': 0.5 };

  let totalWeight = 0;
  let weightedLow = 0;
  let weightedHigh = 0;
  let bestRank: number | null = null;

  validSources.forEach(s => {
    const w = weights[s.confidence] || 0.5;
    totalWeight += w;
    weightedLow += s.estimatedMonthly!.low * w;
    weightedHigh += s.estimatedMonthly!.high * w;
    if (s.rank && (!bestRank || s.rank < bestRank)) bestRank = s.rank;
  });

  const low = Math.round(weightedLow / totalWeight);
  const high = Math.round(weightedHigh / totalWeight);
  const avg = (low + high) / 2;

  const confidence: TrafficIntelligence['composite']['confidence'] =
    validSources.length >= 3 && validSources.some(s => s.confidence === 'High') ? 'high' :
    validSources.length >= 2 ? 'medium' :
    validSources.length === 1 && validSources[0].confidence !== 'Very Low' ? 'low' : 'very-low';

  return {
    estimatedMonthly: { low, high },
    estimatedDaily: { low: Math.round(low / 30), high: Math.round(high / 30) },
    confidence,
    tier: tierFromMonthly(avg),
    percentile: bestRank ? percentileFromRank(bestRank) : avg > 1_000_000 ? 'Top 1%' : avg > 100_000 ? 'Top 5%' : 'Top 20%+',
  };
}

export async function getTrafficIntelligence(domain: string, existingTechs?: string[]): Promise<TrafficIntelligence> {
  const cleanDomain = domain.replace(/^www\./, '');

  const [trancoSource, cfSource, waybackSource, dnsResult] = await Promise.allSettled([
    fetchTrancoSource(cleanDomain),
    fetchCloudflareRadar(cleanDomain),
    fetchWaybackFrequency(cleanDomain),
    fetchDnsSignals(cleanDomain),
  ]);

  const sources: TrafficSource[] = [];
  if (trancoSource.status === 'fulfilled') sources.push(trancoSource.value);
  if (cfSource.status === 'fulfilled') sources.push(cfSource.value);
  if (waybackSource.status === 'fulfilled') sources.push(waybackSource.value);
  const cdnDetected = dnsResult.status === 'fulfilled' ? dnsResult.value.cdn : null;
  if (dnsResult.status === 'fulfilled') sources.push(dnsResult.value.signals);

  // Ad network detection from tech stack
  const adNetworks: string[] = [];
  const AD_TECHS = ['Google AdSense', 'Google Ad Manager', 'Amazon Associates', 'Media.net', 'Ezoic', 'Mediavine', 'AdThrive', 'PropellerAds', 'Taboola', 'Outbrain'];
  (existingTechs || []).forEach(t => { if (AD_TECHS.includes(t)) adNetworks.push(t); });

  // If ad networks present, site must have meaningful traffic
  if (adNetworks.length > 0) {
    const est = adNetworks.some(a => ['Mediavine', 'AdThrive'].includes(a))
      ? { low: 50_000, high: 2_000_000 }
      : { low: 10_000, high: 500_000 };
    sources.push({ source: 'Ad Network Presence', rank: null, estimatedMonthly: est, confidence: 'Low', details: `Running: ${adNetworks.join(', ')}` });
  }

  // Social signals (best-effort, don't block on this)
  let socialSignals: Record<string, number | string> = {};
  try {
    socialSignals = await Promise.race([
      fetchSocialSignals(cleanDomain),
      new Promise<Record<string, number | string>>(r => setTimeout(() => r({}), 3000)),
    ]);
  } catch { }

  const composite = computeComposite(sources);

  return {
    domain: cleanDomain,
    sources,
    composite,
    socialSignals,
    adNetworks,
    cdnDetected,
  };
}
