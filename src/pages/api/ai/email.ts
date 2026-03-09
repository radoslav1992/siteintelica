import type { APIRoute } from 'astro';
import { getPublicReport } from '../../../db/client';
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
            return new Response(JSON.stringify({ error: "No scan data found." }), {
                status: 404, headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = report.data;
        const techs = (data.technologies || []).map((t: any) => t.name);
        const emails = (data.contacts?.emails || []).slice(0, 3);
        const seoTitle = data.seo?.title || domain;
        const seoDesc = data.seo?.description || '';
        const socials = (data.socials || []).join(', ') || 'None found';

        const prompt = `You are a B2B sales expert. Write a personalized cold outreach email to the company behind "${domain}".

Here is intel from our scan:
- Technologies they use: ${techs.join(', ')}
- Their site title: ${seoTitle}
- Their meta description: ${seoDesc}
- Their social links: ${socials}
${emails.length > 0 ? `- Contact email found: ${emails[0]}` : ''}

Write a short, personalized cold email (under 200 words) that:
1. References a specific technology they use to show research
2. Identifies a potential pain point or opportunity
3. Offers a clear value proposition
4. Ends with a soft call-to-action

Format with **Subject:** line first, then the email body. Use markdown bold for emphasis.`;

        const aiResult = await askGemini(prompt);

        if (aiResult) {
            return new Response(JSON.stringify({ email: aiResult }), {
                status: 200, headers: { 'Content-Type': 'application/json' }
            });
        }

        // Local fallback
        const hasWordPress = techs.some((t: string) => t === 'WordPress');
        const hasCDN = techs.some((t: string) => ['Cloudflare', 'Fastly', 'Amazon CloudFront'].includes(t));

        let email = `**Subject:** Quick question about ${domain}'s tech stack\n\n`;
        email += `Hi there,\n\nI was researching ${domain} and noticed you're using ${techs.slice(0, 3).join(', ')}. `;
        if (hasWordPress) email += `WordPress is powerful but can be tricky to scale securely. `;
        if (!hasCDN) email += `I also noticed you don't appear to have a CDN — this could improve load times significantly. `;
        email += `\n\nWe help companies optimize their web stack for speed and security. Would you be open to a quick chat?\n\nBest,\n[Your Name]`;
        email += `\n\n---\n*Local fallback. Set GEMINI_API_KEY for AI-personalized emails.*`;

        return new Response(JSON.stringify({ email }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Email generation failed.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};
