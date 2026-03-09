import type { APIRoute } from 'astro';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import db, { saveScan, getLastScan, getRecentScans } from '../../db/client';
import { enumerateSubdomains } from '../../utils/subdomain-enum';
import { calculateSecurityGrade } from '../../utils/security-grade';
import { fetchRobotsTxt, fetchSitemap, followRedirects, auditSEO, analyzeReadability, extractOutboundLinks, checkBrokenLinks } from '../../utils/seo-tools';
import { calculateBusinessMetrics } from '../../utils/business-intel';

const execAsync = promisify(exec);
export const prerender = false;

export const POST: APIRoute = async (context) => {
  const request = context.request;

  // 0. API Key Authentication (SaaS Programmatic Access)
  let isPremium = false;
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const apiKey = authHeader.substring(7);
    const stmt = db.prepare("SELECT id FROM user WHERE api_key = ?");
    const dbUser = stmt.get(apiKey);
    if (!dbUser) {
      return new Response(JSON.stringify({ error: "Invalid or inactive API Key." }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    isPremium = true;
  }

  // Also premium if logged in via browser
  if (context.locals.user) {
    isPremium = true;
  }

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

    // 4.7 Similar Sites (Competitor Discovery) & Visual Preview
    const recent = getRecentScans(10);
    const similarSites = [...new Set(recent.map(r => r.domain))]
      .filter(d => d !== domain) // exclude current
      .slice(0, 3); // top 3 unique

    const screenshotUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&embed=screenshot.url`;

    // 4.8 Premium Features (Pro Only)
    let subdomains: string[] = [];
    let openPorts: any[] = [];
    let robotsTxt: any = null;
    let sitemapData: any = null;
    let redirectChain: any = null;
    let seoAudit: any = null;
    let readability: any = null;
    let outboundLinks: any = null;
    let brokenLinks: any = null;

    if (isPremium) {
      try {
        const premiumTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Premium features timed out')), 15000)
        );

        const premiumWork = async () => {
          // Phase 1: Core scans + fast SEO tools (parallel)
          const [subs, engineRes, robots, redirects] = await Promise.allSettled([
            enumerateSubdomains(domain),
            fetch('http://127.0.0.1:8080/scan/ports', {
              method: 'POST',
              body: JSON.stringify({ host: domain }),
              headers: { 'Content-Type': 'application/json' },
              signal: AbortSignal.timeout(8000)
            }),
            fetchRobotsTxt(domain),
            followRedirects(url)
          ]);

          if (subs.status === 'fulfilled') subdomains = subs.value;
          if (engineRes.status === 'fulfilled' && engineRes.value.ok) {
            openPorts = await engineRes.value.json();
          }
          if (robots.status === 'fulfilled') {
            robotsTxt = robots.value;
            // Fetch sitemap if found in robots.txt
            if (robotsTxt.sitemaps?.length > 0) {
              try { sitemapData = await fetchSitemap(domain, robotsTxt.sitemaps[0]); } catch { }
            } else {
              try { sitemapData = await fetchSitemap(domain); } catch { }
            }
          }
          if (redirects.status === 'fulfilled') redirectChain = redirects.value;

          // Phase 2: HTML-based analysis (needs page content)
          try {
            const pageRes = await fetch(url, {
              signal: AbortSignal.timeout(5000),
              headers: { 'User-Agent': 'SiteIntelica Bot/1.0' }
            });
            if (pageRes.ok) {
              const html = await pageRes.text();
              seoAudit = auditSEO(html);
              readability = analyzeReadability(html);
              outboundLinks = extractOutboundLinks(html, domain);

              // Phase 3: Broken link check (slower, batched)
              try {
                brokenLinks = await checkBrokenLinks(html, url);
              } catch { }
            }
          } catch (e) {
            console.error('HTML fetch for SEO audit failed (non-fatal):', e);
          }
        };

        await Promise.race([premiumWork(), premiumTimeout]);
      } catch (e) {
        console.error("Premium features error (non-fatal):", e);
      }
    }

    // 5. Compile final data payload
    const securityGrade = calculateSecurityGrade(parsedData?.security);
    const enhancedData = {
      ...parsedData,
      screenshotUrl,
      similarSites,
      network: dnsInfo,
      performance: performance,
      ssl: sslInfo,
      whois: whoisInfo,
      historicalTimestamp: previousScan ? previousScan.scannedAt : null,
      historicalDiff: historicalDiff,
      subdomains: isPremium ? subdomains : null,
      openPorts: isPremium ? openPorts : null,
      robotsTxt: isPremium ? robotsTxt : null,
      sitemapData: isPremium ? sitemapData : null,
      redirectChain: isPremium ? redirectChain : null,
      seoAudit: isPremium ? seoAudit : null,
      readability: isPremium ? readability : null,
      outboundLinks: isPremium ? outboundLinks : null,
      brokenLinks: isPremium ? brokenLinks : null,
      securityGrade,
      isPremium,
      businessMetrics: isPremium ? calculateBusinessMetrics({
        technologies: parsedData?.technologies,
        performance,
        securityGrade,
        sitemapData,
        seoAudit,
        readability,
        trackers: parsedData?.trackers,
        seo: parsedData?.seo
      }) : null
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
