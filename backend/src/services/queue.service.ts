import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { broadcast } from '../lib/websocket';
import { toSlug } from '../utils/slug';
import { getPaginationParams, paginate } from '../utils/pagination';

export interface CreateQueueDTO {
  name: string;
  description?: string;
  priority?: number;
  concurrencyLimit?: number;
  retryPolicyId?: string;
  rateLimitPerMin?: number;
  jobTimeout?: number;
}

export interface UpdateQueueDTO extends Partial<CreateQueueDTO> {
  isPaused?: boolean;
}

export class QueueService {
  static async create(projectId: string, dto: CreateQueueDTO) {
    const slug = toSlug(dto.name);
    const existing = await prisma.queue.findUnique({
      where: { projectId_slug: { projectId, slug } },
    });
    if (existing) throw new AppError('Queue name already exists in this project', 409, 'CONFLICT');

    return prisma.queue.create({
      data: { projectId, slug, ...dto },
      include: { retryPolicy: true },
    });
  }

  static async list(projectId: string, query: Record<string, unknown>) {
    const params = getPaginationParams(query);
    const [queues, total] = await Promise.all([
      prisma.queue.findMany({
        where: { projectId, isActive: true },
        include: { retryPolicy: true, _count: { select: { jobs: true } } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.queue.count({ where: { projectId, isActive: true } }),
    ]);
    return paginate(queues, total, params);
  }

  static async getById(id: string) {
    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { retryPolicy: true, project: true },
    });
    if (!queue) throw new AppError('Queue not found', 404, 'NOT_FOUND');
    return queue;
  }

  static async update(id: string, dto: UpdateQueueDTO) {
    const queue = await prisma.queue.findUnique({ where: { id } });
    if (!queue) throw new AppError('Queue not found', 404, 'NOT_FOUND');

    const updated = await prisma.queue.update({ where: { id }, data: dto });
    broadcast(`queue:${id}`, { type: 'queue.updated', queue: updated });
    return updated;
  }

  static async pause(id: string) {
    return QueueService.update(id, { isPaused: true });
  }

  static async resume(id: string) {
    return QueueService.update(id, { isPaused: false });
  }

  static async delete(id: string) {
    const queue = await prisma.queue.findUnique({ where: { id } });
    if (!queue) throw new AppError('Queue not found', 404, 'NOT_FOUND');
    await prisma.queue.update({ where: { id }, data: { isActive: false } });
  }

  static async getStats(id: string) {
    const [statusCounts, recentThroughput] = await Promise.all([
      prisma.job.groupBy({
        by: ['status'],
        where: { queueId: id },
        _count: { status: true },
      }),
      prisma.job.count({
        where: {
          queueId: id,
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // last hour
        },
      }),
    ]);

    const counts = Object.fromEntries(
      statusCounts.map((s) => [s.status, s._count.status])
    );

    return {
      pending: counts['PENDING'] ?? 0,
      running: counts['RUNNING'] ?? 0,
      completed: counts['COMPLETED'] ?? 0,
      failed: counts['FAILED'] ?? 0,
      dead: counts['DEAD'] ?? 0,
      scheduled: counts['SCHEDULED'] ?? 0,
      throughputLastHour: recentThroughput,
    };
  }
}
