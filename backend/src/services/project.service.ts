import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { toSlug } from '../utils/slug';
import { getPaginationParams, paginate } from '../utils/pagination';

export class ProjectService {
  static async create(orgId: string, name: string, description?: string) {
    const slug = toSlug(name);
    const existing = await prisma.project.findUnique({
      where: { organizationId_slug: { organizationId: orgId, slug } },
    });
    if (existing) throw new AppError('Project name already exists', 409, 'CONFLICT');

    return prisma.project.create({
      data: { organizationId: orgId, name, slug, description },
    });
  }

  static async list(orgId: string, query: Record<string, unknown>) {
    const params = getPaginationParams(query);
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where: { organizationId: orgId, isActive: true },
        include: { _count: { select: { queues: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.project.count({ where: { organizationId: orgId, isActive: true } }),
    ]);
    return paginate(projects, total, params);
  }

  static async getById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { organization: true, queues: { where: { isActive: true } } },
    });
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');
    return project;
  }

  static async update(id: string, data: { name?: string; description?: string }) {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');
    return prisma.project.update({ where: { id }, data });
  }

  static async delete(id: string) {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) throw new AppError('Project not found', 404, 'NOT_FOUND');
    await prisma.project.update({ where: { id }, data: { isActive: false } });
  }
}
