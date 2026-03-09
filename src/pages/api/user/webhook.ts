import type { APIRoute } from 'astro';
import db from '../../../db/client';

export const prerender = false;

export const POST: APIRoute = async (context) => {
    const user = context.locals.user;
    if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const data = await context.request.json();
        let webhookUrl = data.webhookUrl;

        if (webhookUrl && (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://'))) {
            return new Response(JSON.stringify({ error: 'Invalid Webhook URL. Must start with http or https.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!webhookUrl) {
            webhookUrl = null;
        }

        const stmt = db.prepare('UPDATE user SET webhook_url = ? WHERE id = ?');
        stmt.run(webhookUrl, user.id);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Webhook Save Error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to save webhook: ' + (error.message || 'Unknown error')
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
