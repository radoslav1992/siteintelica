/**
 * Business Intelligence Calculators v2
 * Uses Tranco ranking for traffic when available, falls back to tech-weighted heuristics.
 */
import { rankToTraffic } from './tranco';

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

// ── Enterprise signals: companies using these have massive traffic ──
const ENTERPRISE_SIGNALS: Record<string, number> = {
    // Payment/fintech (millions of visitors)
    'Stripe': 8, 'PayPal': 8, 'Adyen': 7, 'Braintree': 7,
    // Enterprise CDNs
    'Akamai': 7, 'Fastly': 6, 'Amazon CloudFront': 6,
    // Enterprise tools
    'Salesforce': 6, 'Optimizely': 6, 'LaunchDarkly': 6,
    'Segment': 6, 'Datadog': 6, 'New Relic': 5,
    // Marketing at scale
    'HubSpot': 5, 'Marketo': 7, 'Adobe Analytics': 7,
    'Google Analytics': 2, 'Google Tag Manager': 2,
    // E-commerce
    'Shopify Plus': 7, 'Magento': 5, 'BigCommerce': 4,
    // Large frameworks (indicate engineering investment)
    'React': 3, 'Next.js': 3, 'Angular': 3, 'Vue.js': 3,
};

// ── Hosting tiers by tech signals ──
const HOSTING_TIERS = [
    {
        signals: ['Akamai', 'Fastly', 'Amazon CloudFront', 'AWS', 'Amazon Web Services'],
        tier: 'Enterprise Cloud', min: 5000, max: 100000
    },
    {
        signals: ['Google Cloud', 'Azure', 'Amazon S3'],
        tier: 'Cloud Platform', min: 1000, max: 50000
    },
    {
        signals: ['Cloudflare', 'Heroku', 'DigitalOcean'],
        tier: 'Cloud / Managed', min: 50, max: 2000
    },
    {
        signals: ['Vercel', 'Netlify', 'Render'],
        tier: 'Serverless / JAMstack', min: 0, max: 100
    },
    {
        signals: ['Wix', 'Squarespace', 'Webflow'],
        tier: 'Website Builder', min: 15, max: 160
    },
];

export interface BusinessMetrics {
    estimatedMonthlyVisitors: { low: number; high: number; confidence: string };
    techStackCost: { totalMin: number; totalMax: number; breakdown: { name: string; min: number; max: number; label: string }[] };
    carbonFootprint: { grams: number; trees: number; rating: string };
    domainAuthority: { score: number; factors: { name: string; score: number; max: number }[] };
    hostingCost: { min: number; max: number; provider: string };
    adRevenueEstimate: { monthlyMin: number; monthlyMax: number; networks: string[] } | null;
}

export function calculateBusinessMetrics(data: any, trancoRank: number | null = null): BusinessMetrics {
    const techs: string[] = (data.technologies || []).map((t: any) => t.name);
    const perfScore = data.performance?.score ?? data.performance?.performanceScore ?? 50;
    const seoScore = data.performance?.seo ?? data.performance?.seoScore ?? 50;
    const secGrade = data.securityGrade;
    const sitemapCount = data.sitemapData?.urlCount ?? 0;
    const readability = data.readability;
    const seoAudit = data.seoAudit;

    // Prefer Tranco-based traffic; fall back to tech heuristics
    const trafficEstimate = trancoRank
        ? rankToTraffic(trancoRank)
        : estimateTraffic(perfScore, seoScore, sitemapCount, techs, readability);

    return {
        estimatedMonthlyVisitors: trafficEstimate,
        techStackCost: calculateTechCost(techs),
        carbonFootprint: estimateCarbon(perfScore, trafficEstimate),
        domainAuthority: calculateDomainAuthority(perfScore, seoScore, secGrade, seoAudit, sitemapCount, techs),
        hostingCost: estimateHostingCost(techs, trafficEstimate),
        adRevenueEstimate: estimateAdRevenue(techs, data.trackers, trafficEstimate)
    };
}

function estimateTraffic(perfScore: number, seoScore: number, sitemapUrls: number, techs: string[], readability: any): BusinessMetrics['estimatedMonthlyVisitors'] {
    // 1. Calculate enterprise score from tech stack
    let enterpriseScore = 0;
    techs.forEach(t => {
        enterpriseScore += (ENTERPRISE_SIGNALS[t] || 0);
    });

    // 2. Tech stack complexity as a scale signal
    const techCount = techs.length;

    // 3. Determine traffic tier based on signals
    let baseLow: number, baseHigh: number;
    let confidence: string;

    if (enterpriseScore >= 20) {
        // Massive enterprise (Stripe, Amazon, etc.) - millions
        baseLow = 5_000_000;
        baseHigh = 50_000_000;
        confidence = 'Medium';
    } else if (enterpriseScore >= 12) {
        // Large company - hundreds of thousands to millions
        baseLow = 500_000;
        baseHigh = 10_000_000;
        confidence = 'Medium';
    } else if (enterpriseScore >= 6) {
        // Mid-market - tens of thousands to hundreds of thousands
        baseLow = 50_000;
        baseHigh = 1_000_000;
        confidence = 'Low-Medium';
    } else if (techCount >= 15) {
        // Many technologies = significant site
        baseLow = 20_000;
        baseHigh = 500_000;
        confidence = 'Low-Medium';
    } else if (techCount >= 8) {
        // Moderate complexity
        baseLow = 5_000;
        baseHigh = 100_000;
        confidence = 'Low';
    } else if (techCount >= 4) {
        // Small-medium site
        baseLow = 1_000;
        baseHigh = 30_000;
        confidence = 'Low';
    } else {
        // Minimal tech stack
        baseLow = 100;
        baseHigh = 5_000;
        confidence = 'Low';
    }

    // 4. Boost from sitemap (more pages = more traffic)
    if (sitemapUrls > 1000) {
        baseLow *= 3;
        baseHigh *= 3;
        if (confidence === 'Low') confidence = 'Low-Medium';
    } else if (sitemapUrls > 100) {
        baseLow *= 1.5;
        baseHigh *= 1.5;
    }

    // 5. Performance/SEO quality multiplier
    const qualityMult = ((perfScore / 100) * 0.5 + (seoScore / 100) * 0.5) * 0.5 + 0.75;
    baseLow = Math.round(baseLow * qualityMult);
    baseHigh = Math.round(baseHigh * qualityMult);

    // 6. Content volume boost
    const wordCount = readability?.wordCount ?? 0;
    if (wordCount > 5000) {
        baseLow = Math.round(baseLow * 1.3);
        baseHigh = Math.round(baseHigh * 1.3);
    }

    return { low: baseLow, high: baseHigh, confidence };
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

    breakdown.sort((a, b) => b.max - a.max);
    return { totalMin, totalMax, breakdown: breakdown.slice(0, 10) };
}

