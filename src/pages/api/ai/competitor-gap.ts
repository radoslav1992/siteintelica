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
        const { domainA, domainB } = await context.request.json();
        if (!domainA || !domainB) {
            return new Response(JSON.stringify({ error: "Both domains are required." }), {
                status: 400, headers: { 'Content-Type': 'application/json' }
            });
        }

        const reportA = getPublicReport(domainA);
        const reportB = getPublicReport(domainB);

        if (!reportA || !reportB) {
            return new Response(JSON.stringify({ error: "Both domains must be scanned first." }), {
                status: 404, headers: { 'Content-Type': 'application/json' }
            });
        }

        const dataA = reportA.data;
        const dataB = reportB.data;
        const gradeA = calculateSecurityGrade(dataA.security);
        const gradeB = calculateSecurityGrade(dataB.security);
        const techsA = (dataA.technologies || []).map((t: any) => t.name);
        const techsB = (dataB.technologies || []).map((t: any) => t.name);

        const prompt = `You are a competitive intelligence analyst. Compare these two websites and explain why one might outrank the other in search results.

SITE A: ${domainA}
- Technologies: ${techsA.join(', ')}
- Security Grade: ${gradeA.grade} (${gradeA.score}/100)
- Performance Score: ${dataA.performance?.score ?? dataA.performance?.performanceScore ?? 'unknown'}/100
- SEO Score: ${dataA.performance?.seo ?? dataA.performance?.seoScore ?? 'unknown'}/100
- Meta Description: ${dataA.seo?.description?.substring(0, 100) || 'None'}
- Word Count: ${dataA.readability?.wordCount ?? 'unknown'}
- Has Sitemap: ${dataA.sitemapData?.found ? 'Yes' : 'No'}
- Has robots.txt: ${dataA.robotsTxt?.found ? 'Yes' : 'No'}

SITE B: ${domainB}
- Technologies: ${techsB.join(', ')}
- Security Grade: ${gradeB.grade} (${gradeB.score}/100)
- Performance Score: ${dataB.performance?.score ?? dataB.performance?.performanceScore ?? 'unknown'}/100
- SEO Score: ${dataB.performance?.seo ?? dataB.performance?.seoScore ?? 'unknown'}/100
- Meta Description: ${dataB.seo?.description?.substring(0, 100) || 'None'}
- Word Count: ${dataB.readability?.wordCount ?? 'unknown'}
- Has Sitemap: ${dataB.sitemapData?.found ? 'Yes' : 'No'}
- Has robots.txt: ${dataB.robotsTxt?.found ? 'Yes' : 'No'}

Write a competitive gap analysis with these sections:
## Winner Prediction
Which site likely ranks higher and why (1-2 sentences).

## Key Advantages: ${domainA}
Bullet points of what ${domainA} does better.

## Key Advantages: ${domainB}
Bullet points of what ${domainB} does better.

## Actionable Gaps
Specific things the weaker site should do to catch up.

Keep it under 400 words, data-driven, and professional.`;

        const aiResult = await askGemini(prompt);

        if (aiResult) {
            return new Response(JSON.stringify({ analysis: aiResult }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        // Local fallback
        const perfA = dataA.performance?.score ?? dataA.performance?.performanceScore ?? 0;
        const perfB = dataB.performance?.score ?? dataB.performance?.performanceScore ?? 0;
        const winner = gradeA.score + perfA > gradeB.score + perfB ? domainA : domainB;

        const fallback = `## Competitor Gap Analysis\n\n` +
            `**Predicted winner:** ${winner}\n\n` +
            `### ${domainA}\n- Security: ${gradeA.grade} | Performance: ${perfA}/100 | ${techsA.length} technologies\n\n` +
            `### ${domainB}\n- Security: ${gradeB.grade} | Performance: ${perfB}/100 | ${techsB.length} technologies\n\n` +
            `---\n*Set GEMINI_API_KEY for a full AI-powered competitive gap analysis.*`;

        return new Response(JSON.stringify({ analysis: fallback }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Gap analysis failed.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};
