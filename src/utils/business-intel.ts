/**
 * Business Intelligence Calculators
 * Derives estimated metrics from scan data without external APIs.
 */

// ── Known SaaS pricing (monthly, USD) ──
const TECH_PRICING: Record<string, { min: number; max: number; label: string }> = {
    'Shopify': { min: 39, max: 399, label: 'E-commerce platform' },
    'Shopify Plus': { min: 2000, max: 2000, label: 'Enterprise e-commerce' },
    'BigCommerce': { min: 39, max: 399, label: 'E-commerce platform' },
    'WooCommerce': { min: 0, max: 30, label: 'E-commerce plugin (hosting extra)' },
    'Magento': { min: 0, max: 2000, label: 'Enterprise e-commerce' },
    'HubSpot': { min: 50, max: 3600, label: 'Marketing automation' },
    'Salesforce': { min: 25, max: 300, label: 'CRM per user' },
    'Intercom': { min: 74, max: 999, label: 'Customer messaging' },
    'Drift': { min: 50, max: 500, label: 'Conversational marketing' },
    'Zendesk': { min: 19, max: 215, label: 'Customer support' },
    'Mailchimp': { min: 0, max: 350, label: 'Email marketing' },
    'Segment': { min: 0, max: 120, label: 'Data pipeline' },
    'Hotjar': { min: 0, max: 99, label: 'Heatmaps & recordings' },
    'Optimizely': { min: 50, max: 2000, label: 'A/B testing' },
    'Cloudflare': { min: 0, max: 200, label: 'CDN & security' },
    'Fastly': { min: 50, max: 500, label: 'CDN' },
    'Amazon CloudFront': { min: 0, max: 100, label: 'CDN (usage-based)' },
    'Akamai': { min: 200, max: 5000, label: 'Enterprise CDN' },
    'Vercel': { min: 0, max: 20, label: 'Hosting & deployment' },
    'Netlify': { min: 0, max: 25, label: 'Hosting & deployment' },
    'WordPress': { min: 0, max: 50, label: 'CMS (hosting extra)' },
    'Contentful': { min: 0, max: 489, label: 'Headless CMS' },
    'Sanity': { min: 0, max: 99, label: 'Headless CMS' },
    'Stripe': { min: 0, max: 0, label: 'Payments (% per transaction)' },
    'Google Analytics': { min: 0, max: 0, label: 'Analytics (free)' },
    'Google Tag Manager': { min: 0, max: 0, label: 'Tag management (free)' },
    'Mixpanel': { min: 0, max: 999, label: 'Product analytics' },
    'Amplitude': { min: 0, max: 995, label: 'Product analytics' },
    'Datadog': { min: 15, max: 500, label: 'Monitoring per host' },
    'New Relic': { min: 0, max: 549, label: 'Observability' },
    'Sentry': { min: 0, max: 80, label: 'Error tracking' },
    'LaunchDarkly': { min: 10, max: 500, label: 'Feature flags' },
    'Auth0': { min: 0, max: 240, label: 'Authentication' },
    'Algolia': { min: 0, max: 900, label: 'Search engine' },
    'Twilio': { min: 0, max: 100, label: 'Communications API' },
    'SendGrid': { min: 0, max: 89, label: 'Transactional email' },
    'Crisp': { min: 0, max: 95, label: 'Live chat' },
    'Tawk.to': { min: 0, max: 0, label: 'Live chat (free)' },
    'LiveChat': { min: 20, max: 69, label: 'Live chat' },
    'Freshdesk': { min: 0, max: 79, label: 'Customer support' },
    'Wix': { min: 17, max: 159, label: 'Website builder' },
    'Squarespace': { min: 16, max: 52, label: 'Website builder' },
    'Webflow': { min: 14, max: 39, label: 'Website builder' },
    'Ghost': { min: 9, max: 199, label: 'Publishing platform' },
};

// ── Hosting cost by server tech ──
const HOSTING_COSTS: Record<string, { min: number; max: number }> = {
    'Vercel': { min: 0, max: 20 },
    'Netlify': { min: 0, max: 25 },
    'AWS': { min: 50, max: 500 },
    'Google Cloud': { min: 50, max: 500 },
    'Azure': { min: 50, max: 500 },
    'Heroku': { min: 7, max: 250 },
    'DigitalOcean': { min: 5, max: 100 },
    'Nginx': { min: 5, max: 50 },
    'Apache': { min: 5, max: 50 },
    'IIS': { min: 20, max: 200 },
};

