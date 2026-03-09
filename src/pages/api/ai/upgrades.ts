import type { APIRoute } from 'astro';
import { getPublicReport } from '../../../db/client';
import { askGemini } from '../../../utils/gemini';

export const prerender = false;

const UPGRADE_MAP: Record<string, { risk: string, suggestion: string }> = {
    'jQuery': { risk: 'Legacy DOM library adds unnecessary weight.', suggestion: 'Migrate to vanilla JS or React/Vue/Svelte.' },
    'jQuery UI': { risk: 'Legacy UI toolkit with accessibility gaps.', suggestion: 'Replace with Headless UI or Radix.' },
    'Bootstrap': { risk: 'Large CSS framework with heavy unused styles.', suggestion: 'Consider Tailwind CSS for tree-shaken utility styles.' },
    'PHP': { risk: 'Older PHP versions may have unpatched CVEs.', suggestion: 'Ensure PHP 8.2+. Consider Node.js or Go for APIs.' },
    'WordPress': { risk: 'Plugin ecosystem creates large attack surface.', suggestion: 'Harden with Wordfence or consider headless CMS (Strapi, Sanity).' },
    'Drupal': { risk: 'Complex CMS with historically severe advisories.', suggestion: 'Ensure Drupal 10+ with all security patches.' },
    'Moment.js': { risk: 'Deprecated, adds ~70KB to bundles.', suggestion: 'Use date-fns or Day.js as lightweight replacements.' },
    'Lodash': { risk: 'Full imports bloat bundles significantly.', suggestion: 'Use native ES2024 methods or import individual functions.' },
    'FTP': { risk: 'FTP transmits credentials in plaintext.', suggestion: 'Switch to SFTP immediately.' },
};

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
        const hasCDN = techs.some((t: string) => ['Cloudflare', 'Fastly', 'Amazon CloudFront', 'Akamai'].includes(t));

        // Try Gemini first
        const prompt = `You are a senior web engineer. Analyze this website's tech stack and provide upgrade recommendations.

Website: ${domain}
Technologies detected: ${techs.join(', ')}
Has CDN: ${hasCDN ? 'Yes' : 'No'}
HSTS enabled: ${data.security?.hsts ? 'Yes' : 'No'}

For each problematic or outdated technology, provide:
1. The technology name
2. The risk of keeping it
3. A specific upgrade suggestion

Also check for missing best practices (CDN, HSTS, CSP).

Format as a JSON array of objects with fields: "technology", "risk", "suggestion". Return ONLY the JSON array, no markdown.`;

        const aiResult = await askGemini(prompt);

        if (aiResult) {
            try {
                // Try to parse AI JSON response
                const cleaned = aiResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const recommendations = JSON.parse(cleaned);
                return new Response(JSON.stringify({ recommendations }), {
                    status: 200, headers: { 'Content-Type': 'application/json' }
                });
            } catch {
                // If AI returns non-JSON, fall through to local
            }
        }

        // Local fallback
        const recommendations: any[] = [];
        techs.forEach((tech: string) => {
            if (UPGRADE_MAP[tech]) {
                recommendations.push({ technology: tech, ...UPGRADE_MAP[tech] });
            }
        });
        if (!hasCDN) {
            recommendations.push({
                technology: 'No CDN Detected',
                risk: 'Global visitors experience slow loads; origin exposed to DDoS.',
                suggestion: 'Add Cloudflare (free tier) for CDN, DDoS protection, and SSL.'
            });
        }
        if (!data.security?.hsts) {
            recommendations.push({
                technology: 'Missing HSTS',
                risk: 'Browsers can downgrade to insecure HTTP.',
                suggestion: 'Enable Strict-Transport-Security with max-age 31536000.'
            });
        }

        return new Response(JSON.stringify({ recommendations }), {
            status: 200, headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message || 'Upgrade analysis failed.' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }
};
