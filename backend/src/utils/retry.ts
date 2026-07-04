import { RetryStrategy } from '@prisma/client';

export interface RetryPolicyConfig {
  strategy: RetryStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
}

/**
 * Calculate delay in ms before the next retry attempt.
 * attempt is 1-indexed (1 = first retry).
 */
export function calculateRetryDelay(config: RetryPolicyConfig, attempt: number): number {
  let delay: number;

  switch (config.strategy) {
    case RetryStrategy.FIXED:
      delay = config.baseDelayMs;
      break;

    case RetryStrategy.LINEAR:
      delay = config.baseDelayMs * attempt;
      break;

    case RetryStrategy.EXPONENTIAL:
      // delay = base * multiplier^(attempt-1) + jitter
      delay = config.baseDelayMs * Math.pow(config.multiplier, attempt - 1);
      // Add ±10% jitter to avoid thundering herd
      const jitter = delay * 0.1 * (Math.random() * 2 - 1);
      delay = Math.round(delay + jitter);
      break;

    default:
      delay = config.baseDelayMs;
  }

  return Math.min(delay, config.maxDelayMs);
}
