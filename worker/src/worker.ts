import 'dotenv/config';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient, JobStatus, ExecutionStatus, WorkerStatus, Prisma } from '@prisma/client';
import { config } from './config';
import { logger } from './logger';
import { executeJob } from './executor';
import { calculateRetryDelay } from './retry';

const prisma = new PrismaClient();

interface WorkerState {
  id: string;
  isRunning: boolean;
  isDraining: boolean;
  activeJobs: Map<string, Promise<void>>;
}

const state: WorkerState = {
  id: uuidv4(),
  isRunning: false,
  isDraining: false,
  activeJobs: new Map(),
};

/**
 * Register this worker process in the database.
 */
async function registerWorker(): Promise<void> {
  await prisma.worker.create({
    data: {
      id: state.id,
      hostname: os.hostname(),
      pid: process.pid,
      status: WorkerStatus.IDLE,
      concurrency: config.WORKER_CONCURRENCY,
      queues: [], // subscribes to all queues
      version: process.env.npm_package_version ?? '1.0.0',
      startedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });
  logger.info('Worker registered', { workerId: state.id, hostname: os.hostname() });
}

/**
 * Send a heartbeat to indicate this worker is alive.
 */
async function sendHeartbeat(): Promise<void> {
  const mem = process.memoryUsage();
  const activeJobCount = state.activeJobs.size;

  await prisma.$transaction([
    prisma.worker.update({
      where: { id: state.id },
      data: {
        lastSeenAt: new Date(),
        activeJobs: activeJobCount,
        status: state.isDraining
          ? WorkerStatus.DRAINING
          : activeJobCount > 0
          ? WorkerStatus.ACTIVE
          : WorkerStatus.IDLE,
      },
    }),
    prisma.workerHeartbeat.create({
      data: {
        workerId: state.id,
        activeJobs: activeJobCount,
        memoryUsage: mem.heapUsed,
      },
    }),
  ]);
}

/**
 * Atomically claim one job using a single UPDATE with a subquery.
 * Avoids interactive transactions which time out on Neon's free tier.
 */
async function claimNextJob() {
  // Single-statement atomic claim: UPDATE with WHERE on a subquery
  const result = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE jobs SET
      status = 'CLAIMED',
      claimed_by = ${state.id},
      claimed_at = NOW(),
      updated_at = NOW()
    WHERE id = (
      SELECT j.id
      FROM jobs j
      JOIN queues q ON q.id = j.queue_id
      WHERE j.status = 'PENDING'
        AND q.is_paused = false
        AND q.is_active = true
        AND (j.run_at IS NULL OR j.run_at <= NOW())
        AND (
          SELECT COUNT(*) FROM jobs running
          WHERE running.queue_id = j.queue_id AND running.status = 'RUNNING'
        ) < q.concurrency_limit
      ORDER BY j.priority DESC, j.created_at ASC
      LIMIT 1
      FOR UPDATE OF j SKIP LOCKED
    )
    RETURNING id
  `;

  if (result.length === 0) return null;

  return prisma.job.findUnique({
    where: { id: result[0].id },
    include: { queue: { include: { retryPolicy: true } } },
  });
}

/**
 * Process a single claimed job: execute, record result, handle retries / DLQ.
 */
async function processJob(
  claimedJob: Prisma.JobGetPayload<{ include: { queue: { include: { retryPolicy: true } } } }>
): Promise<void> {
  const startedAt = new Date();
  const attempt = claimedJob.attempts + 1;
  const timeout = claimedJob.timeout ?? claimedJob.queue.jobTimeout;

  // Mark as running
  await prisma.job.update({
    where: { id: claimedJob.id },
    data: { status: JobStatus.RUNNING, attempts: attempt, startedAt },
  });

  logger.info('Job started', { jobId: claimedJob.id, attempt, workerId: state.id });

  // Write start log
  await prisma.jobLog.create({
    data: {
      jobId: claimedJob.id,
      level: 'INFO',
      message: `Execution attempt #${attempt} started on worker ${state.id}`,
    },
  });

  const execResult = await executeJob(claimedJob, timeout);
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  const mem = process.memoryUsage();

  // Record execution entry
  await prisma.jobExecution.create({
    data: {
      jobId: claimedJob.id,
      workerId: state.id,
      attempt,
      status: execResult.success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED,
      startedAt,
      finishedAt,
      durationMs,
      error: execResult.error,
      errorStack: execResult.errorStack,
      result: (execResult.result as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      memoryUsage: mem.heapUsed,
    },
  });

  if (execResult.success) {
    await prisma.job.update({
      where: { id: claimedJob.id },
      data: {
        status: JobStatus.COMPLETED,
        result: execResult.result as Prisma.InputJsonValue,
        completedAt: finishedAt,
        lastError: null,
      },
    });

    // Update batch counters if applicable
    if (claimedJob.batchId) {
      await prisma.jobBatch.update({
        where: { id: claimedJob.batchId },
        data: { doneJobs: { increment: 1 }, pendingJobs: { decrement: 1 } },
      });
    }

    await prisma.jobLog.create({
      data: {
        jobId: claimedJob.id,
        level: 'INFO',
        message: `Job completed successfully in ${durationMs}ms`,
      },
    });

    // Update worker counter
    await prisma.worker.update({
      where: { id: state.id },
      data: { totalJobsDone: { increment: 1 } },
    });

    logger.info('Job completed', { jobId: claimedJob.id, durationMs });
  } else {
    // Failure: determine if we should retry
    const retryPolicy = claimedJob.queue.retryPolicy;
    const maxAttempts = claimedJob.maxAttempts;

    await prisma.jobLog.create({
      data: {
        jobId: claimedJob.id,
        level: 'ERROR',
        message: `Attempt #${attempt} failed: ${execResult.error}`,
        meta: { errorStack: execResult.errorStack } as Prisma.InputJsonValue,
      },
    });

    if (attempt < maxAttempts) {
      // Schedule retry
      let retryDelayMs = 5000; // default
      if (retryPolicy) {
        retryDelayMs = calculateRetryDelay(
          retryPolicy.strategy,
          retryPolicy.baseDelayMs,
          retryPolicy.maxDelayMs,
          retryPolicy.multiplier,
          attempt
        );
      }

      const nextRunAt = new Date(Date.now() + retryDelayMs);
      await prisma.job.update({
        where: { id: claimedJob.id },
        data: {
          status: JobStatus.SCHEDULED,
          runAt: nextRunAt,
          lastError: execResult.error,
          claimedBy: null,
          claimedAt: null,
        },
      });

      logger.warn('Job failed, scheduled for retry', {
        jobId: claimedJob.id,
        attempt,
        maxAttempts,
        nextRunAt,
      });
    } else {
      // Move to DLQ
      await prisma.$transaction([
        prisma.job.update({
          where: { id: claimedJob.id },
          data: {
            status: JobStatus.DEAD,
            lastError: execResult.error,
            completedAt: finishedAt,
            claimedBy: null,
            claimedAt: null,
          },
        }),
        prisma.dLQEntry.upsert({
          where: { jobId: claimedJob.id },
          update: {
            lastError: execResult.error ?? 'Unknown error',
            attempts: attempt,
            failedAt: finishedAt,
          },
          create: {
            jobId: claimedJob.id,
            queueId: claimedJob.queueId,
            reason: `Exhausted ${attempt} attempts`,
            lastError: execResult.error ?? 'Unknown error',
            attempts: attempt,
            payload: claimedJob.payload as Prisma.InputJsonValue,
          },
        }),
      ]);

      if (claimedJob.batchId) {
        await prisma.jobBatch.update({
          where: { id: claimedJob.batchId },
          data: { failedJobs: { increment: 1 }, pendingJobs: { decrement: 1 } },
        });
      }

      logger.error('Job moved to DLQ', { jobId: claimedJob.id, attempts: attempt });
    }
  }
}

