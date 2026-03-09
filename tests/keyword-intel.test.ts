import { describe, it, expect } from 'vitest';
import { analyzeKeywordVisibility } from '../src/utils/keyword-intel';

describe('analyzeKeywordVisibility', () => {
  const result = analyzeKeywordVisibility(
    'Best Project Management Tools for Teams in 2025',
    'Compare the top project management tools. Find the best software for your team with pricing and features.',
    ['Best Project Management Tools', 'Features Comparison', 'Pricing Plans'],
    'Project management is essential for teams. The best tools include Asana, Monday, and Trello. Compare pricing and features to find the right fit.',
    'https://example.com/best-project-management-tools'
  );

  it('extracts primary keywords', () => {
    expect(result.primaryKeywords.length).toBeGreaterThan(0);
    const keywords = result.primaryKeywords.map(k => k.keyword);
    expect(keywords).toContain('project');
    expect(keywords).toContain('management');
    expect(keywords).toContain('tools');
  });

  it('assigns higher prominence to title keywords', () => {
    const titleKeyword = result.primaryKeywords.find(k => k.source.includes('title'));
    const bodyOnlyKeyword = result.primaryKeywords.find(k => k.source.length === 1 && k.source[0] === 'body');
    if (titleKeyword && bodyOnlyKeyword) {
      expect(titleKeyword.prominence).toBeGreaterThan(bodyOnlyKeyword.prominence);
    }
  });

  it('tracks keyword sources correctly', () => {
    const kw = result.primaryKeywords.find(k => k.keyword === 'project');
    expect(kw).toBeDefined();
    expect(kw!.source.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts long-tail phrases', () => {
    expect(result.longTailPhrases.length).toBeGreaterThan(0);
    const hasMultiWord = result.longTailPhrases.some(p => p.split(' ').length >= 2);
    expect(hasMultiWord).toBe(true);
  });

  it('detects search intent signals', () => {
    const si = result.searchIntentSignals;
    expect(si.informational + si.transactional + si.commercial + si.navigational).toBeGreaterThan(0);
    expect(si.commercial).toBeGreaterThan(0);
  });

  it('calculates coverage score between 0 and 100', () => {
    expect(result.estimatedKeywordCoverage).toBeGreaterThanOrEqual(0);
    expect(result.estimatedKeywordCoverage).toBeLessThanOrEqual(100);
  });

  it('detects content gaps', () => {
    const gapResult = analyzeKeywordVisibility(
      'Untitled Page',
      '',
      [],
      'Some content about widgets and gadgets.',
      'https://example.com/page'
    );
    expect(gapResult.contentGaps.length).toBeGreaterThan(0);
  });

  it('handles empty inputs gracefully', () => {
    const empty = analyzeKeywordVisibility('', '', [], '', '');
    expect(empty.primaryKeywords).toHaveLength(0);
    expect(empty.estimatedKeywordCoverage).toBe(0);
  });
});
