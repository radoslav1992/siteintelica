
const cheerio = require('cheerio');
const wapalyzer = require('wapalyzer-core');

const wappalyzer = wapalyzer.Wappalyzer;
const technologies = wapalyzer.technologies;
const categories = wapalyzer.categories;

wappalyzer.setTechnologies(technologies);
wappalyzer.setCategories(categories);

async function analyze(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const headers = {};
        for (const [key, value] of response.headers.entries()) {
            headers[key.toLowerCase()] = [value];
        }

        const cookies = headers['set-cookie'] || [];
        const htmlText = await response.text();
        const $ = cheerio.load(htmlText);

        const scriptSrc = $('script[src]').map((_, el) => $(el).attr('src')).get();
        const scripts = $('script:not([src])').map((_, el) => $(el).html()).get().join('\n');

        const meta = {};
        $('meta').each((_, el) => {
            const name = $(el).attr('name') || $(el).attr('property');
            const content = $(el).attr('content');
            if (name && content) {
                // Keep multiple meta tags with same name (e.g. 'generator')
                const key = name.toLowerCase();
                if (!meta[key]) meta[key] = [];
                meta[key].push(content);
            }
        });

        const domObj = {};
        const techArray = wappalyzer.technologies;
        const domSelectors = techArray
            .filter((t) => t.dom && Object.keys(t.dom).length > 0)
            .map((t) => Object.keys(t.dom))
            .flat();

        const uniqueSelectors = [...new Set(domSelectors)];

        uniqueSelectors.forEach(selector => {
            try {
                const elements = $(selector);
                if (elements.length > 0) {
                    domObj[selector] = { exists: [''], attributes: {}, text: [] };

                    elements.each((_, el) => {
                        const text = $(el).text();
                        if (text) domObj[selector].text.push(text);

                        // Capture all attributes
                        Object.keys(el.attribs || {}).forEach(attr => {
                            if (!domObj[selector].attributes[attr]) domObj[selector].attributes[attr] = [];
                            domObj[selector].attributes[attr].push(el.attribs[attr]);
                        });
                    });
                }
            } catch (e) {
                // Invalid selector
            }
        });

        const analyzeData = {
            url: url,
            html: htmlText,
            headers: headers,
            cookies: cookies,
            scriptSrc: scriptSrc,
            scripts: scripts,
            meta: meta
        };

        const detections = wappalyzer.analyze(analyzeData);

        // --- Custom DOM Analysis Patch for wapalyzer-core ---
        techArray.forEach(tech => {
            if (tech.dom) {
                Object.keys(tech.dom).forEach(selector => {
                    const domData = domObj[selector];
                    // if (tech.name === 'Astro') console.error('ASTRO SELECTOR:', selector, !!domData);
                    if (domData) {
                        let patterns = tech.dom[selector];
                        if (!Array.isArray(patterns)) patterns = [patterns];

                        patterns.forEach(pattern => {
                            let matchFound = false;
                            let matchValue = '';
                            let patternConfidence = pattern.confidence || 100;
                            let matchedVersion = '';

                            const processPattern = (pat, val, cb) => {
                                if (pat.regex) {
                                    const m = pat.regex.exec(val);
                                    if (m) cb(m[0], pat);
                                } else if (typeof pat === 'object') {
                                    Object.values(pat).forEach(p => {
                                        if (p && typeof p === 'object') processPattern(p, val, cb);
                                    });
                                }
                            };

                            const handleMatch = (val, pat) => {
                                matchFound = true;
                                matchValue = val;
                                matchedVersion = wappalyzer.resolveVersion(pat, val) || matchedVersion;
                                patternConfidence = pat.confidence || patternConfidence;
                            };

                            if (pattern.exists !== undefined) {
                                matchFound = true;
                            }
                            if (pattern.text) {
                                domData.text.forEach(text => {
                                    processPattern(pattern.text, text, handleMatch);
                                });
                            }
                            if (pattern.attributes) {
                                Object.keys(pattern.attributes).forEach(attrName => {
                                    const attrPattern = pattern.attributes[attrName];
                                    const attrValues = domData.attributes[attrName] || [];
                                    attrValues.forEach(val => {
                                        processPattern(attrPattern, val, handleMatch);
                                    });
                                });
                            }

                            if (matchFound) {
                                detections.push({
                                    technology: tech,
                                    pattern: { type: 'dom', value: matchValue, match: matchValue, confidence: patternConfidence },
                                    version: matchedVersion || ''
                                });
                            }
                        });
                    }
                });
            }
        });

        const resolved = wappalyzer.resolve(detections);

        // --- Custom Social Media Extraction ---
        const socials = [];
        const socialDomains = ['linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'github.com', 'youtube.com'];
        $('a[href]').each((_, el) => {
            try {
                const href = $(el).attr('href');
                if (href) {
                    const urlObj = new URL(href, url);
                    if (socialDomains.some(d => urlObj.hostname.includes(d))) {
                        // Avoid duplicates
                        if (!socials.includes(urlObj.href)) socials.push(urlObj.href);
                    }
                }
            } catch (e) {
                // Ignore invalid URLs
            }
        });

        // --- Custom SEO & Social Preview Extraction ---
        const seo = {
            title: $('title').text() || '',
            description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
            ogImage: $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '',
            ogTitle: $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || '',
            twitterCard: $('meta[name="twitter:card"]').attr('content') || '',
            canonical: $('link[rel="canonical"]').attr('href') || '',
            language: $('html').attr('lang') || '',
            h1Count: $('h1').length
        };

        // --- Custom Security Headers Extraction ---
        const securityHeaders = {
            hsts: !!headers['strict-transport-security'],
            csp: !!headers['content-security-policy'],
            xframe: !!headers['x-frame-options'],
            xContentTypeOptions: !!headers['x-content-type-options'],
            referrerPolicy: headers['referrer-policy'] ? headers['referrer-policy'][0] : null,
            permissionsPolicy: headers['permissions-policy'] ? headers['permissions-policy'][0] : null
        };

        // --- Page Architecture & Assets Extraction ---
        const architecture = {
            pageWeightBytes: Buffer.byteLength(htmlText, 'utf8'),
            domElements: $('*').length,
            modernImages: 0
        };

        // Count WebP & AVIF images
        $('img, source').each((_, el) => {
            const src = $(el).attr('src') || $(el).attr('srcset') || '';
            const type = $(el).attr('type') || '';
            if (src.includes('.webp') || src.includes('.avif') || type.includes('image/webp') || type.includes('image/avif')) {
                architecture.modernImages++;
            }
        });

        // --- Custom Contact Intelligence Extraction ---
        const contacts = { emails: [], phones: [] };
        // 1. Check href attributes for direct mailto/tel protocols
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href').toLowerCase();
            if (href.startsWith('mailto:')) {
                const email = href.replace('mailto:', '').split('?')[0].trim();
                if (email && !contacts.emails.includes(email)) contacts.emails.push(email);
            }
            if (href.startsWith('tel:')) {
                const phone = href.replace('tel:', '').trim();
                if (phone && !contacts.phones.includes(phone)) contacts.phones.push(phone);
            }
        });

        // 2. Fallback: lightweight regex on plain text for emails just in case there are no mailto tags
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
        const bodyText = $('body').text();
        const foundEmails = bodyText.match(emailRegex);
        if (foundEmails) {
            foundEmails.forEach(email => {
                const cleanEmail = email.toLowerCase().trim();
                // Filter out common false positives like image filenames ending in @2x.png
                if (!cleanEmail.match(/\.(png|jpe?g|gif|webp|svg)$/i) && !contacts.emails.includes(cleanEmail)) {
                    contacts.emails.push(cleanEmail);
                }
            });
        }

        // --- Custom Ad Pixel & Tracking De-obfuscation ---
        const trackers = [];

        // Facebook Pixel
        const fbpMatch = scripts.match(/fbq\('init',\s*['"](\d+)['"]/);
        if (fbpMatch) trackers.push({ name: 'Facebook Pixel', id: fbpMatch[1] });

        // TikTok Pixel
        const ttqMatch = scripts.match(/ttq\.load\(['"]([a-zA-Z0-9]+)['"]\)/);
        if (ttqMatch) trackers.push({ name: 'TikTok Pixel', id: ttqMatch[1] });

        // Google Tag Manager
        const gtmMatch = htmlText.match(/GTM-[A-Z0-9]+/);
        if (gtmMatch) trackers.push({ name: 'Google Tag Manager', id: gtmMatch[0] });

        // Google Analytics (Universal / GA4)
        const gaMatch = htmlText.match(/G-[A-Z0-9]+|UA-\d+-\d+/);
        if (gaMatch) trackers.push({ name: 'Google Analytics', id: gaMatch[0] });

        // LinkedIn Insight Tag
        const liMatch = scripts.match(/_linkedin_data_partner_ids\s*=\s*\[\s*['"](\d+)['"]\s*\]/);
        if (liMatch) trackers.push({ name: 'LinkedIn Insight Tag', id: liMatch[1] });

        // Twitter/X Pixel
        const twqMatch = scripts.match(/twq\('config',\s*['"]([a-zA-Z0-9]+)['"]/);
        if (twqMatch) trackers.push({ name: 'Twitter Pixel', id: twqMatch[1] });

        // --- Custom Keyword Density Analyzer ---
        const stopWords = new Set(['the', 'and', 'a', 'an', 'to', 'of', 'for', 'in', 'on', 'with', 'is', 'at', 'by', 'this', 'that', 'it', 'or', 'as', 'be', 'are', 'we', 'you', 'your', 'our', 'from', 'can', 'has', 'how']);
        const wordCounts = {};

        // Extract text only from meaningful tags
        const contentText = $('h1, h2, h3, h4, p, li, span, a').text().toLowerCase();
        // Extract strictly alphabetic words 3+ characters long
        const words = contentText.match(/[a-z]{3,}/g) || [];

        words.forEach(word => {
            if (!stopWords.has(word)) {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            }
        });

        // Sort and slice top 10
        const keywords = Object.keys(wordCounts)
            .map(word => ({ word, count: wordCounts[word] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // --- Extranal Discovery (Ads, Robots, Sitemap) ---
        // Fast HEAD request to check for existence of files without downloading their whole content
        const discoverFiles = async () => {
            const baseUrl = new URL(url).origin;
            const results = { adsTxt: false, robotsTxt: false, sitemap: false };
            try {
                const checks = await Promise.all([
                    fetch(`${baseUrl}/ads.txt`, { method: 'HEAD', signal: AbortSignal.timeout(2000) }).then(r => r.ok).catch(() => false),
                    fetch(`${baseUrl}/robots.txt`, { method: 'HEAD', signal: AbortSignal.timeout(2000) }).then(r => r.ok).catch(() => false),
                    fetch(`${baseUrl}/sitemap.xml`, { method: 'HEAD', signal: AbortSignal.timeout(2000) }).then(r => r.ok).catch(() => false)
                ]);
                results.adsTxt = checks[0];
                results.robotsTxt = checks[1];
                results.sitemap = checks[2];
            } catch (e) { }
            return results;
        };

        const discovery = await discoverFiles();

        console.log(JSON.stringify({
            urls: { [url]: { status: response.status } },
            technologies: resolved,
            socials: socials,
            seo: seo,
            security: securityHeaders,
            architecture: architecture,
            discovery: discovery,
            contacts: contacts,
            keywords: keywords,
            trackers: trackers
        }));

    } catch (error) {
        console.error(JSON.stringify({ error: error.message || 'Unknown error' }));
        process.exit(1);
    }
}

const targetUrl = process.argv[2];
if (!targetUrl) {
    console.error(JSON.stringify({ error: 'No URL provided' }));
    process.exit(1);
}

analyze(targetUrl);
