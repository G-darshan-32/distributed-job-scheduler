import { calculateRetryDelay } from '../src/utils/retry';
import { RetryStrategy } from '@prisma/client';

describe('Retry Delay Calculator', () => {
  const base = { maxDelayMs: 60000, multiplier: 2 };

  describe('FIXED strategy', () => {
    it('returns the same delay for every attempt', () => {
      const config = { ...base, strategy: RetryStrategy.FIXED, baseDelayMs: 5000 };
      expect(calculateRetryDelay(config, 1)).toBe(5000);
      expect(calculateRetryDelay(config, 2)).toBe(5000);
      expect(calculateRetryDelay(config, 5)).toBe(5000);
    });
  });

  describe('LINEAR strategy', () => {
    it('increases delay linearly with each attempt', () => {
      const config = { ...base, strategy: RetryStrategy.LINEAR, baseDelayMs: 2000 };
      expect(calculateRetryDelay(config, 1)).toBe(2000);
      expect(calculateRetryDelay(config, 2)).toBe(4000);
      expect(calculateRetryDelay(config, 3)).toBe(6000);
    });

    it('caps at maxDelayMs', () => {
      const config = { ...base, strategy: RetryStrategy.LINEAR, baseDelayMs: 25000, maxDelayMs: 60000 };
      // 3 * 25000 = 75000 > 60000
      expect(calculateRetryDelay(config, 3)).toBe(60000);
    });
  });

  describe('EXPONENTIAL strategy', () => {
    it('grows exponentially', () => {
      const config = { ...base, strategy: RetryStrategy.EXPONENTIAL, baseDelayMs: 1000 };
      // base * 2^(attempt-1)
      const d1 = calculateRetryDelay(config, 1);
      const d2 = calculateRetryDelay(config, 2);
      const d3 = calculateRetryDelay(config, 3);

      // With ±10% jitter, ratios should be roughly 2x
      expect(d1).toBeGreaterThan(800);
      expect(d1).toBeLessThan(1200);
      expect(d2).toBeGreaterThan(1600);
      expect(d2).toBeLessThan(2400);
      expect(d3).toBeGreaterThan(3200);
      expect(d3).toBeLessThan(4800);
    });

    it('caps at maxDelayMs', () => {
      const config = {
        strategy: RetryStrategy.EXPONENTIAL,
        baseDelayMs: 1000,
        maxDelayMs: 5000,
        multiplier: 10,
      };
      // attempt 3: 1000 * 10^2 = 100000 >> 5000
      expect(calculateRetryDelay(config, 3)).toBeLessThanOrEqual(5000);
    });
  });
});
