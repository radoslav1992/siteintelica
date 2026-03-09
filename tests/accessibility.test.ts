import { describe, it, expect } from 'vitest';
import { auditAccessibility } from '../src/utils/accessibility';

describe('auditAccessibility', () => {
  it('detects missing alt text on images', () => {
    const html = '<html lang="en"><body><img src="a.jpg"><img src="b.jpg" alt="ok"></body></html>';
    const result = auditAccessibility(html);
    const issue = result.issues.find(i => i.message.includes('missing alt text'));
    expect(issue).toBeDefined();
    expect(issue!.count).toBe(1);
  });

  it('passes when all images have alt text', () => {
    const html = '<html lang="en"><body><img src="a.jpg" alt="desc"></body></html>';
    const result = auditAccessibility(html);
    expect(result.passedChecks).toEqual(expect.arrayContaining([expect.stringContaining('alt text')]));
  });

  it('detects missing document language', () => {
    const html = '<html><body><p>Hello</p></body></html>';
    const result = auditAccessibility(html);
    const issue = result.issues.find(i => i.message.includes('lang attribute'));
    expect(issue).toBeDefined();
  });

  it('passes with document language set', () => {
    const html = '<html lang="en"><body></body></html>';
    const result = auditAccessibility(html);
    expect(result.passedChecks).toEqual(expect.arrayContaining([expect.stringContaining('language')]));
  });

  it('detects disabled zoom', () => {
    const html = '<html lang="en"><head><meta name="viewport" content="width=device-width, user-scalable=no"></head><body></body></html>';
    const result = auditAccessibility(html);
    const issue = result.issues.find(i => i.severity === 'critical');
    expect(issue).toBeDefined();
    expect(issue!.message).toContain('zoom');
  });

  it('detects missing main landmark', () => {
    const html = '<html lang="en"><body><div>content</div></body></html>';
    const result = auditAccessibility(html);
    const issue = result.issues.find(i => i.message.includes('<main>'));
    expect(issue).toBeDefined();
  });

  it('passes with main and nav landmarks', () => {
    const html = '<html lang="en"><body><nav>nav</nav><main>content</main></body></html>';
    const result = auditAccessibility(html);
    expect(result.passedChecks).toEqual(expect.arrayContaining([
      expect.stringContaining('Main landmark'),
      expect.stringContaining('Navigation landmark'),
    ]));
  });

  it('returns a score between 0 and 100', () => {
    const html = '<html lang="en"><body><main><nav>nav</nav><h1>Title</h1></main></body></html>';
    const result = auditAccessibility(html);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns a grade from A to F', () => {
    const html = '<html lang="en"><body><main><h1>Title</h1></main></body></html>';
    const result = auditAccessibility(html);
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade);
  });

  it('gives higher score for more accessible pages', () => {
    const good = '<html lang="en"><head><meta name="viewport" content="width=device-width"></head><body><a href="#main">skip</a><nav>nav</nav><main id="main"><h1>Title</h1><img src="x.jpg" alt="desc"></main></body></html>';
    const bad = '<html><body><img src="x.jpg"><div>content</div></body></html>';
    const goodResult = auditAccessibility(good);
    const badResult = auditAccessibility(bad);
    expect(goodResult.score).toBeGreaterThan(badResult.score);
  });
});
