import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async (context) => {
    const user = context.locals.user;

    if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized. Premium account required for Bulk Analysis." }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const formData = await context.request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return new Response(JSON.stringify({ error: 'No CSV/TXT file uploaded.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const text = await file.text();
        const urls = text.split('\n').map(line => line.trim()).filter(line => line && line.includes('.'));

        if (urls.length === 0) {
            return new Response(JSON.stringify({ error: 'File is empty or contains no valid URLs.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (urls.length > 50) {
            return new Response(JSON.stringify({ error: 'Free tier / Demo limited to 50 URLs max per bulk pass.' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // --- PLACEHOLDER LOGIC ---
        // In production, this would immediately return a 202 Accepted, and push the URLs into a Redis/BullMQ queue.
        // The worker would then incrementally scan them and eventually POST the results to the user's `webhook_url`.
        // For this demonstration, we'll simulate a fast process and return mocked JSON directly.

        const mockedResults = urls.map(url => ({
            url: url,
            status: 'queued_for_background_processing',
            estimated_completion: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
            message: 'This is a roadmap placeholder. Background processing queues (Redis) will be implemented in a future update.'
        }));

        return new Response(JSON.stringify({
            message: 'Bulk analysis queued successfully.',
            bulk_processed: urls.length,
            queue: mockedResults
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('Bulk Analysis Error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to process bulk upload: ' + (error.message || 'Unknown server error')
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
