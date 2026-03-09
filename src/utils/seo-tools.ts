/**
 * Ahrefs-style SEO analysis utilities.
 * All functions take a URL/domain and return structured data.
 */

interface RobotsTxtResult {
    found: boolean;
    rules: { userAgent: string; directives: string[] }[];
    sitemaps: string[];
    raw: string;
}

interface SitemapResult {
    found: boolean;
    urlCount: number;
    urls: string[];
}

interface RedirectHop {
    url: string;
    status: number;
}

interface SEOAudit {
    headings: { tag: string; text: string }[];
    h1Count: number;
    imagesTotal: number;
    imagesMissingAlt: number;
    ogTags: Record<string, string>;
    twitterTags: Record<string, string>;
    canonical: string | null;
    lang: string | null;
    viewport: boolean;
}

interface ReadabilityResult {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
    fleschScore: number;
    gradeLevel: string;
}

interface OutboundLink {
    href: string;
    domain: string;
    text: string;
}

// ── robots.txt & Sitemap ──
export async function fetchRobotsTxt(domain: string): Promise<RobotsTxtResult> {
    try {
        const res = await fetch(`https://${domain}/robots.txt`, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'SiteIntelica Bot/1.0' }
        });
        if (!res.ok) return { found: false, rules: [], sitemaps: [], raw: '' };

        const text = await res.text();
        const rules: RobotsTxtResult['rules'] = [];
        const sitemaps: string[] = [];
        let currentAgent = '*';
        const directives: string[] = [];

        for (const line of text.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;

            if (trimmed.toLowerCase().startsWith('user-agent:')) {
                if (directives.length > 0) {
                    rules.push({ userAgent: currentAgent, directives: [...directives] });
                    directives.length = 0;
                }
                currentAgent = trimmed.split(':').slice(1).join(':').trim();
            } else if (trimmed.toLowerCase().startsWith('sitemap:')) {
                sitemaps.push(trimmed.split(':').slice(1).join(':').trim());
            } else {
                directives.push(trimmed);
            }
        }
        if (directives.length > 0) {
            rules.push({ userAgent: currentAgent, directives });
        }

        return { found: true, rules, sitemaps, raw: text.substring(0, 2000) };
    } catch {
        return { found: false, rules: [], sitemaps: [], raw: '' };
    }
}

export async function fetchSitemap(domain: string, sitemapUrl?: string): Promise<SitemapResult> {
    try {
        const url = sitemapUrl || `https://${domain}/sitemap.xml`;
        const res = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'SiteIntelica Bot/1.0' }
        });
        if (!res.ok) return { found: false, urlCount: 0, urls: [] };

        const text = await res.text();
        const locMatches = text.match(/<loc>(.*?)<\/loc>/gi) || [];
        const urls = locMatches.map(m => m.replace(/<\/?loc>/gi, '')).slice(0, 100);

        return { found: true, urlCount: locMatches.length, urls };
    } catch {
        return { found: false, urlCount: 0, urls: [] };
    }
}

// ── Redirect Chain ──
export async function followRedirects(url: string): Promise<RedirectHop[]> {
    const chain: RedirectHop[] = [];
    let current = url;
    const maxHops = 10;

    for (let i = 0; i < maxHops; i++) {
        try {
            const res = await fetch(current, {
                redirect: 'manual',
                signal: AbortSignal.timeout(5000),
                headers: { 'User-Agent': 'SiteIntelica Bot/1.0' }
            });
            chain.push({ url: current, status: res.status });

            if (res.status >= 300 && res.status < 400) {
                const location = res.headers.get('location');
                if (!location) break;
                current = location.startsWith('http') ? location : new URL(location, current).href;
            } else {
                break;
            }
        } catch {
            chain.push({ url: current, status: 0 });
            break;
        }
    }

    return chain;
}

