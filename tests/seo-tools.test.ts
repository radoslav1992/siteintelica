import { describe, it, expect } from 'vitest';
import { auditSEO, analyzeReadability, extractOutboundLinks, extractStructuredData, extractSocialProfiles } from '../src/utils/seo-tools';

describe('auditSEO', () => {
  const html = `
    <html lang="en">
    <head>
      <meta name="viewport" content="width=device-width">
      <link rel="canonical" href="https://example.com/">
      <meta property="og:title" content="Test">
      <meta name="twitter:card" content="summary">
    </head>
    <body>
      <h1>Main Title</h1>
      <h2>Subtitle</h2>
      <img src="a.jpg" alt="has alt">
      <img src="b.jpg">
    </body>
    </html>
  `;

  it('detects correct h1 count', () => {
    const result = auditSEO(html);
    expect(result.h1Count).toBe(1);
  });

  it('detects images with and without alt text', () => {
    const result = auditSEO(html);
    expect(result.imagesTotal).toBe(2);
    expect(result.imagesMissingAlt).toBe(1);
  });

  it('extracts Open Graph tags', () => {
    const result = auditSEO(html);
    expect(result.ogTags['title']).toBe('Test');
  });

  it('extracts Twitter card tags', () => {
    const result = auditSEO(html);
    expect(result.twitterTags['card']).toBe('summary');
  });

  it('detects canonical URL', () => {
    const result = auditSEO(html);
    expect(result.canonical).toBe('https://example.com/');
  });

  it('detects HTML lang attribute', () => {
    const result = auditSEO(html);
    expect(result.lang).toBe('en');
  });

  it('detects viewport meta tag', () => {
    const result = auditSEO(html);
    expect(result.viewport).toBe(true);
  });
});

describe('analyzeReadability', () => {
  it('counts words accurately', () => {
    const html = '<p>The quick brown fox jumps over the lazy dog.</p>';
    const result = analyzeReadability(html);
    expect(result.wordCount).toBe(9);
  });

  it('returns a Flesch score between 0 and 100', () => {
    const html = '<p>Simple words make text easy to read. Short sentences help a lot.</p>';
    const result = analyzeReadability(html);
    expect(result.fleschScore).toBeGreaterThanOrEqual(0);
    expect(result.fleschScore).toBeLessThanOrEqual(100);
  });

  it('returns a grade level string', () => {
    const html = '<p>Hello world.</p>';
    const result = analyzeReadability(html);
    expect(result.gradeLevel).toBeDefined();
    expect(typeof result.gradeLevel).toBe('string');
  });
});

describe('extractOutboundLinks', () => {
  it('extracts external links and excludes same domain', () => {
    const html = `
      <a href="https://google.com">Google</a>
      <a href="https://example.com/page">Internal</a>
      <a href="https://github.com">GitHub</a>
    `;
    const result = extractOutboundLinks(html, 'example.com');
    expect(result).toHaveLength(2);
    expect(result.map(l => l.domain)).toContain('google.com');
    expect(result.map(l => l.domain)).toContain('github.com');
  });

  it('deduplicates by domain', () => {
    const html = `
      <a href="https://google.com/a">A</a>
      <a href="https://google.com/b">B</a>
    `;
    const result = extractOutboundLinks(html, 'example.com');
    expect(result).toHaveLength(1);
  });
});

describe('extractStructuredData', () => {
  it('extracts JSON-LD schemas', () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","name":"Test"}</script>`;
    const result = extractStructuredData(html);
    expect(result.jsonLd).toHaveLength(1);
    expect(result.jsonLd[0].type).toBe('Organization');
  });

  it('counts total schemas', () => {
    const html = `
      <script type="application/ld+json">{"@type":"Organization"}</script>
      <div itemtype="https://schema.org/Product"></div>
    `;
    const result = extractStructuredData(html);
    expect(result.totalSchemas).toBe(2);
  });
});

describe('extractSocialProfiles', () => {
  it('detects Twitter/X links', () => {
    const html = '<a href="https://twitter.com/testuser">Twitter</a>';
    const result = extractSocialProfiles(html);
    expect(result).toHaveLength(1);
    expect(result[0].platform).toBe('Twitter / X');
  });

  it('detects GitHub links', () => {
    const html = '<a href="https://github.com/testorg">GitHub</a>';
    const result = extractSocialProfiles(html);
    expect(result[0].platform).toBe('GitHub');
  });

  it('deduplicates platforms', () => {
    const html = `
      <a href="https://twitter.com/a">A</a>
      <a href="https://twitter.com/b">B</a>
    `;
    const result = extractSocialProfiles(html);
    expect(result).toHaveLength(1);
  });
});