export interface BusinessMetrics {
    estimatedMonthlyVisitors: { low: number; high: number; confidence: string };
    techStackCost: { totalMin: number; totalMax: number; breakdown: { name: string; min: number; max: number; label: string }[] };
    carbonFootprint: { grams: number; trees: number; rating: string };
    domainAuthority: { score: number; factors: { name: string; score: number; max: number }[] };
    hostingCost: { min: number; max: number; provider: string };
    adRevenueEstimate: { monthlyMin: number; monthlyMax: number; networks: string[] } | null;
}

export function calculateBusinessMetrics(data: any): BusinessMetrics {
    const techs: string[] = (data.technologies || []).map((t: any) => t.name);
    const perfScore = data.performance?.performanceScore ?? 50;
    const seoScore = data.performance?.seoScore ?? 50;
    const secGrade = data.securityGrade;
    const sitemapCount = data.sitemapData?.urlCount ?? 0;
    const readability = data.readability;
    const seoAudit = data.seoAudit;

    return {
        estimatedMonthlyVisitors: estimateTraffic(perfScore, seoScore, sitemapCount, techs, readability),
        techStackCost: calculateTechCost(techs),
        carbonFootprint: estimateCarbon(readability?.wordCount ?? 1000, perfScore),
        domainAuthority: calculateDomainAuthority(perfScore, seoScore, secGrade, seoAudit, sitemapCount, techs),
        hostingCost: estimateHostingCost(techs),
        adRevenueEstimate: estimateAdRevenue(techs, data.trackers, perfScore, seoScore, sitemapCount)
    };
}

function estimateTraffic(perfScore: number, seoScore: number, sitemapUrls: number, techs: string[], readability: any): BusinessMetrics['estimatedMonthlyVisitors'] {
    // Base traffic from content signals
    let base = Math.max(sitemapUrls * 15, 500); // ~15 visits per indexed page/month

    // Performance multiplier (fast sites get more traffic)
    const perfMultiplier = perfScore >= 90 ? 2.5 : perfScore >= 70 ? 1.8 : perfScore >= 50 ? 1.2 : 0.8;

    // SEO multiplier
    const seoMultiplier = seoScore >= 90 ? 2.0 : seoScore >= 70 ? 1.5 : seoScore >= 50 ? 1.1 : 0.7;

    // Tech sophistication bonus (enterprise tools = more traffic)
    const enterpriseTechs = ['Salesforce', 'HubSpot', 'Segment', 'Optimizely', 'Akamai', 'Shopify Plus'];
    const hasEnterprise = techs.some(t => enterpriseTechs.includes(t));
    if (hasEnterprise) base *= 5;

    // E-commerce multiplier
    const isEcommerce = techs.some(t => ['Shopify', 'WooCommerce', 'BigCommerce', 'Magento'].includes(t));
    if (isEcommerce) base *= 3;

    // Content richness
    const wordCount = readability?.wordCount ?? 500;
    if (wordCount > 3000) base *= 1.5;

    const estimated = Math.round(base * perfMultiplier * seoMultiplier);
    const low = Math.round(estimated * 0.5);
    const high = Math.round(estimated * 2);

    let confidence: string;
    if (sitemapUrls > 50 && perfScore > 0) confidence = 'Medium';
    else if (sitemapUrls > 10) confidence = 'Low-Medium';
    else confidence = 'Low';

    return { low, high, confidence };
}

function calculateTechCost(techs: string[]): BusinessMetrics['techStackCost'] {
    const breakdown: { name: string; min: number; max: number; label: string }[] = [];
    let totalMin = 0, totalMax = 0;

    techs.forEach(tech => {
        if (TECH_PRICING[tech]) {
            const p = TECH_PRICING[tech];
            breakdown.push({ name: tech, min: p.min, max: p.max, label: p.label });
            totalMin += p.min;
            totalMax += p.max;
        }
    });

    // Sort by max cost descending
    breakdown.sort((a, b) => b.max - a.max);

    return { totalMin, totalMax, breakdown: breakdown.slice(0, 10) };
}