/**
 * Main poll loop: continuously claim and process jobs while within concurrency limits.
 */
async function poll(): Promise<void> {
  if (state.isDraining) {
    logger.info('Worker draining, not picking up new jobs');
    return;
  }

  while (state.activeJobs.size < config.WORKER_CONCURRENCY) {
    const job = await claimNextJob();
    if (!job) break; // no pending jobs

    const promise = processJob(job).finally(() => {
      state.activeJobs.delete(job.id);
    });

    state.activeJobs.set(job.id, promise);
  }
}

async function main(): Promise<void> {
  await prisma.$connect();
  await registerWorker();

  state.isRunning = true;

  // Heartbeat timer
  const heartbeatTimer = setInterval(async () => {
    try {
      await sendHeartbeat();
    } catch (err) {
      logger.error('Heartbeat failed', { error: (err as Error).message });
    }
  }, config.HEARTBEAT_INTERVAL_MS);

  // Poll timer
  const pollTimer = setInterval(async () => {
    if (!state.isRunning) return;
    try {
      await poll();
    } catch (err) {
      logger.error('Poll error', { error: (err as Error).message });
    }
  }, config.WORKER_POLL_INTERVAL_MS);

  logger.info('Worker started', {
    workerId: state.id,
    concurrency: config.WORKER_CONCURRENCY,
    pollInterval: config.WORKER_POLL_INTERVAL_MS,
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.info(`Worker received ${signal}, draining...`);
    state.isDraining = true;
    clearInterval(pollTimer);

    // Wait for active jobs to finish (max 30s)
    const drainTimeout = setTimeout(() => {
      logger.error('Drain timeout exceeded, forcing shutdown');
      process.exit(1);
    }, 30000);

    await Promise.allSettled([...state.activeJobs.values()]);
    clearTimeout(drainTimeout);

    state.isRunning = false;
    clearInterval(heartbeatTimer);

    await prisma.worker.update({
      where: { id: state.id },
      data: { status: WorkerStatus.OFFLINE, lastSeenAt: new Date() },
    });

    await prisma.$disconnect();
    logger.info('Worker shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error('Worker failed to start', { error: err.message });
  process.exit(1);
});