function estimateCarbon(perfScore: number, traffic: BusinessMetrics['estimatedMonthlyVisitors']): BusinessMetrics['carbonFootprint'] {
    const estimatedWeight = perfScore >= 80 ? 1.2 : perfScore >= 50 ? 2.0 : 3.5;
    const co2PerView = (estimatedWeight / 2.0) * 1.76; // grams

    const avgMonthly = (traffic.low + traffic.high) / 2;
    const monthlyKg = (co2PerView * avgMonthly) / 1000;
    const yearlyKg = monthlyKg * 12;
    const trees = Math.max(1, Math.round(yearlyKg / 21));

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

    const perfPts = Math.round((perfScore / 100) * 25);
    factors.push({ name: 'Performance', score: perfPts, max: 25 });
    total += perfPts;

    const seoPts = Math.round((seoScore / 100) * 25);
    factors.push({ name: 'SEO', score: seoPts, max: 25 });
    total += seoPts;

    const secScore = secGrade?.score ?? 0;
    const secPts = Math.round((secScore / 100) * 20);
    factors.push({ name: 'Security', score: secPts, max: 20 });
    total += secPts;

    let contentPts = 0;
    if (seoAudit?.h1Count === 1) contentPts += 5;
    if (seoAudit?.canonical) contentPts += 3;
    if (seoAudit?.viewport) contentPts += 2;
    if (seoAudit?.lang) contentPts += 2;
    if (Object.keys(seoAudit?.ogTags || {}).length > 0) contentPts += 3;
    factors.push({ name: 'Content Quality', score: Math.min(contentPts, 15), max: 15 });
    total += Math.min(contentPts, 15);

    let crawlPts = 0;
    if (sitemapCount > 0) crawlPts += 8;
    if (sitemapCount > 50) crawlPts += 4;
    if (techs.some(t => ['Cloudflare', 'Fastly', 'Amazon CloudFront'].includes(t))) crawlPts += 3;
    factors.push({ name: 'Crawlability', score: Math.min(crawlPts, 15), max: 15 });
    total += Math.min(crawlPts, 15);

    return { score: Math.min(total, 100), factors };
}

function estimateHostingCost(techs: string[], traffic: BusinessMetrics['estimatedMonthlyVisitors']): BusinessMetrics['hostingCost'] {
    // 1. Detect hosting tier from tech stack
    for (const tier of HOSTING_TIERS) {
        if (techs.some(t => tier.signals.includes(t))) {
            // Scale within the tier based on estimated traffic
            const avgTraffic = (traffic.low + traffic.high) / 2;
            let scaleFactor = 1;
            if (avgTraffic > 10_000_000) scaleFactor = 5;
            else if (avgTraffic > 1_000_000) scaleFactor = 3;
            else if (avgTraffic > 100_000) scaleFactor = 1.5;

            return {
                min: Math.round(tier.min * scaleFactor),
                max: Math.round(tier.max * scaleFactor),
                provider: tier.tier
            };
        }
    }

    // Fallback: estimate from traffic volume
    const avgTraffic = (traffic.low + traffic.high) / 2;
    if (avgTraffic > 1_000_000) return { min: 2000, max: 20000, provider: 'Enterprise (estimated)' };
    if (avgTraffic > 100_000) return { min: 200, max: 2000, provider: 'Cloud (estimated)' };
    if (avgTraffic > 10_000) return { min: 20, max: 200, provider: 'Managed hosting (estimated)' };
    return { min: 5, max: 50, provider: 'Shared hosting (estimated)' };
}

function estimateAdRevenue(techs: string[], trackers: any, traffic: BusinessMetrics['estimatedMonthlyVisitors']): BusinessMetrics['adRevenueEstimate'] | null {
    const adNetworks: string[] = [];
    const adTechs = ['Google AdSense', 'Google Ad Manager', 'Amazon Associates', 'Media.net', 'Ezoic', 'Mediavine', 'AdThrive', 'PropellerAds'];
    techs.forEach(t => { if (adTechs.includes(t)) adNetworks.push(t); });
    if (trackers && Array.isArray(trackers)) {
        trackers.forEach((t: any) => {
            if (t.name && ['Facebook Pixel', 'Google Ads', 'TikTok Pixel'].includes(t.name)) adNetworks.push(t.name);
        });
    }
    if (adNetworks.length === 0) return null;

    const avgTraffic = (traffic.low + traffic.high) / 2;
    const monthlyMin = Math.round(avgTraffic * 1 / 1000);
    const monthlyMax = Math.round(avgTraffic * 5 / 1000);

    return { monthlyMin, monthlyMax, networks: adNetworks };
}