function estimateCarbon(wordCount: number, perfScore: number): BusinessMetrics['carbonFootprint'] {
    // Average web page = ~1.76g CO2 per view (websitecarbon.com methodology)
    // Adjusted by page weight (approximated from word count + perf)
    const avgPageWeight = 2.0; // MB average
    const estimatedWeight = perfScore >= 80 ? 1.2 : perfScore >= 50 ? 2.0 : 3.5;
    const co2PerView = (estimatedWeight / avgPageWeight) * 1.76; // grams

    // Assume ~1000 monthly page views for the estimate
    const monthlyGrams = Math.round(co2PerView * 1000);
    const yearlyKg = (monthlyGrams * 12) / 1000;
    const trees = Math.max(1, Math.round(yearlyKg / 21)); // 1 tree absorbs ~21kg CO2/year

    let rating: string;
    if (co2PerView <= 1.0) rating = 'Excellent — cleaner than 80% of sites';
    else if (co2PerView <= 1.76) rating = 'Average';
    else if (co2PerView <= 3.0) rating = 'Above Average — consider optimizing';
    else rating = 'High — significant optimization needed';

    return { grams: Math.round(co2PerView * 100) / 100, trees, rating };
}

function calculateDomainAuthority(perfScore: number, seoScore: number, secGrade: any, seoAudit: any, sitemapCount: number, techs: string[]): BusinessMetrics['domainAuthority'] {
    const factors: { name: string; score: number; max: number }[] = [];
    let total = 0;

    // Performance (25 pts)
    const perfPts = Math.round((perfScore / 100) * 25);
    factors.push({ name: 'Performance', score: perfPts, max: 25 });
    total += perfPts;

    // SEO Score (25 pts)
    const seoPts = Math.round((seoScore / 100) * 25);
    factors.push({ name: 'SEO', score: seoPts, max: 25 });
    total += seoPts;

    // Security (20 pts)
    const secScore = secGrade?.score ?? 0;
    const secPts = Math.round((secScore / 100) * 20);
    factors.push({ name: 'Security', score: secPts, max: 20 });
    total += secPts;

    // Content Quality (15 pts)
    let contentPts = 0;
    if (seoAudit?.h1Count === 1) contentPts += 5;
    if (seoAudit?.canonical) contentPts += 3;
    if (seoAudit?.viewport) contentPts += 2;
    if (seoAudit?.lang) contentPts += 2;
    if (Object.keys(seoAudit?.ogTags || {}).length > 0) contentPts += 3;
    factors.push({ name: 'Content Quality', score: Math.min(contentPts, 15), max: 15 });
    total += Math.min(contentPts, 15);

    // Crawlability (15 pts)
    let crawlPts = 0;
    if (sitemapCount > 0) crawlPts += 8;
    if (sitemapCount > 50) crawlPts += 4;
    if (techs.some(t => ['Cloudflare', 'Fastly', 'Amazon CloudFront'].includes(t))) crawlPts += 3;
    factors.push({ name: 'Crawlability', score: Math.min(crawlPts, 15), max: 15 });
    total += Math.min(crawlPts, 15);

    return { score: Math.min(total, 100), factors };
}

function estimateHostingCost(techs: string[]): BusinessMetrics['hostingCost'] {
    for (const tech of techs) {
        if (HOSTING_COSTS[tech]) {
            return { ...HOSTING_COSTS[tech], provider: tech };
        }
    }
    // Default estimate
    return { min: 10, max: 100, provider: 'Unknown' };
}

function estimateAdRevenue(techs: string[], trackers: any, perfScore: number, seoScore: number, sitemapCount: number): BusinessMetrics['adRevenueEstimate'] | null {
    const adNetworks: string[] = [];

    // Check for known ad technologies
    const adTechs = ['Google AdSense', 'Google Ad Manager', 'Amazon Associates', 'Media.net', 'Ezoic', 'Mediavine', 'AdThrive', 'PropellerAds'];
    techs.forEach(t => {
        if (adTechs.includes(t)) adNetworks.push(t);
    });

    // Check trackers for ad-related pixels
    if (trackers && Array.isArray(trackers)) {
        trackers.forEach((t: any) => {
            if (t.name && ['Facebook Pixel', 'Google Ads', 'TikTok Pixel'].includes(t.name)) {
                adNetworks.push(t.name);
            }
        });
    }

    if (adNetworks.length === 0) return null;

    // Estimate traffic first
    const baseTraffic = Math.max(sitemapCount * 15, 500);
    const multiplier = (perfScore / 100 + seoScore / 100) / 2 * 2;
    const estPageViews = Math.round(baseTraffic * multiplier);

    // Average CPM for display ads: $1-5
    const monthlyMin = Math.round(estPageViews * 1 / 1000);
    const monthlyMax = Math.round(estPageViews * 5 / 1000);

    return { monthlyMin, monthlyMax, networks: adNetworks };
}
