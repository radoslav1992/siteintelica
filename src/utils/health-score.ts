/**
 * Site Health Score — the single number that tells you how healthy a website is.
 * Weighted composite of performance, security, SEO, accessibility, and content quality.
 * Output: 0-100 score + letter grade + breakdown + actionable priority list.
 */

const WEIGHTS = {
  performance: 0.25,
  security: 0.20,
  seo: 0.20,
  accessibility: 0.15,
  content: 0.10,
  infrastructure: 0.10,
};

export interface HealthScoreBreakdown {
  category: string;
  score: number;
  weight: number;
  weightedScore: number;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  topIssue: string | null;
}

export interface HealthScore {
  overall: number;
  grade: string;
  breakdown: HealthScoreBreakdown[];
  prioritizedActions: { priority: number; category: string; action: string; impact: string }[];
  comparisonText: string;
}

function status(score: number): HealthScoreBreakdown['status'] {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

export function calculateHealthScore(data: any): HealthScore {
  const breakdown: HealthScoreBreakdown[] = [];
  const actions: HealthScore['prioritizedActions'] = [];

  // Performance (from Lighthouse via PageSpeed API)
  const perfScore = data.performance?.score ?? data.performance?.performanceScore ?? 0;
  const perfStatus = status(perfScore);
  breakdown.push({
    category: 'Performance',
    score: perfScore,
    weight: WEIGHTS.performance,
    weightedScore: Math.round(perfScore * WEIGHTS.performance),
    status: perfStatus,
    topIssue: perfScore < 50 ? 'Page loads too slowly — major visitor drop-off risk' : perfScore < 80 ? 'Room for performance optimization' : null,
  });
  if (perfScore < 50) actions.push({ priority: 1, category: 'Performance', action: 'Optimize page load speed — compress images, defer JS, enable caching', impact: 'High — slow sites lose 53% of mobile visitors' });
  if (perfScore >= 50 && perfScore < 80) actions.push({ priority: 3, category: 'Performance', action: 'Fine-tune Core Web Vitals (LCP, CLS, INP)', impact: 'Medium — improves SEO ranking signal' });

  // Security
  const secScore = data.securityGrade?.score ?? 0;
  const deepSecRisk = data.deepSecurity?.overallRiskScore ?? 0;
  const adjustedSec = Math.max(0, Math.min(100, secScore - (deepSecRisk * 0.3)));
  breakdown.push({
    category: 'Security',
    score: Math.round(adjustedSec),
    weight: WEIGHTS.security,
    weightedScore: Math.round(adjustedSec * WEIGHTS.security),
    status: status(adjustedSec),
    topIssue: adjustedSec < 40 ? 'Critical security headers missing — vulnerable to attacks' : adjustedSec < 70 ? 'Security headers incomplete' : null,
  });
  if (adjustedSec < 40) actions.push({ priority: 1, category: 'Security', action: 'Add CSP, HSTS, X-Frame-Options, and X-Content-Type-Options headers', impact: 'Critical — prevents XSS, clickjacking, and MITM attacks' });
  if (data.deepSecurity?.vulnerabilities?.length > 0) {
    const critCount = data.deepSecurity.vulnerabilities.filter((v: any) => v.severity === 'critical' || v.severity === 'high').length;
    if (critCount > 0) actions.push({ priority: 1, category: 'Security', action: `Patch ${critCount} known vulnerable libraries (CVEs detected)`, impact: 'Critical — known exploits exist' });
  }
  if (data.ssl?.validTo) {
    const daysLeft = Math.floor((new Date(data.ssl.validTo).getTime() - Date.now()) / 86400000);
    if (daysLeft < 30) actions.push({ priority: 2, category: 'Security', action: `SSL certificate expires in ${daysLeft} days — renew immediately`, impact: 'High — site will show security warnings' });
  }

  // SEO
  const seoScore = data.performance?.seo ?? 0;
  const advSeoIssues = data.advancedSEO?.duplicateContent?.issues?.length ?? 0;
  const adjustedSeo = Math.max(0, Math.min(100, seoScore - (advSeoIssues * 3)));
  breakdown.push({
    category: 'SEO',
    score: Math.round(adjustedSeo),
    weight: WEIGHTS.seo,
    weightedScore: Math.round(adjustedSeo * WEIGHTS.seo),
    status: status(adjustedSeo),
    topIssue: adjustedSeo < 50 ? 'Major SEO issues — site may not rank in search engines' : adjustedSeo < 80 ? 'SEO improvements available' : null,
  });
  if (adjustedSeo < 60) actions.push({ priority: 2, category: 'SEO', action: 'Fix meta titles, descriptions, canonical URLs, and structured data', impact: 'High — directly affects search engine visibility' });
  if (data.advancedSEO?.schemaValidation?.totalSchemas === 0) {
    actions.push({ priority: 3, category: 'SEO', action: 'Add Schema.org structured data for Google Rich Results eligibility', impact: 'Medium — can increase click-through rate by 30%' });
  }

  // Accessibility
  const a11yScore = data.performance?.accessibility ?? data.accessibilityAudit?.score ?? data.advancedSEO?.accessibility?.score ?? 0;
  breakdown.push({
    category: 'Accessibility',
    score: a11yScore,
    weight: WEIGHTS.accessibility,
    weightedScore: Math.round(a11yScore * WEIGHTS.accessibility),
    status: status(a11yScore),
    topIssue: a11yScore < 50 ? 'Significant accessibility barriers for disabled users' : a11yScore < 80 ? 'Some accessibility issues to address' : null,
  });
  if (a11yScore < 50) actions.push({ priority: 2, category: 'Accessibility', action: 'Add alt text to images, labels to forms, and fix heading hierarchy', impact: 'High — affects 15% of users + legal compliance risk' });

  // Content Quality
  let contentScore = 50;
  const readability = data.readability;
  if (readability) {
    contentScore = Math.min(100, Math.max(0,
      (readability.fleschScore > 30 ? 30 : 0) +
      (readability.wordCount > 300 ? 25 : readability.wordCount > 100 ? 15 : 0) +
      (readability.avgWordsPerSentence < 25 ? 20 : 10) +
      (data.seoAudit?.h1Count === 1 ? 15 : 0) +
      (data.seoAudit?.ogTags && Object.keys(data.seoAudit.ogTags).length > 0 ? 10 : 0)
    ));
  }
  breakdown.push({
    category: 'Content',
    score: contentScore,
    weight: WEIGHTS.content,
    weightedScore: Math.round(contentScore * WEIGHTS.content),
    status: status(contentScore),
    topIssue: contentScore < 50 ? 'Content quality needs improvement' : null,
  });

  // Infrastructure
  let infraScore = 50;
  if (data.ssl) infraScore += 15;
  if (data.network?.spf) infraScore += 10;
  if (data.network?.dmarc) infraScore += 10;
  if (data.sitemapData?.found) infraScore += 10;
  if (data.robotsTxt?.found) infraScore += 5;
  infraScore = Math.min(100, infraScore);
  breakdown.push({
    category: 'Infrastructure',
    score: infraScore,
    weight: WEIGHTS.infrastructure,
    weightedScore: Math.round(infraScore * WEIGHTS.infrastructure),
    status: status(infraScore),
    topIssue: !data.network?.dmarc ? 'Missing DMARC — email spoofing risk' : !data.network?.spf ? 'Missing SPF record' : null,
  });
  if (!data.network?.dmarc) actions.push({ priority: 3, category: 'Infrastructure', action: 'Add DMARC DNS record to prevent email spoofing', impact: 'Medium — protects brand from phishing attacks' });

  const overall = Math.round(breakdown.reduce((sum, b) => sum + b.weightedScore, 0));

  let grade: string;
  if (overall >= 90) grade = 'A+';
  else if (overall >= 85) grade = 'A';
  else if (overall >= 80) grade = 'A-';
  else if (overall >= 75) grade = 'B+';
  else if (overall >= 70) grade = 'B';
  else if (overall >= 65) grade = 'B-';
  else if (overall >= 60) grade = 'C+';
  else if (overall >= 55) grade = 'C';
  else if (overall >= 50) grade = 'C-';
  else if (overall >= 40) grade = 'D';
  else grade = 'F';

  let comparisonText: string;
  if (overall >= 85) comparisonText = 'Top 5% of websites — enterprise-grade quality';
  else if (overall >= 70) comparisonText = 'Top 25% — better than most competitors';
  else if (overall >= 55) comparisonText = 'Average — significant room for improvement';
  else if (overall >= 40) comparisonText = 'Below average — falling behind competitors';
  else comparisonText = 'Bottom 20% — urgent improvements needed';

  actions.sort((a, b) => a.priority - b.priority);

  return { overall, grade, breakdown, prioritizedActions: actions.slice(0, 8), comparisonText };
}
