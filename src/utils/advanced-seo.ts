/**
 * Advanced SEO & Accessibility analysis tools.
 * Extends the basic seo-tools.ts with deeper analysis capabilities.
 */

export interface AccessibilityAudit {
  score: number;
  issues: { severity: string; rule: string; message: string; count: number }[];
  passed: string[];
  summary: string;
}

export interface SchemaValidation {
  schemas: { type: string; isValid: boolean; issues: string[]; fields: string[] }[];
  richResultsEligible: string[];
  totalSchemas: number;
}

export interface PageWeightAnalysis {
  estimatedTotalKB: number;
  breakdown: { type: string; estimatedKB: number; count: number }[];
  grade: string;
  recommendations: string[];
}

export interface DuplicateContentCheck {
  duplicateMetaTitles: boolean;
  duplicateMetaDescriptions: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  issues: string[];
}

export interface AdvancedSEOReport {
  accessibility: AccessibilityAudit;
  schemaValidation: SchemaValidation;
  pageWeight: PageWeightAnalysis;
  duplicateContent: DuplicateContentCheck;
  internationalSEO: { hreflang: string[]; issues: string[] };
  coreWebVitals: { issues: string[]; recommendations: string[] };
}

export function auditAccessibility(html: string): AccessibilityAudit {
  const issues: AccessibilityAudit['issues'] = [];
  const passed: string[] = [];
  let score = 100;

  // Images without alt text
  const imgs = html.match(/<img[^>]*>/gi) || [];
  const missingAlt = imgs.filter(i => !i.includes('alt=') || /alt=["']\s*["']/i.test(i));
  if (missingAlt.length > 0) {
    issues.push({ severity: 'high', rule: 'img-alt', message: 'Images missing alt text (screen readers cannot describe them)', count: missingAlt.length });
    score -= Math.min(20, missingAlt.length * 3);
  } else if (imgs.length > 0) {
    passed.push('All images have alt text');
  }

  // Form inputs without labels
  const inputs = html.match(/<input[^>]*>/gi) || [];
  const formInputs = inputs.filter(i => !/type=["'](hidden|submit|button|reset)["']/i.test(i));
  const labels = html.match(/<label[^>]*>/gi) || [];
  if (formInputs.length > labels.length) {
    const missing = formInputs.length - labels.length;
    issues.push({ severity: 'high', rule: 'label', message: 'Form inputs missing associated <label> elements', count: missing });
    score -= Math.min(15, missing * 4);
  } else if (formInputs.length > 0) {
    passed.push('Form inputs have labels');
  }

  // Links without text
  const emptyLinks = (html.match(/<a[^>]*>\s*<\/a>/gi) || []).length;
  const imgOnlyLinks = (html.match(/<a[^>]*>\s*<img[^>]*>\s*<\/a>/gi) || []).length;
  if (emptyLinks > 0) {
    issues.push({ severity: 'medium', rule: 'link-name', message: 'Links with no discernible text', count: emptyLinks });
    score -= Math.min(10, emptyLinks * 2);
  }
  if (imgOnlyLinks > 0) {
    issues.push({ severity: 'low', rule: 'link-img-alt', message: 'Links containing only images (need alt text on img)', count: imgOnlyLinks });
    score -= Math.min(5, imgOnlyLinks);
  }

  // Missing lang attribute
  if (!/<html[^>]+lang=/i.test(html)) {
    issues.push({ severity: 'high', rule: 'html-lang', message: 'Missing lang attribute on <html> element', count: 1 });
    score -= 10;
  } else {
    passed.push('HTML has lang attribute');
  }

  // Missing document title
  if (!/<title[^>]*>[^<]+<\/title>/i.test(html)) {
    issues.push({ severity: 'high', rule: 'document-title', message: 'Page is missing a <title> element', count: 1 });
    score -= 10;
  } else {
    passed.push('Page has a title');
  }

  // Heading hierarchy
  const headings = html.match(/<h([1-6])[^>]*>/gi) || [];
  const headingLevels = headings.map(h => parseInt(h.match(/h(\d)/i)?.[1] || '0'));
  if (headingLevels.length > 0 && headingLevels[0] !== 1) {
    issues.push({ severity: 'medium', rule: 'heading-order', message: 'First heading is not H1 — heading hierarchy is incorrect', count: 1 });
    score -= 5;
  }
  let hasSkip = false;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) {
      hasSkip = true;
      break;
    }
  }
  if (hasSkip) {
    issues.push({ severity: 'medium', rule: 'heading-skip', message: 'Heading levels are skipped (e.g., H1 → H3)', count: 1 });
    score -= 5;
  } else if (headingLevels.length > 1) {
    passed.push('Heading hierarchy is logical');
  }

  // Color contrast (heuristic: check for very small font declarations)
  const tinyFonts = (html.match(/font-size:\s*(0\.\d+|[1-9])px/gi) || []).length;
  if (tinyFonts > 0) {
    issues.push({ severity: 'low', rule: 'text-size', message: 'Very small font sizes detected (< 10px) — may be unreadable', count: tinyFonts });
    score -= Math.min(5, tinyFonts);
  }

  // ARIA roles check
  const ariaCount = (html.match(/role=["']/gi) || []).length;
  const ariaLabelCount = (html.match(/aria-label=["']/gi) || []).length;
  if (ariaCount > 0 || ariaLabelCount > 0) {
    passed.push(`Uses ARIA attributes (${ariaCount} roles, ${ariaLabelCount} labels)`);
  }

  // Skip link
  if (/class=["'][^"']*skip/i.test(html) || /id=["']main/i.test(html)) {
    passed.push('Has skip navigation or main content landmark');
  } else {
    issues.push({ severity: 'low', rule: 'bypass', message: 'No skip navigation link found for keyboard users', count: 1 });
    score -= 3;
  }

  // Tab index misuse
  const positiveTabindex = (html.match(/tabindex=["'][1-9]/gi) || []).length;
  if (positiveTabindex > 0) {
    issues.push({ severity: 'medium', rule: 'tabindex', message: 'Positive tabindex values disrupt natural focus order', count: positiveTabindex });
    score -= Math.min(5, positiveTabindex * 2);
  }

  score = Math.max(0, Math.min(100, score));

  let summary: string;
  if (score >= 90) summary = 'Excellent accessibility — minor improvements possible';
  else if (score >= 70) summary = 'Good accessibility — some issues to address';
  else if (score >= 50) summary = 'Fair accessibility — several improvements needed';
  else summary = 'Poor accessibility — significant barriers for disabled users';

  return { score, issues: issues.sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  }), passed, summary };
}

export function validateSchemas(html: string): SchemaValidation {
  const schemas: SchemaValidation['schemas'] = [];
  const richResultsEligible: string[] = [];

  const RICH_RESULT_TYPES = ['Article', 'Product', 'FAQPage', 'HowTo', 'Recipe', 'Event', 'LocalBusiness', 'Organization', 'BreadcrumbList', 'Review', 'JobPosting', 'Course', 'VideoObject'];

  const REQUIRED_FIELDS: Record<string, string[]> = {
    Article: ['headline', 'author', 'datePublished', 'image'],
    Product: ['name', 'image', 'offers'],
    FAQPage: ['mainEntity'],
    Recipe: ['name', 'image', 'recipeIngredient'],
    Event: ['name', 'startDate', 'location'],
    LocalBusiness: ['name', 'address', 'telephone'],
    Organization: ['name', 'url'],
    BreadcrumbList: ['itemListElement'],
    JobPosting: ['title', 'description', 'datePosted', 'hiringOrganization'],
    VideoObject: ['name', 'description', 'thumbnailUrl', 'uploadDate'],
  };

  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];

      items.forEach(item => {
        const type = item['@type'] || 'Unknown';
        const fields = Object.keys(item).filter(k => !k.startsWith('@'));
        const issues: string[] = [];

        if (!item['@context'] || !item['@context'].includes('schema.org')) {
          issues.push('Missing or invalid @context — should reference schema.org');
        }

        const required = REQUIRED_FIELDS[type];
        if (required) {
          required.forEach(field => {
            if (!item[field]) issues.push(`Missing required field: ${field}`);
          });
        }

        const isValid = issues.length === 0;
        schemas.push({ type, isValid, issues, fields });

        if (RICH_RESULT_TYPES.includes(type) && isValid) {
          richResultsEligible.push(type);
        }
      });
    } catch {
      schemas.push({ type: 'Invalid JSON-LD', isValid: false, issues: ['JSON-LD parsing error — malformed JSON'], fields: [] });
    }
  }

  return { schemas, richResultsEligible, totalSchemas: schemas.length };
}

export function analyzePageWeight(html: string): PageWeightAnalysis {
  const breakdown: { type: string; estimatedKB: number; count: number }[] = [];
  const recommendations: string[] = [];

  const htmlSize = Math.round(new Blob([html]).size / 1024);
  breakdown.push({ type: 'HTML Document', estimatedKB: htmlSize, count: 1 });

  const scripts = html.match(/<script[^>]*src=["'][^"']+["']/gi) || [];
  const inlineScripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  const inlineScriptSize = inlineScripts.reduce((total, s) => total + s.length, 0) / 1024;
  breakdown.push({ type: 'External Scripts', estimatedKB: scripts.length * 45, count: scripts.length });
  breakdown.push({ type: 'Inline Scripts', estimatedKB: Math.round(inlineScriptSize), count: inlineScripts.length });

  const stylesheets = html.match(/<link[^>]+rel=["']stylesheet["'][^>]+href=["'][^"']+["']/gi) || [];
  const inlineStyles = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  const inlineStyleSize = inlineStyles.reduce((total, s) => total + s.length, 0) / 1024;
  breakdown.push({ type: 'External Stylesheets', estimatedKB: stylesheets.length * 25, count: stylesheets.length });
  breakdown.push({ type: 'Inline Styles', estimatedKB: Math.round(inlineStyleSize), count: inlineStyles.length });

  const images = html.match(/<img[^>]+src=["'][^"']+["']/gi) || [];
  breakdown.push({ type: 'Images', estimatedKB: images.length * 80, count: images.length });

  const fonts = (html.match(/url\([^)]*\.(woff2?|ttf|otf|eot)/gi) || []).length;
  breakdown.push({ type: 'Fonts', estimatedKB: fonts * 35, count: fonts });

  const iframes = (html.match(/<iframe/gi) || []).length;
  if (iframes > 0) {
    breakdown.push({ type: 'Iframes', estimatedKB: iframes * 200, count: iframes });
  }

  const total = breakdown.reduce((sum, b) => sum + b.estimatedKB, 0);

  let grade: string;
  if (total < 500) grade = 'A';
  else if (total < 1000) grade = 'B';
  else if (total < 2000) grade = 'C';
  else if (total < 4000) grade = 'D';
  else grade = 'F';

  if (scripts.length > 15) {
    recommendations.push(`Reduce external scripts (${scripts.length}) — consider bundling or removing unused scripts`);
  }
  if (images.length > 20) {
    recommendations.push(`Optimize images (${images.length}) — use lazy loading, WebP/AVIF format, and responsive srcset`);
  }
  if (fonts > 4) {
    recommendations.push(`Reduce web fonts (${fonts}) — use system fonts or limit to 2-3 font files`);
  }
  if (inlineScriptSize > 50) {
    recommendations.push('Move large inline scripts to external files for caching');
  }
  if (iframes > 3) {
    recommendations.push(`Reduce iframes (${iframes}) — each loads an entire separate document`);
  }
  if (total > 3000) {
    recommendations.push(`Total estimated page weight (${Math.round(total)}KB) exceeds 3MB — aim for under 1.5MB`);
  }

  return {
    estimatedTotalKB: Math.round(total),
    breakdown: breakdown.filter(b => b.count > 0),
    grade,
    recommendations,
  };
}

export function checkDuplicateContent(html: string): DuplicateContentCheck {
  const issues: string[] = [];

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const metaTitle = titleMatch ? titleMatch[1].trim() : null;

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const metaDescription = descMatch ? descMatch[1].trim() : null;

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
  const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : null;

  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
  const ogDesc = ogDescMatch ? ogDescMatch[1].trim() : null;

  if (!metaTitle) issues.push('Missing <title> tag — critical for SEO');
  if (!metaDescription) issues.push('Missing meta description — impacts click-through rate in search results');
  if (metaTitle && metaTitle.length > 60) issues.push(`Title is ${metaTitle.length} chars (recommended: ≤60)`);
  if (metaTitle && metaTitle.length < 10) issues.push('Title is too short — should be descriptive');
  if (metaDescription && metaDescription.length > 160) issues.push(`Meta description is ${metaDescription.length} chars (recommended: ≤160)`);
  if (metaDescription && metaDescription.length < 50) issues.push('Meta description is too short — should be 120-160 characters');

  const duplicateMetaTitles = !!(ogTitle && metaTitle && ogTitle === metaTitle);
  const duplicateMetaDescriptions = !!(ogDesc && metaDescription && ogDesc === metaDescription);

  if (ogTitle && !metaTitle) issues.push('Has og:title but missing <title> tag');
  if (!ogTitle && metaTitle) issues.push('Missing og:title — important for social sharing');
  if (!ogDescMatch) issues.push('Missing og:description — important for social sharing');

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  if (!canonicalMatch) issues.push('Missing canonical URL — can lead to duplicate content issues in search engines');

  const multipleH1 = (html.match(/<h1[^>]*>/gi) || []).length;
  if (multipleH1 > 1) issues.push(`Multiple H1 tags (${multipleH1}) — should have exactly one H1 per page`);
  if (multipleH1 === 0) issues.push('Missing H1 tag — primary heading is important for SEO');

  return { duplicateMetaTitles, duplicateMetaDescriptions, metaTitle, metaDescription, issues };
}

export function checkInternationalSEO(html: string): { hreflang: string[]; issues: string[] } {
  const hreflangRegex = /<link[^>]+hreflang=["']([^"']+)["']/gi;
  const hreflang: string[] = [];
  const issues: string[] = [];
  let match;

  while ((match = hreflangRegex.exec(html)) !== null) {
    hreflang.push(match[1]);
  }

  if (hreflang.length > 0 && !hreflang.includes('x-default')) {
    issues.push('Missing x-default hreflang — needed as fallback for unmatched locales');
  }

  const langMatch = html.match(/<html[^>]+lang=["']([^"']*)["']/i);
  if (langMatch && hreflang.length === 0) {
    issues.push('Page has lang attribute but no hreflang tags — consider adding them for international SEO');
  }

  return { hreflang, issues };
}

export function runAdvancedSEOAudit(html: string): AdvancedSEOReport {
  return {
    accessibility: auditAccessibility(html),
    schemaValidation: validateSchemas(html),
    pageWeight: analyzePageWeight(html),
    duplicateContent: checkDuplicateContent(html),
    internationalSEO: checkInternationalSEO(html),
    coreWebVitals: {
      issues: [],
      recommendations: [
        'Use fetchpriority="high" on LCP image element',
        'Minimize layout shifts by setting explicit width/height on images and ads',
        'Defer non-critical JavaScript with async/defer attributes',
      ],
    },
  };
}