// ── On-Page SEO Audit (from HTML string) ──
export function auditSEO(html: string): SEOAudit {
    const headings: SEOAudit['headings'] = [];
    const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = headingRegex.exec(html)) !== null) {
        headings.push({ tag: match[1].toUpperCase(), text: match[2].replace(/<[^>]*>/g, '').trim().substring(0, 100) });
    }

    const h1Count = headings.filter(h => h.tag === 'H1').length;

    // Images
    const imgRegex = /<img[^>]*>/gi;
    const imgs = html.match(imgRegex) || [];
    const imagesTotal = imgs.length;
    const imagesMissingAlt = imgs.filter(i => !i.includes('alt=') || /alt=["']\s*["']/i.test(i)).length;

    // Open Graph
    const ogTags: Record<string, string> = {};
    const ogRegex = /<meta[^>]+property=["']og:([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
    while ((match = ogRegex.exec(html)) !== null) {
        ogTags[match[1]] = match[2];
    }

    // Twitter Cards
    const twitterTags: Record<string, string> = {};
    const twRegex = /<meta[^>]+name=["']twitter:([^"']+)["'][^>]+content=["']([^"']*)["']/gi;
    while ((match = twRegex.exec(html)) !== null) {
        twitterTags[match[1]] = match[2];
    }

    // Canonical
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
    const canonical = canonicalMatch ? canonicalMatch[1] : null;

    // Lang
    const langMatch = html.match(/<html[^>]+lang=["']([^"']*)["']/i);
    const lang = langMatch ? langMatch[1] : null;

    // Viewport
    const viewport = /meta[^>]+name=["']viewport["']/i.test(html);

    return { headings: headings.slice(0, 30), h1Count, imagesTotal, imagesMissingAlt, ogTags, twitterTags, canonical, lang, viewport };
}

// ── Content Readability ──
export function analyzeReadability(html: string): ReadabilityResult {
    // Strip HTML to get plain text
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const sentenceCount = Math.max(sentences.length, 1);
    const avgWordsPerSentence = Math.round((wordCount / sentenceCount) * 10) / 10;

    // Syllable estimation (simplified)
    const syllableCount = words.reduce((total, word) => {
        const w = word.toLowerCase().replace(/[^a-z]/g, '');
        if (w.length <= 3) return total + 1;
        let count = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g)?.length || 1;
        return total + Math.max(count, 1);
    }, 0);

    // Flesch Reading Ease
    const fleschScore = Math.round(206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount));

    let gradeLevel: string;
    if (fleschScore >= 90) gradeLevel = 'Very Easy (5th Grade)';
    else if (fleschScore >= 80) gradeLevel = 'Easy (6th Grade)';
    else if (fleschScore >= 70) gradeLevel = 'Fairly Easy (7th Grade)';
    else if (fleschScore >= 60) gradeLevel = 'Standard (8-9th Grade)';
    else if (fleschScore >= 50) gradeLevel = 'Fairly Difficult (10-12th)';
    else if (fleschScore >= 30) gradeLevel = 'Difficult (College)';
    else gradeLevel = 'Very Difficult (Graduate)';

    return { wordCount, sentenceCount, avgWordsPerSentence, fleschScore: Math.max(0, Math.min(100, fleschScore)), gradeLevel };
}

// ── Outbound Link Extraction ──
export function extractOutboundLinks(html: string, sourceDomain: string): OutboundLink[] {
    const linkRegex = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const links: OutboundLink[] = [];
    const seen = new Set<string>();
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
        try {
            const href = match[1];
            const domain = new URL(href).hostname;
            if (domain === sourceDomain || domain === 'www.' + sourceDomain || sourceDomain === 'www.' + domain) continue;
            if (seen.has(domain)) continue;
            seen.add(domain);

            const text = match[2].replace(/<[^>]*>/g, '').trim().substring(0, 60) || domain;
            links.push({ href, domain, text });
        } catch {
            // Invalid URL, skip
        }
    }

    return links.slice(0, 50);
}

// ── Broken Link Checker ──
export async function checkBrokenLinks(html: string, baseUrl: string): Promise<{ url: string; status: number; broken: boolean }[]> {
    const linkRegex = /href=["'](https?:\/\/[^"']+)["']/gi;
    const urls = new Set<string>();
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
        urls.add(match[1]);
    }

    // Also check relative links
    const relRegex = /href=["'](\/[^"']+)["']/gi;
    while ((match = relRegex.exec(html)) !== null) {
        try {
            urls.add(new URL(match[1], baseUrl).href);
        } catch { }
    }

    // Check up to 20 links to avoid excessive requests
    const toCheck = [...urls].slice(0, 20);
    const results: { url: string; status: number; broken: boolean }[] = [];

    const checks = toCheck.map(async (url) => {
        try {
            const res = await fetch(url, {
                method: 'HEAD',
                signal: AbortSignal.timeout(4000),
                redirect: 'follow',
                headers: { 'User-Agent': 'SiteIntelica Bot/1.0' }
            });
            return { url, status: res.status, broken: res.status >= 400 };
        } catch {
            return { url, status: 0, broken: true };
        }
    });

    // Run 5 at a time to be polite
    for (let i = 0; i < checks.length; i += 5) {
        const batch = checks.slice(i, i + 5);
        const batchResults = await Promise.allSettled(batch);
        batchResults.forEach(r => {
            if (r.status === 'fulfilled') results.push(r.value);
        });
    }

    return results;
}

// ── Structured Data / Schema.org Validator ──
export function extractStructuredData(html: string): { jsonLd: any[]; microdata: string[]; totalSchemas: number } {
    const jsonLd: any[] = [];
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            if (Array.isArray(parsed)) {
                parsed.forEach(item => jsonLd.push({ type: item['@type'] || 'Unknown', data: item }));
            } else {
                jsonLd.push({ type: parsed['@type'] || 'Unknown', data: parsed });
            }
        } catch { }
    }

    // Microdata (itemtype attributes)
    const microdata: string[] = [];
    const microdataRegex = /itemtype=["'](https?:\/\/schema\.org\/[^"']+)["']/gi;
    while ((match = microdataRegex.exec(html)) !== null) {
        if (!microdata.includes(match[1])) microdata.push(match[1]);
    }

    return { jsonLd, microdata, totalSchemas: jsonLd.length + microdata.length };
}

