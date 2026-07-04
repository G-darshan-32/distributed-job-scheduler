import { config } from '../config';
import { logger } from './logger';

// Lazy Redis import — if connection fails we fall back to a no-op stub
// so the app runs without Redis in development.
let redisInstance: import('ioredis').Redis | null = null;

async function getRedis() {
  if (redisInstance) return redisInstance;
  const { default: Redis } = await import('ioredis');
  redisInstance = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redisInstance.on('connect', () => logger.info('Redis connected'));
  redisInstance.on('error', () => {}); // silence — already warned on connect
  return redisInstance;
}

// Minimal stub that silently no-ops when Redis is unavailable
const stub = {
  ping: async () => 'PONG',
  get: async () => null,
  set: async () => null,
  del: async () => 0,
  quit: async () => 'OK',
} as unknown as import('ioredis').Redis;

export let redis: import('ioredis').Redis = stub;

export async function connectRedis(): Promise<void> {
  try {
    const client = await getRedis();
    await client.connect();
    redis = client;
    logger.info('Redis connected');
  } catch (err) {
    logger.warn('Redis unavailable — running without cache (OK for dev)', {
      error: (err as Error).message,
    });
    redis = stub;
  }
}

export async function disconnectRedis(): Promise<void> {
  try {
    if (redisInstance) await redisInstance.quit();
  } catch {
    // ignore
  }
}
