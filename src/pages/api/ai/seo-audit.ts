import type { APIRoute } from 'astro';
import { getPublicReport } from '../../../db/client';
import { calculateSecurityGrade } from '../../../utils/security-grade';
import { askGemini } from '../../../utils/gemini';

export const prerender = false;

export const POST: APIRoute = async (context) => {
    const user = context.locals.user;
    if (!user) {
        return new Response(JSON.stringify({ error: "Premium account required." }), {
            status: 401, headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const { domain } = await context.request.json();
        if (!domain) {
            return new Response(JSON.stringify({ error: "Domain is required." }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const report = getPublicReport(domain);
        if (!report) {
            return new Response(JSON.stringify({ error: "No scan data found. Scan the site first." }), {
                status: 404, headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = report.data;
        const secGrade = calculateSecurityGrade(data.security);
        const seoAudit = data.seoAudit;
        const readability = data.readability;
        const robotsTxt = data.robotsTxt;
        const sitemapData = data.sitemapData;
        const brokenLinks = data.brokenLinks;
        const outboundLinks = data.outboundLinks;
        const perf = data.performance;

        const prompt = `You are a senior SEO consultant. Provide a comprehensive, actionable SEO report for "${domain}".

Here is the full audit data:

SECURITY: Grade ${secGrade.grade} (${secGrade.score}/100). Issues: ${secGrade.recommendations.slice(0, 3).join('; ') || 'None'}

SEO AUDIT:
- H1 tags: ${seoAudit?.h1Count ?? 'unknown'}
- Total images: ${seoAudit?.imagesTotal ?? 'unknown'}, missing alt: ${seoAudit?.imagesMissingAlt ?? 'unknown'}
- Open Graph tags: ${seoAudit ? Object.keys(seoAudit.ogTags).length : 'unknown'}
- Twitter Card tags: ${seoAudit ? Object.keys(seoAudit.twitterTags).length : 'unknown'}
- Canonical URL: ${seoAudit?.canonical ? 'Set' : 'Missing'}
- Viewport meta: ${seoAudit?.viewport ? 'Present' : 'Missing'}
- HTML lang: ${seoAudit?.lang || 'Missing'}

CONTENT:
- Title: ${data.seo?.title || 'None'}
- Meta description: ${data.seo?.description || 'None'}
- Word count: ${readability?.wordCount ?? 'unknown'}
- Readability score: ${readability?.fleschScore ?? 'unknown'}/100 (${readability?.gradeLevel || 'unknown'})

CRAWLABILITY:
- robots.txt: ${robotsTxt?.found ? 'Found' : 'Missing'}
- Sitemap: ${sitemapData?.found ? `Found (${sitemapData.urlCount} URLs)` : 'Missing'}

PERFORMANCE: ${perf?.performanceScore ?? 'unknown'}/100
SEO SCORE: ${perf?.seoScore ?? 'unknown'}/100

LINKS:
- Outbound links: ${outboundLinks?.length ?? 0} unique external domains
- Broken links: ${brokenLinks ? brokenLinks.filter((l: any) => l.broken).length : 0} out of ${brokenLinks?.length ?? 0} checked

Write a structured report with these sections:
## Overall SEO Score
Give an estimated A-F grade and explain why.

## Critical Issues (Fix Immediately)
List the most urgent problems.

## Opportunities (Quick Wins)
List easy improvements that would boost rankings.

## Content Strategy Recommendations
Advice on content quality and readability.

## Technical SEO Recommendations
Specific fixes for crawlability, performance, and security.

Keep it under 500 words, professional, and data-driven.`;

        const aiResult = await askGemini(prompt);

        if (aiResult) {
            return new Response(JSON.stringify({ report: aiResult }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        // Local fallback
        const issues: string[] = [];
        if (!seoAudit?.canonical) issues.push('Missing canonical URL — risk of duplicate content penalties');
        if (seoAudit?.h1Count !== 1) issues.push(`H1 tag count is ${seoAudit?.h1Count ?? 0} (should be exactly 1)`);
        if (seoAudit?.imagesMissingAlt > 0) issues.push(`${seoAudit.imagesMissingAlt} images lack alt text — hurts accessibility and image SEO`);
        if (!robotsTxt?.found) issues.push('No robots.txt — search engines may crawl unintended pages');
        if (!sitemapData?.found) issues.push('No sitemap.xml — impairs crawl discovery');
        if (Object.keys(seoAudit?.ogTags || {}).length === 0) issues.push('No Open Graph tags — poor social media sharing');
        if (secGrade.score < 50) issues.push(`Security grade is ${secGrade.grade} — add HSTS, CSP headers`);

        const fallback = `## SEO Scorecard for ${domain}\n\n` +
            `### Issues Found: ${issues.length}\n\n` +
            issues.map((i, idx) => `${idx + 1}. ⚠️ ${i}`).join('\n') +
            `\n\n---\n*Set GEMINI_API_KEY for a full AI-powered SEO report.*`;

        return new Response(JSON.stringify({ report: fallback }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'SEO audit failed.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};
