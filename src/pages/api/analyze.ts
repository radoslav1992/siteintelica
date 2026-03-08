import type { APIRoute } from 'astro';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { saveScan, getLastScan } from '../../db/client';

const execAsync = promisify(exec);
export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const url = data.url;

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return new Response(JSON.stringify({ error: 'Invalid URL provided. Please include http:// or https://' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // 0. Check for historical record
    const previousScan = getLastScan(domain);

    // 1. Resolve path to the CommonJS scraper
    const scraperPath = join(process.cwd(), 'src/utils/wappalyzer-scraper.cjs');

    // Execute the scraper as a standalone node process
    const { stdout, stderr } = await execAsync(`node "${scraperPath}" "${url}"`, {
      timeout: 15000 // 15 second max execution time
    });

    if (stderr && !stdout) {
      console.error('Scraper Error Output:', stderr);
      throw new Error(stderr);
    }

    // Parse the JSON output from the scraper
    const parsedData = JSON.parse(stdout);

    if (parsedData.error) {
      throw new Error(parsedData.error);
    }

    // 2. Fetch DNS Info (Network Layer)
    const dnsInfo: any = {};
    const dnsPromises = await import('node:dns/promises');
    try {
      const aRecords = await dnsPromises.resolve4(domain);
      dnsInfo.ip = aRecords[0];
    } catch (e) { }
    try {
      const mxRecords = await dnsPromises.resolveMx(domain);
      if (mxRecords && mxRecords.length > 0) {
        // Sort by priority and take the first one
        dnsInfo.mx = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;
      }
    } catch (e) { }

    // Email Auth (SPF & DMARC)
    dnsInfo.spf = false;
    dnsInfo.dmarc = false;
    try {
      const txtRecords = await dnsPromises.resolveTxt(domain);
      dnsInfo.spf = txtRecords.some(record => record.join(' ').includes('v=spf1'));
    } catch (e) { }
    try {
      // DMARC is usually on _dmarc.domain.com
      const dmarcDomain = domain.startsWith('www.') ? `_dmarc.${domain.slice(4)}` : `_dmarc.${domain}`;
      const dmarcRecords = await dnsPromises.resolveTxt(dmarcDomain);
      dnsInfo.dmarc = dmarcRecords.some(record => record.join(' ').includes('v=DMARC1'));
    } catch (e) { }

    // 3. Google PageSpeed Insights (Performance Layer)
    let performance = null;
    try {
      // We use the mobile strategy for more stringent/useful scoring
      const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=seo&category=accessibility`;
      const psiRes = await fetch(psiUrl);
      if (psiRes.ok) {
        const psiData = await psiRes.json();
        const lighthouse = psiData.lighthouseResult;
        if (lighthouse && lighthouse.categories) {
          performance = {
            score: Math.round(lighthouse.categories.performance.score * 100),
            seo: Math.round(lighthouse.categories.seo.score * 100),
            accessibility: Math.round(lighthouse.categories.accessibility.score * 100),
          };
        }
      }
    } catch (e) {
      console.error("PageSpeed Error:", e);
    }

    // 4. SSL/TLS Certificate Information
    let sslInfo: any = null;
    try {
      const tls = await import('node:tls');
      sslInfo = await new Promise((resolve) => {
        const socket = tls.connect({
          port: 443,
          host: domain,
          servername: domain,
          rejectUnauthorized: false // Don't crash on invalid certs, we just want to inspect it
        }, () => {
          const cert = socket.getPeerCertificate();
          socket.end();
          if (cert && cert.issuer) {
            resolve({
              issuer: cert.issuer.O || cert.issuer.CN || 'Unknown Authority',
              validTo: cert.valid_to
            });
          } else {
            resolve(null);
          }
        });
        socket.on('error', () => resolve(null));
        socket.setTimeout(3000, () => {
          socket.destroy();
          resolve(null);
        });
      });
    } catch (e) {
      console.error("SSL Extraction Error:", e);
    }

    // 4.5 Whois / Domain Age
    let whoisInfo: any = null;
    try {
      // Extract the root domain (naive approach for common TLDs)
      const parts = domain.split('.');
      const rootDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain;
      const { stdout: whoisOut } = await execAsync(`whois ${rootDomain}`, { timeout: 3000 });

      const creationMatch = whoisOut.match(/Creation Date:\s*(.*)/i) || whoisOut.match(/created:\s*(.*)/i);
      const registrarMatch = whoisOut.match(/Registrar:\s*(.*)/i);

      if (creationMatch || registrarMatch) {
        whoisInfo = {
          created: creationMatch ? creationMatch[1].trim() : null,
          registrar: registrarMatch ? registrarMatch[1].trim() : null,
        };

        // Calculate Age
        if (whoisInfo.created) {
          const createdDate = new Date(whoisInfo.created);
          if (!isNaN(createdDate.getTime())) {
            const ageMs = Date.now() - createdDate.getTime();
            whoisInfo.ageYears = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));
          }
        }
      }
    } catch (e: any) {
      console.error("Whois Error:", e.message);
    }

    // 4.6 Calculate Tech Stack Diff
    let historicalDiff = null;
    if (previousScan && previousScan.data) {
      try {
        const oldData = previousScan.data;
        if (oldData.technologies && parsedData.technologies) {
          const oldTechs = oldData.technologies.map((t: any) => t.name);
          const newTechs = parsedData.technologies.map((t: any) => t.name);

          const addedTech = newTechs.filter((t: string) => !oldTechs.includes(t));
          const removedTech = oldTechs.filter((t: string) => !newTechs.includes(t));

          if (addedTech.length > 0 || removedTech.length > 0) {
            historicalDiff = {
              lastScanDate: previousScan.scannedAt,
              added: addedTech,
              removed: removedTech
            };
          }
        }
      } catch (e) {
        console.error("Failed to parse previous scan data for diffing", e);
      }
    }

    // 5. Compile final data payload
    const enhancedData = {
      ...parsedData,
      network: dnsInfo,
      performance: performance,
      ssl: sslInfo,
      whois: whoisInfo,
      historicalTimestamp: previousScan ? previousScan.scannedAt : null,
      historicalDiff: historicalDiff
    };

    // 5. Persist to History Database
    saveScan(domain, enhancedData);

    return new Response(JSON.stringify(enhancedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('API Route / Scraper Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to analyze the target URL: ' + (error.message || 'Unknown server error')
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
