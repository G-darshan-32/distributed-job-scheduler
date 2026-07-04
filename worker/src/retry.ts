import { RetryStrategy } from '@prisma/client';

export function calculateRetryDelay(
  strategy: RetryStrategy,
  baseDelayMs: number,
  maxDelayMs: number,
  multiplier: number,
  attempt: number
): number {
  let delay: number;
  switch (strategy) {
    case RetryStrategy.FIXED:
      delay = baseDelayMs;
      break;
    case RetryStrategy.LINEAR:
      delay = baseDelayMs * attempt;
      break;
    case RetryStrategy.EXPONENTIAL:
    default:
      delay = baseDelayMs * Math.pow(multiplier, attempt - 1);
      // ±10% jitter
      delay += delay * 0.1 * (Math.random() * 2 - 1);
      break;
  }
  return Math.min(Math.round(delay), maxDelayMs);
}