// ── Social Media Profile Detector ──
export function extractSocialProfiles(html: string): { platform: string; url: string; handle?: string }[] {
    const profiles: { platform: string; url: string; handle?: string }[] = [];
    const seen = new Set<string>();

    const platforms: { name: string; pattern: RegExp; handleExtract?: RegExp }[] = [
        { name: 'Twitter / X', pattern: /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]+/g, handleExtract: /\/(twitter|x)\.com\/([a-zA-Z0-9_]+)/ },
        { name: 'LinkedIn', pattern: /https?:\/\/(www\.)?linkedin\.com\/(company|in)\/[a-zA-Z0-9_-]+/g },
        { name: 'GitHub', pattern: /https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9_-]+/g, handleExtract: /github\.com\/([a-zA-Z0-9_-]+)/ },
        { name: 'Instagram', pattern: /https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]+/g, handleExtract: /instagram\.com\/([a-zA-Z0-9_.]+)/ },
        { name: 'YouTube', pattern: /https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)[a-zA-Z0-9_-]+/g },
        { name: 'Facebook', pattern: /https?:\/\/(www\.)?facebook\.com\/[a-zA-Z0-9.]+/g },
        { name: 'TikTok', pattern: /https?:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+/g },
        { name: 'Discord', pattern: /https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9]+/g },
        { name: 'Mastodon', pattern: /https?:\/\/[a-zA-Z0-9.-]+\/@[a-zA-Z0-9_]+/g },
    ];

    for (const p of platforms) {
        const matches = html.match(p.pattern) || [];
        for (const url of matches) {
            const key = p.name;
            if (seen.has(key)) continue;
            seen.add(key);
            let handle: string | undefined;
            if (p.handleExtract) {
                const hm = url.match(p.handleExtract);
                if (hm) handle = '@' + (hm[2] || hm[1]);
            }
            profiles.push({ platform: p.name, url, handle });
        }
    }

    return profiles;
}

// ── Cookie & GDPR Scanner ──
export async function scanCookies(url: string): Promise<{
    cookies: { name: string; domain: string; secure: boolean; httpOnly: boolean; sameSite: string }[];
    consentBanner: { detected: boolean; provider: string | null };
    issues: string[];
}> {
    const cookies: { name: string; domain: string; secure: boolean; httpOnly: boolean; sameSite: string }[] = [];
    let consentProvider: string | null = null;
    const issues: string[] = [];

    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'SiteIntelica Bot/1.0' },
            redirect: 'follow'
        });

        // Parse set-cookie headers
        const setCookieHeaders = res.headers.getSetCookie?.() || [];
        for (const header of setCookieHeaders) {
            const parts = header.split(';').map(p => p.trim());
            const [nameVal] = parts;
            const [name] = nameVal.split('=');
            const domain = parts.find(p => p.toLowerCase().startsWith('domain='))?.split('=')[1] || '';
            const secure = parts.some(p => p.toLowerCase() === 'secure');
            const httpOnly = parts.some(p => p.toLowerCase() === 'httponly');
            const sameSitePart = parts.find(p => p.toLowerCase().startsWith('samesite='));
            const sameSite = sameSitePart?.split('=')[1] || 'None';

            cookies.push({ name: name.trim(), domain, secure, httpOnly, sameSite });

            if (!secure) issues.push(`Cookie "${name.trim()}" missing Secure flag`);
            if (!httpOnly && !name.trim().startsWith('_ga')) issues.push(`Cookie "${name.trim()}" missing HttpOnly flag`);
        }

        // Check HTML for consent banners
        const html = await res.text();
        const consentPatterns: { name: string; pattern: RegExp }[] = [
            { name: 'OneTrust', pattern: /onetrust|optanon/i },
            { name: 'CookieBot', pattern: /cookiebot|CookieDeclaration/i },
            { name: 'CookieYes', pattern: /cookie-law-info|cookieyes/i },
            { name: 'Osano', pattern: /osano\.com/i },
            { name: 'TrustArc', pattern: /trustarc|truste/i },
            { name: 'Quantcast', pattern: /quantcast.*choice|__cmpapi/i },
            { name: 'Didomi', pattern: /didomi/i },
            { name: 'iubenda', pattern: /iubenda/i },
            { name: 'Cookie Notice', pattern: /cookie-notice|cookie-consent|gdpr-cookie/i },
        ];
        for (const cp of consentPatterns) {
            if (cp.pattern.test(html)) { consentProvider = cp.name; break; }
        }

        if (!consentProvider) issues.push('No cookie consent banner detected — may violate GDPR/CCPA');
        if (cookies.length > 0 && !consentProvider) issues.push('Cookies set before user consent');

    } catch (e) {
        issues.push('Failed to scan cookies');
    }

    return {
        cookies,
        consentBanner: { detected: !!consentProvider, provider: consentProvider },
        issues
    };
}
