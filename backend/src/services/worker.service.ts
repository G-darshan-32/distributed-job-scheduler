import { WorkerStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { config } from '../config';
import { broadcast } from '../lib/websocket';

export class WorkerService {
  static async list() {
    const staleThreshold = new Date(Date.now() - config.WORKER_STALE_THRESHOLD_MS);

    // Mark stale workers offline
    await prisma.worker.updateMany({
      where: {
        status: { not: WorkerStatus.OFFLINE },
        lastSeenAt: { lt: staleThreshold },
      },
      data: { status: WorkerStatus.OFFLINE },
    });

    return prisma.worker.findMany({
      orderBy: { lastSeenAt: 'desc' },
      include: {
        _count: { select: { executions: true } },
      },
    });
  }

  static async getById(id: string) {
    const worker = await prisma.worker.findUnique({
      where: { id },
      include: {
        heartbeats: { orderBy: { timestamp: 'desc' }, take: 60 },
        executions: { orderBy: { startedAt: 'desc' }, take: 10 },
      },
    });
    if (!worker) throw new AppError('Worker not found', 404, 'NOT_FOUND');
    return worker;
  }

  static async getHeartbeats(workerId: string, minutes = 60) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return prisma.workerHeartbeat.findMany({
      where: { workerId, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    });
  }

  static async drain(id: string) {
    const worker = await prisma.worker.update({
      where: { id },
      data: { status: WorkerStatus.DRAINING },
    });
    broadcast('workers', { type: 'worker.draining', workerId: id });
    return worker;
  }

  static async getSystemMetrics() {
    const [workers, jobs] = await Promise.all([
      prisma.worker.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.job.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    return {
      workers: Object.fromEntries(workers.map((w) => [w.status, w._count.status])),
      jobs: Object.fromEntries(jobs.map((j) => [j.status, j._count.status])),
    };
  }
}
