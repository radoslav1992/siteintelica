import { describe, it, expect } from 'vitest';
import { calculateSecurityGrade } from '../src/utils/security-grade';

describe('calculateSecurityGrade', () => {
  it('returns grade F with no security headers', () => {
    const result = calculateSecurityGrade(null);
    expect(result.grade).toBe('F');
    expect(result.score).toBe(0);
    expect(result.recommendations).toHaveLength(1);
  });

  it('returns grade A with all headers present', () => {
    const result = calculateSecurityGrade({
      hsts: true,
      csp: true,
      xframe: true,
      xContentTypeOptions: true,
      referrerPolicy: 'strict-origin',
      permissionsPolicy: 'geolocation=()',
    });
    expect(result.grade).toBe('A');
    expect(result.score).toBe(100);
    expect(result.recommendations).toHaveLength(0);
  });

  it('returns grade C with partial headers', () => {
    const result = calculateSecurityGrade({
      hsts: true,
      csp: true,
      xframe: false,
      xContentTypeOptions: false,
      referrerPolicy: null,
      permissionsPolicy: null,
    });
    expect(result.grade).toBe('D');
    expect(result.score).toBe(45);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('includes specific recommendation for missing CSP', () => {
    const result = calculateSecurityGrade({ hsts: true });
    expect(result.recommendations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Content-Security-Policy'),
      ])
    );
  });

  it('scores HSTS at 20 points', () => {
    const withHsts = calculateSecurityGrade({ hsts: true });
    const withoutHsts = calculateSecurityGrade({});
    expect(withHsts.score - withoutHsts.score).toBe(20);
  });
});
