import * as cron from 'node-cron';
import { JobStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { broadcast } from '../lib/websocket';
import { LockService } from './lock.service';
import { getNextRunAt } from '../utils/cron';
import { logger } from '../lib/logger';

const SCHEDULER_LOCK_KEY = 'scheduler:tick';
const SCHEDULER_LOCK_TTL = 55000; // 55s lock, tick every 30s

/**
 * Scheduler service: runs every 30 seconds and:
 * 1. Promotes delayed/scheduled jobs whose runAt <= now to PENDING
 * 2. Spawns new job instances for recurring (cron) jobs
 */
export class SchedulerService {
  private static task: cron.ScheduledTask | null = null;

  static start(): void {
    // Tick every 30 seconds
    SchedulerService.task = cron.schedule('*/30 * * * * *', () => {
      SchedulerService.tick().catch((err) =>
        logger.error('Scheduler tick error', { error: err.message })
      );
    });
    logger.info('Scheduler started');
  }

  static stop(): void {
    SchedulerService.task?.stop();
    logger.info('Scheduler stopped');
  }

  static async tick(): Promise<void> {
    const holder = `scheduler:${process.pid}`;
    const result = await LockService.withLock(SCHEDULER_LOCK_KEY, holder, SCHEDULER_LOCK_TTL, async () => {
      await Promise.all([
        SchedulerService.promoteDelayedJobs(),
        SchedulerService.triggerRecurringJobs(),
      ]);
    });

    if (result === null) {
      logger.debug('Scheduler lock not acquired, skipping tick');
    }
  }

  private static async promoteDelayedJobs(): Promise<void> {
    const now = new Date();
    const promoted = await prisma.job.updateMany({
      where: {
        status: JobStatus.SCHEDULED,
        runAt: { lte: now },
        type: { in: ['DELAYED', 'SCHEDULED'] },
      },
      data: { status: JobStatus.PENDING, runAt: null },
    });

    if (promoted.count > 0) {
      logger.info(`Promoted ${promoted.count} delayed jobs to PENDING`);
      broadcast('scheduler', { type: 'jobs.promoted', count: promoted.count });
    }
  }

  private static async triggerRecurringJobs(): Promise<void> {
    const now = new Date();
    const dueJobs = await prisma.scheduledJob.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
    });

    for (const sched of dueJobs) {
      try {
        await prisma.$transaction(async (tx) => {
          // Create new job instance
          await tx.job.create({
            data: {
              queueId: sched.queueId,
              name: sched.name,
              type: 'RECURRING',
              status: JobStatus.PENDING,
              priority: sched.priority,
              payload: sched.payload as Prisma.InputJsonValue,
              maxAttempts: sched.maxAttempts,
              timeout: sched.timeout,
              cronExpression: sched.cronExpression,
            },
          });

          // Advance nextRunAt
          const next = getNextRunAt(sched.cronExpression, now);
          await tx.scheduledJob.update({
            where: { id: sched.id },
            data: { lastRunAt: now, nextRunAt: next },
          });
        });
      } catch (err) {
        logger.error('Failed to spawn recurring job', {
          scheduledJobId: sched.id,
          error: (err as Error).message,
        });
      }
    }

    if (dueJobs.length > 0) {
      logger.info(`Triggered ${dueJobs.length} recurring jobs`);
    }
  }
}
