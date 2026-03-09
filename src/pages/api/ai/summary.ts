import type { APIRoute } from 'astro';
import { getPublicReport } from '../../../db/client';
import { calculateSecurityGrade } from '../../../utils/security-grade';

export const prerender = false;

export const POST: APIRoute = async (context) => {
    const user = context.locals.user;
    if (!user) {
        return new Response(JSON.stringify({ error: "Premium account required for AI features." }), {
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
        const cats = (data.technologies || []).flatMap((t: any) => (t.categories || []).map((c: any) => c.name));
        const uniqueCats = [...new Set(cats)].join(', ');
        const secGrade = calculateSecurityGrade(data.security);
        const keywords = (data.keywords || []).slice(0, 10).map((k: any) => k.word).join(', ');
        const seoTitle = data.seo?.title || '';
        const seoDesc = data.seo?.description || '';
        const socials = (data.socials || []).join(', ');
        const perf = data.performance;

        // Build a structured executive summary without external API
        // When ready, replace this block with an OpenAI/Gemini API call
        const summary = generateLocalSummary(domain, techs, uniqueCats, secGrade, keywords, seoTitle, seoDesc, socials, perf);

        return new Response(JSON.stringify({ summary }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'AI Summary failed.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};

function generateLocalSummary(
    domain: string, techs: string, categories: string, security: any,
    keywords: string, seoTitle: string, seoDesc: string, socials: string, perf: any
): string {
    const perfLine = perf?.performanceScore != null
        ? `Performance is rated ${perf.performanceScore}/100 by Google Lighthouse.`
        : '';

    const secLine = `Security posture receives a grade of **${security.grade}** (${security.score}/100).` +
        (security.recommendations.length > 0
            ? ` Key gaps: ${security.recommendations.slice(0, 2).join(' ')}`
            : ' All critical headers are properly configured.');

    return `## Executive Summary for ${domain}\n\n` +
        `**${domain}** ${seoDesc ? `describes itself as: "${seoDesc.substring(0, 150)}"` : 'has no meta description set.'}\n\n` +
        `### Technology Stack\n` +
        `The site is built using **${techs || 'undetected technologies'}**, spanning categories: ${categories || 'unknown'}.\n\n` +
        `### Security & Performance\n` +
        `${secLine} ${perfLine}\n\n` +
        `### Content Focus\n` +
        `Top keywords on the page: **${keywords || 'none detected'}**.\n\n` +
        `### Social Presence\n` +
        `${socials ? `Active on: ${socials}` : 'No social media links detected.'}\n\n` +
        `---\n*This is a locally generated summary. Connect an OpenAI or Gemini API key to unlock AI-powered SWOT analysis and deeper competitive insights.*`;
}
