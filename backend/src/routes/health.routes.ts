import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { getConnectedClientCount } from '../lib/websocket';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const dbCheck = await prisma.$queryRaw`SELECT 1`.then(() => 'ok').catch(() => 'error');

  let cacheStatus = 'ok';
  try {
    await redis.ping();
  } catch {
    cacheStatus = 'unavailable';
  }

  const overall = dbCheck === 'ok' ? 'ok' : 'degraded';

  res.status(overall === 'ok' ? 200 : 503).json({
    status: overall,
    timestamp: new Date().toISOString(),
    services: { database: dbCheck, redis: cacheStatus },
    websocketClients: getConnectedClientCount(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
  });
});

export default router;
