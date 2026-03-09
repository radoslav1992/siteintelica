import { describe, it, expect } from 'vitest';
import { calculateBusinessMetrics } from '../src/utils/business-intel';

describe('calculateBusinessMetrics', () => {
  const baseData = {
    technologies: [{ name: 'React' }, { name: 'Cloudflare' }],
    performance: { score: 80, seo: 90 },
    securityGrade: { grade: 'B', score: 75 },
    sitemapData: { found: true, urlCount: 50 },
    seoAudit: { h1Count: 1, canonical: true, viewport: true, lang: 'en', ogTags: { title: 'Test' } },
    readability: { wordCount: 2000 },
    trackers: [],
    seo: {},
  };

  it('returns all expected metric categories', () => {
    const result = calculateBusinessMetrics(baseData);
    expect(result).toHaveProperty('estimatedMonthlyVisitors');
    expect(result).toHaveProperty('techStackCost');
    expect(result).toHaveProperty('carbonFootprint');
    expect(result).toHaveProperty('domainAuthority');
    expect(result).toHaveProperty('hostingCost');
    expect(result).toHaveProperty('adRevenueEstimate');
  });

  it('uses Tranco rank when provided', () => {
    const withTranco = calculateBusinessMetrics(baseData, 5000);
    expect(withTranco.estimatedMonthlyVisitors.confidence).not.toBe('Low');
    expect(withTranco.estimatedMonthlyVisitors.high).toBeGreaterThan(0);
  });

  it('falls back to tech heuristics without Tranco', () => {
    const result = calculateBusinessMetrics(baseData);
    expect(result.estimatedMonthlyVisitors.low).toBeGreaterThan(0);
    expect(result.estimatedMonthlyVisitors.high).toBeGreaterThan(result.estimatedMonthlyVisitors.low);
  });

  it('calculates tech stack cost from known technologies', () => {
    const data = { ...baseData, technologies: [{ name: 'Shopify' }, { name: 'HubSpot' }] };
    const result = calculateBusinessMetrics(data);
    expect(result.techStackCost.totalMin).toBeGreaterThan(0);
    expect(result.techStackCost.breakdown.length).toBe(2);
  });

  it('returns null ad revenue when no ad networks detected', () => {
    const result = calculateBusinessMetrics(baseData);
    expect(result.adRevenueEstimate).toBeNull();
  });

  it('estimates ad revenue when ad tech is present', () => {
    const data = {
      ...baseData,
      technologies: [{ name: 'Google AdSense' }],
    };
    const result = calculateBusinessMetrics(data);
    expect(result.adRevenueEstimate).not.toBeNull();
    expect(result.adRevenueEstimate!.networks).toContain('Google AdSense');
  });

  it('carbon footprint rating improves with higher performance', () => {
    const goodPerf = calculateBusinessMetrics({ ...baseData, performance: { score: 95, seo: 95 } });
    const badPerf = calculateBusinessMetrics({ ...baseData, performance: { score: 20, seo: 20 } });
    expect(goodPerf.carbonFootprint.grams).toBeLessThan(badPerf.carbonFootprint.grams);
  });

  it('domain authority factors sum to score', () => {
    const result = calculateBusinessMetrics(baseData);
    const factorSum = result.domainAuthority.factors.reduce((s, f) => s + f.score, 0);
    expect(factorSum).toBe(result.domainAuthority.score);
  });

  it('handles correctly performance.score and performance.seo (not performanceScore)', () => {
    const data = { ...baseData, performance: { score: 75, seo: 80, accessibility: 90 } };
    const result = calculateBusinessMetrics(data);
    expect(result.domainAuthority.score).toBeGreaterThan(0);
  });
});
