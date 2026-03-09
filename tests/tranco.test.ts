import { describe, it, expect } from 'vitest';
import { rankToTraffic } from '../src/utils/tranco';

describe('rankToTraffic', () => {
  it('returns high traffic for rank 1', () => {
    const result = rankToTraffic(1);
    expect(result.low).toBeGreaterThan(1_000_000_000);
    expect(result.confidence).toBe('High');
  });

  it('returns lower traffic for higher ranks', () => {
    const rank100 = rankToTraffic(100);
    const rank10000 = rankToTraffic(10000);
    expect(rank100.high).toBeGreaterThan(rank10000.high);
  });

  it('has wider confidence bands for lower-ranked domains', () => {
    const top = rankToTraffic(500);
    const bottom = rankToTraffic(500000);
    expect(top.confidence).toBe('High');
    expect(bottom.confidence).toBe('Low');
  });

  it('returns a range where low is less than high', () => {
    const result = rankToTraffic(5000);
    expect(result.low).toBeLessThan(result.high);
  });

  it('produces reasonable estimates for mid-range ranks', () => {
    const result = rankToTraffic(10000);
    expect(result.low).toBeGreaterThan(10_000);
    expect(result.high).toBeLessThan(100_000_000);
  });
});
