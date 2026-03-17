import type { APIRoute } from 'astro';
import { createBulkJob, updateBulkJob, getBulkJobs, logAudit } from '../../db/client';

export const prerender = false;

const MAX_URLS = 50;

async function scanSingleUrl(url: string): Promise<any> {
  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const { join } = await import('node:path');
    const execAsync = promisify(exec);

    const scraperPath = join(process.cwd(), 'src/utils/wappalyzer-scraper.cjs');
    const { stdout } = await execAsync(`node "${scraperPath}" "${url}"`, { timeout: 12000 });
    const parsed = JSON.parse(stdout);

    if (parsed.error) return { url, status: 'error', error: parsed.error };

    const domain = new URL(url).hostname;
    const techs: string[] = (parsed.technologies || []).map((t: any) => t.name);

    return {
      url,
      domain,
      status: 'complete',
      techCount: techs.length,
      technologies: techs,
      meta: parsed.meta || {},
    };
  } catch (error: any) {
    return { url, status: 'error', error: error.message || 'Scan failed' };
  }
}

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Premium account required for Bulk Analysis.' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await context.request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No CSV/TXT file uploaded.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    const text = await file.text();
    let urls = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && line.includes('.'))
      .map(line => {
        if (!line.startsWith('http')) return `https://${line}`;
        return line;
      });

    if (urls.length === 0) {
      return new Response(JSON.stringify({ error: 'File is empty or contains no valid URLs.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      });
    }

    urls = [...new Set(urls)].slice(0, MAX_URLS);
    const jobId = createBulkJob(user.id, urls.length);
    logAudit(user.id, 'bulk_scan_start', null, { jobId, urlCount: urls.length });

    updateBulkJob(jobId, 0, 'processing');

    // Process sequentially in batches of 3 to avoid overwhelming the server
    const BATCH_SIZE = 3;
    const allResults: any[] = [];

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      const batch = urls.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(batch.map(scanSingleUrl));

      batchResults.forEach(r => {
        if (r.status === 'fulfilled') allResults.push(r.value);
        else allResults.push({ url: 'unknown', status: 'error', error: 'Promise rejected' });
      });

      updateBulkJob(jobId, allResults.length, 'processing');
    }

    const successCount = allResults.filter(r => r.status === 'complete').length;
    const errorCount = allResults.filter(r => r.status === 'error').length;

    updateBulkJob(jobId, allResults.length, 'complete', allResults);
    logAudit(user.id, 'bulk_scan_complete', null, { jobId, successCount, errorCount });

    return new Response(JSON.stringify({
      jobId,
      status: 'complete',
      totalProcessed: allResults.length,
      successCount,
      errorCount,
      results: allResults,
    }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: 'Bulk analysis failed: ' + (error.message || 'Unknown error') }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const jobs = getBulkJobs(user.id);
  return new Response(JSON.stringify({ jobs }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
