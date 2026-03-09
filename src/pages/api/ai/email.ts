import type { APIRoute } from 'astro';
import { getPublicReport } from '../../../db/client';

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
        const techs = (data.technologies || []).map((t: any) => t.name);
        const emails = (data.contacts?.emails || []).slice(0, 3);
        const seoTitle = data.seo?.title || domain;

        // Generate locally — replace with LLM API call for production
        const email = generateColdEmail(domain, techs, emails, seoTitle);

        return new Response(JSON.stringify({ email }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Email generation failed.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};

function generateColdEmail(domain: string, techs: string[], emails: string[], seoTitle: string): string {
    const hasReact = techs.some(t => ['React', 'Next.js', 'Vue.js', 'Angular'].includes(t));
    const hasWordPress = techs.some(t => t === 'WordPress');
    const hasCDN = techs.some(t => ['Cloudflare', 'Fastly', 'Amazon CloudFront'].includes(t));

    let opener = `Hi there,\n\nI was researching ${domain} and noticed `;

    if (hasWordPress) {
        opener += `you're running on WordPress. `;
    } else if (hasReact) {
        opener += `you're using a modern JavaScript framework (${techs.filter(t => ['React', 'Next.js', 'Vue.js', 'Angular'].includes(t)).join(', ')}). `;
    } else {
        opener += `your tech stack includes ${techs.slice(0, 3).join(', ')}. `;
    }

    let body = '';
    if (!hasCDN) {
        body += `I noticed you don't appear to be using a CDN — this could be a great opportunity to dramatically improve your page load speeds and SEO rankings.\n\n`;
    }

    body += `We specialize in helping companies like yours optimize their web infrastructure for peak performance and security.\n\n`;
    body += `Would you be open to a quick 15-minute call this week to discuss how we could help?\n\n`;
    body += `Best regards,\n[Your Name]\n[Your Company]`;

    const targetEmail = emails.length > 0 ? `\n\n**Suggested recipient:** ${emails[0]}` : '';

    return `**Subject:** Quick question about ${domain}'s tech stack\n\n${opener}${body}${targetEmail}\n\n---\n*Connect an OpenAI API key for fully AI-personalized outreach emails.*`;
}
