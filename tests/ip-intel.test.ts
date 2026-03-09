import { describe, it, expect } from 'vitest';

describe('CLOUD_PROVIDERS mapping', () => {
  const CLOUD_PROVIDERS: Record<string, { name: string; tier: string; costMultiplier: number }> = {
    'amazon': { name: 'Amazon Web Services', tier: 'Enterprise Cloud', costMultiplier: 1.0 },
    'google': { name: 'Google Cloud Platform', tier: 'Enterprise Cloud', costMultiplier: 0.9 },
    'cloudflare': { name: 'Cloudflare', tier: 'CDN / Edge', costMultiplier: 0.3 },
    'hetzner': { name: 'Hetzner', tier: 'Budget Cloud', costMultiplier: 0.2 },
    'vercel': { name: 'Vercel', tier: 'Serverless', costMultiplier: 0.15 },
  };

  it('matches Amazon from org string', () => {
    const org = 'Amazon.com Inc. AS16509'.toLowerCase();
    const match = Object.entries(CLOUD_PROVIDERS).find(([keyword]) => org.includes(keyword));
    expect(match).toBeDefined();
    expect(match![1].name).toBe('Amazon Web Services');
  });

  it('matches Cloudflare from ISP string', () => {
    const org = 'cloudflare inc'.toLowerCase();
    const match = Object.entries(CLOUD_PROVIDERS).find(([keyword]) => org.includes(keyword));
    expect(match).toBeDefined();
    expect(match![1].tier).toBe('CDN / Edge');
  });

  it('returns correct cost multiplier for budget providers', () => {
    expect(CLOUD_PROVIDERS['hetzner'].costMultiplier).toBeLessThan(CLOUD_PROVIDERS['amazon'].costMultiplier);
  });

  it('serverless providers have lowest cost multiplier', () => {
    expect(CLOUD_PROVIDERS['vercel'].costMultiplier).toBeLessThan(CLOUD_PROVIDERS['hetzner'].costMultiplier);
  });
});
