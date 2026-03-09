import type { APIRoute } from 'astro';
import { getPublicReport } from '../../../db/client';

export const prerender = false;

// Known outdated or risky technologies and their modern replacements
const UPGRADE_MAP: Record<string, { risk: string, suggestion: string }> = {
    'jQuery': { risk: 'Legacy DOM manipulation library adds unnecessary weight.', suggestion: 'Migrate to vanilla JavaScript or a modern framework (React, Vue, Svelte).' },
    'jQuery UI': { risk: 'Legacy UI toolkit with known accessibility gaps.', suggestion: 'Replace with Headless UI, Radix, or shadcn/ui components.' },
    'Bootstrap': { risk: 'Large CSS framework with heavy unused styles.', suggestion: 'Consider Tailwind CSS for utility-first styling with zero unused CSS via tree-shaking.' },
    'PHP': { risk: 'Older PHP versions may have unpatched CVEs.', suggestion: 'Ensure PHP 8.2+ is running. Consider migrating to Node.js or Go for API layers.' },
    'WordPress': { risk: 'Plugin ecosystem introduces high vulnerability surface area.', suggestion: 'Harden with Wordfence, keep plugins minimal, or consider headless CMS (Strapi, Sanity).' },
    'Drupal': { risk: 'Complex CMS with historically severe security advisories (Drupalgeddon).', suggestion: 'Ensure Drupal 10+ with all security patches. Consider static site generators.' },
    'Angular': { risk: 'AngularJS (v1) is end-of-life with no security patches.', suggestion: 'Migrate to Angular 17+ or React/Next.js.' },
    'Moment.js': { risk: 'Deprecated date library adding ~70KB to bundles.', suggestion: 'Use date-fns or Day.js as lightweight drop-in replacements.' },
    'Lodash': { risk: 'Full Lodash imports bloat bundles significantly.', suggestion: 'Use native ES2024 methods or import individual lodash functions.' },
    'Google Font API': { risk: 'Render-blocking external font requests hurt Core Web Vitals.', suggestion: 'Self-host fonts with font-display: swap for better LCP scores.' },
    'FTP': { risk: 'FTP transmits credentials in plaintext.', suggestion: 'Switch to SFTP (SSH File Transfer Protocol) immediately.' },
};

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

        const recommendations: any[] = [];

        techs.forEach((tech: string) => {
            if (UPGRADE_MAP[tech]) {
                recommendations.push({
                    technology: tech,
                    ...UPGRADE_MAP[tech]
                });
            }
        });

        // Check for missing CDN
        const hasCDN = techs.some((t: string) => ['Cloudflare', 'Fastly', 'Amazon CloudFront', 'Akamai'].includes(t));
        if (!hasCDN) {
            recommendations.push({
                technology: 'No CDN Detected',
                risk: 'Without a CDN, global visitors experience slow load times and the origin server is exposed to DDoS.',
                suggestion: 'Add Cloudflare (free tier available) for instant global CDN, DDoS protection, and SSL.'
            });
        }

        // Check for missing HTTPS-related tech
        const hasHTTPS = data.security?.hsts;
        if (!hasHTTPS) {
            recommendations.push({
                technology: 'Missing HSTS',
                risk: 'Without HSTS, browsers can be tricked into downgrading to insecure HTTP connections.',
                suggestion: 'Enable Strict-Transport-Security header with a max-age of at least 31536000.'
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
