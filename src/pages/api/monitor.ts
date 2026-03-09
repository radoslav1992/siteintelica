import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async (context) => {
    const user = context.locals.user;

    if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized. Premium account required for Alerts." }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const data = await context.request.json();
        const url = data.url;

        if (!url || typeof url !== 'string' || !url.startsWith('http')) {
            return new Response(JSON.stringify({ error: 'Invalid URL provided. Please include http:// or https://' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- PLACEHOLDER LOGIC ---
        // In production, this would add a row to a `watched_competitors` table.
        // A daily Cron job would iterate through that table, scan the site, and if the JSON 
        // payload diffs significantly from the last run, it triggers an email alert.

        return new Response(JSON.stringify({
            message: 'Competitor added to watch queue.',
            domain: new URL(url).hostname,
            status: 'monitoring_active',
            info: 'This is a roadmap placeholder. The daily cron scanning engine will be implemented in a future update.'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Monitor Alert Error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to watch competitor: ' + (error.message || 'Unknown server error')
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
