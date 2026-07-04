import { JobStatus, JobType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { broadcast } from '../lib/websocket';
import { getPaginationParams, paginate } from '../utils/pagination';
import { isValidCron, getNextRunAt } from '../utils/cron';

export interface CreateJobDTO {
  name: string;
  type?: JobType;
  payload?: Record<string, unknown>;
  priority?: number;
  runAt?: string;         // ISO date - for delayed/scheduled
  cronExpression?: string; // for recurring
  maxAttempts?: number;
  timeout?: number;
  idempotencyKey?: string;
  parentJobId?: string;
}

export interface CreateBatchJobDTO {
  batchName: string;
  jobs: CreateJobDTO[];
}

export class JobService {
  static async create(queueId: string, dto: CreateJobDTO) {
    const queue = await prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue || !queue.isActive) throw new AppError('Queue not found', 404, 'NOT_FOUND');
    if (queue.isPaused) throw new AppError('Queue is paused', 409, 'QUEUE_PAUSED');

    // Idempotency check
    if (dto.idempotencyKey) {
      const existing = await prisma.job.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return existing;
    }

    let type: JobType = dto.type ?? JobType.IMMEDIATE;
    let runAt: Date | undefined;
    let status: JobStatus = JobStatus.PENDING;

    if (dto.cronExpression) {
      if (!isValidCron(dto.cronExpression)) {
        throw new AppError('Invalid cron expression', 422, 'INVALID_CRON');
      }
      type = JobType.RECURRING;
      runAt = getNextRunAt(dto.cronExpression);
      status = JobStatus.SCHEDULED;
    } else if (dto.runAt) {
      runAt = new Date(dto.runAt);
      if (runAt <= new Date()) {
        type = JobType.IMMEDIATE;
        status = JobStatus.PENDING;
      } else {
        type = JobType.DELAYED;
        status = JobStatus.SCHEDULED;
      }
    }

    const job = await prisma.job.create({
      data: {
        queueId,
        name: dto.name,
        type,
        status,
        priority: dto.priority ?? 0,
        payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
        runAt,
        cronExpression: dto.cronExpression,
        maxAttempts: dto.maxAttempts ?? queue.concurrencyLimit,
        timeout: dto.timeout,
        idempotencyKey: dto.idempotencyKey,
        parentJobId: dto.parentJobId,
      },
    });

    // If recurring, create a ScheduledJob entry
    if (type === JobType.RECURRING && dto.cronExpression && runAt) {
      await prisma.scheduledJob.create({
        data: {
          jobTemplateId: job.id,
          queueId,
          cronExpression: dto.cronExpression,
          name: dto.name,
          payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
          maxAttempts: dto.maxAttempts ?? 3,
          priority: dto.priority ?? 0,
          timeout: dto.timeout,
          nextRunAt: runAt,
        },
      });
    }

    broadcast(`queue:${queueId}`, { type: 'job.created', job });
    return job;
  }

  static async createBatch(queueId: string, dto: CreateBatchJobDTO) {
    const queue = await prisma.queue.findUnique({ where: { id: queueId } });
    if (!queue || !queue.isActive) throw new AppError('Queue not found', 404, 'NOT_FOUND');

    const batch = await prisma.jobBatch.create({
      data: {
        name: dto.batchName,
        totalJobs: dto.jobs.length,
        pendingJobs: dto.jobs.length,
      },
    });

    const jobs = await prisma.$transaction(
      dto.jobs.map((j) =>
        prisma.job.create({
          data: {
            queueId,
            batchId: batch.id,
            name: j.name,
            type: JobType.BATCH,
            status: JobStatus.PENDING,
            priority: j.priority ?? 0,
            payload: (j.payload ?? {}) as Prisma.InputJsonValue,
            maxAttempts: j.maxAttempts ?? 3,
            timeout: j.timeout,
          },
        })
      )
    );

    broadcast(`queue:${queueId}`, { type: 'batch.created', batch, count: jobs.length });
    return { batch, jobs };
  }

  static async list(queueId: string, query: Record<string, unknown>) {
    const params = getPaginationParams(query);
    const where: Prisma.JobWhereInput = { queueId };

    if (query.status) where.status = query.status as JobStatus;
    if (query.type) where.type = query.type as JobType;
    if (query.search) {
      where.name = { contains: String(query.search), mode: 'insensitive' };
    }

    const sortField = String(query.sort ?? 'createdAt');
    const sortDir = String(query.dir ?? 'desc') as 'asc' | 'desc';

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { [sortField]: sortDir }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { _count: { select: { executions: true, logs: true } } },
      }),
      prisma.job.count({ where }),
    ]);

    return paginate(jobs, total, params);
  }

  static async getById(id: string) {
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        executions: { orderBy: { startedAt: 'desc' }, take: 10 },
        logs: { orderBy: { timestamp: 'desc' }, take: 50 },
        queue: true,
        batch: true,
        parentJob: { select: { id: true, name: true, status: true } },
        childJobs: { select: { id: true, name: true, status: true } },
        dlqEntry: true,
      },
    });
    if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');
    return job;
  }

  static async cancel(id: string) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');

    const cancellable: JobStatus[] = [JobStatus.PENDING, JobStatus.SCHEDULED];
    if (!cancellable.includes(job.status)) {
      throw new AppError(`Cannot cancel job in status ${job.status}`, 409, 'INVALID_STATE');
    }

    const updated = await prisma.job.update({
      where: { id },
      data: { status: JobStatus.CANCELLED },
    });

    broadcast(`queue:${job.queueId}`, { type: 'job.cancelled', job: updated });
    return updated;
  }

  static async retry(id: string) {
    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) throw new AppError('Job not found', 404, 'NOT_FOUND');

    const retryable: JobStatus[] = [JobStatus.FAILED, JobStatus.DEAD, JobStatus.CANCELLED];
    if (!retryable.includes(job.status)) {
      throw new AppError(`Job is not in a retryable state`, 409, 'INVALID_STATE');
    }

    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: JobStatus.PENDING,
        attempts: 0,
        lastError: null,
        claimedBy: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
      },
    });

    broadcast(`queue:${job.queueId}`, { type: 'job.retried', job: updated });
    return updated;
  }

  static async getLogs(jobId: string, query: Record<string, unknown>) {
    const params = getPaginationParams(query);
    const [logs, total] = await Promise.all([
      prisma.jobLog.findMany({
        where: { jobId },
        orderBy: { timestamp: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.jobLog.count({ where: { jobId } }),
    ]);
    return paginate(logs, total, params);
  }

  static async getMetrics(queueId: string) {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 3600000);
    const dayAgo = new Date(now.getTime() - 86400000);

    const [hourly, daily, avgDuration] = await Promise.all([
      prisma.job.groupBy({
        by: ['status'],
        where: { queueId, updatedAt: { gte: hourAgo } },
        _count: { status: true },
      }),
      prisma.job.groupBy({
        by: ['status'],
        where: { queueId, updatedAt: { gte: dayAgo } },
        _count: { status: true },
      }),
      prisma.jobExecution.aggregate({
        where: { job: { queueId }, status: 'COMPLETED', startedAt: { gte: dayAgo } },
        _avg: { durationMs: true },
      }),
    ]);

    return {
      hourly: Object.fromEntries(hourly.map((s) => [s.status, s._count.status])),
      daily: Object.fromEntries(daily.map((s) => [s.status, s._count.status])),
      avgDurationMs: avgDuration._avg.durationMs ?? 0,
    };
  }
}
