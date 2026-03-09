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
            return new Response(JSON.stringify({ error: "No scan data found. Please scan the site first." }), {
                status: 404, headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = report.data;
        const techs = (data.technologies || []).map((t: any) => t.name).join(', ');
        const cats = [...new Set((data.technologies || []).flatMap((t: any) => (t.categories || []).map((c: any) => c.name)))].join(', ');
        const secGrade = calculateSecurityGrade(data.security);
        const keywords = (data.keywords || []).slice(0, 10).map((k: any) => k.word).join(', ');
        const seoDesc = data.seo?.description || 'N/A';
        const socials = (data.socials || []).join(', ') || 'None';
        const perfScore = data.performance?.performanceScore ?? 'N/A';

        // Try Gemini first, fall back to local
        const prompt = `You are a business analyst. Generate a concise executive summary and SWOT analysis for the website "${domain}".

Here is the scan data:
- Technologies: ${techs}
- Categories: ${cats}
- Security Grade: ${secGrade.grade} (${secGrade.score}/100)
- Security Issues: ${secGrade.recommendations.slice(0, 3).join('; ') || 'None'}
- Performance Score: ${perfScore}/100
- Keywords: ${keywords}
- Meta Description: ${seoDesc}
- Social Links: ${socials}

Format your response in markdown with sections:
## Executive Summary
## SWOT Analysis
### Strengths
### Weaknesses
### Opportunities
### Threats

Keep it professional, data-driven, and under 400 words.`;

        const aiResult = await askGemini(prompt);

        if (aiResult) {
            return new Response(JSON.stringify({ summary: aiResult }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        // Local fallback
        const summary = `## Executive Summary for ${domain}\n\n` +
            `**${domain}** uses ${techs || 'undetected technologies'} (${cats || 'unknown categories'}).\n\n` +
            `**Security:** Grade ${secGrade.grade} (${secGrade.score}/100). ${secGrade.recommendations[0] || 'All headers present.'}\n\n` +
            `**Performance:** ${perfScore}/100. **Keywords:** ${keywords || 'N/A'}.\n\n` +
            `**Social:** ${socials}\n\n---\n*Local fallback. Set GEMINI_API_KEY for AI-powered SWOT analysis.*`;

        return new Response(JSON.stringify({ summary }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'AI Summary failed.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};
