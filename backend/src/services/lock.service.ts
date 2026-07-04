import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

/**
 * Database-backed distributed lock using advisory-style row locking.
 * For single-region deployments this is sufficient; for multi-region, Redis-based
 * Redlock would be preferred (see TradeOff docs).
 */
export class LockService {
  /**
   * Acquire a named lock for `ttlMs` milliseconds.
   * Returns true if acquired, false if already held.
   */
  static async acquire(key: string, holder: string, ttlMs: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlMs);

    try {
      await prisma.$executeRaw`
        INSERT INTO distributed_locks (key, holder, expires_at, created_at)
        VALUES (${key}, ${holder}, ${expiresAt}, NOW())
        ON CONFLICT (key) DO UPDATE
          SET holder = ${holder}, expires_at = ${expiresAt}
          WHERE distributed_locks.expires_at < NOW()
      `;

      // Verify we hold the lock
      const lock = await prisma.distributedLock.findUnique({ where: { key } });
      return lock?.holder === holder;
    } catch (err) {
      logger.debug('Lock acquire failed', { key, holder, err });
      return false;
    }
  }

  static async release(key: string, holder: string): Promise<void> {
    await prisma.distributedLock.deleteMany({
      where: { key, holder },
    });
  }

  static async extend(key: string, holder: string, ttlMs: number): Promise<boolean> {
    const expiresAt = new Date(Date.now() + ttlMs);
    const result = await prisma.distributedLock.updateMany({
      where: { key, holder },
      data: { expiresAt },
    });
    return result.count > 0;
  }

  /**
   * Execute fn while holding a distributed lock.
   */
  static async withLock<T>(
    key: string,
    holder: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const acquired = await LockService.acquire(key, holder, ttlMs);
    if (!acquired) return null;

    try {
      return await fn();
    } finally {
      await LockService.release(key, holder);
    }
  }
}
