import type { APIRoute } from 'astro';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

const execAsync = promisify(exec);

export const POST: APIRoute = async (context) => {
    // 1. Authenticate Request
    if (!context.locals.user) {
        return new Response(JSON.stringify({ error: "Unauthorized. An active SaaS session is required for bulk scanning." }), { status: 401 });
    }

    try {
        const formData = await context.request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return new Response(JSON.stringify({ error: "No file provided" }), { status: 400 });
        }

        // 2. Parse File Contents
        const text = await file.text();
        const urls = text.split('\n').map(line => line.trim()).filter(line => line.startsWith('http'));

        if (urls.length === 0) {
            return new Response(JSON.stringify({ error: "No valid URLs found in file. Ensure they start with http:// or https://" }), { status: 400 });
        }

        if (urls.length > 50) {
            return new Response(JSON.stringify({ error: "Maximum 50 URLs allowed per bulk scan." }), { status: 400 });
        }

        // 3. Sequential Execution (Avoids locking KVM CPU threads)
        const results = [];
        const scraperPath = join(process.cwd(), 'src/utils/wappalyzer-scraper.cjs');

        for (const url of urls) {
            try {
                const { stdout } = await execAsync(`node "${scraperPath}" "${url}"`, { timeout: 15000 });
                const parsed = JSON.parse(stdout);
                if (parsed.error) throw new Error(parsed.error);
                results.push({ url, success: true, data: parsed });
            } catch (e: any) {
                results.push({ url, success: false, error: e.message || "Scraper failed" });
            }
        }

        // 4. Return the combined JSON report payload
        return new Response(JSON.stringify({
            bulk_processed: results.length,
            timestamp: new Date().toISOString(),
            results: results
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        return new Response(JSON.stringify({ error: "File processing failed" }), { status: 500 });
    }
};
