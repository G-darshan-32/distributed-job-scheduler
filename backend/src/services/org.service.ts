import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { toSlug } from '../utils/slug';

export class OrgService {
  static async create(userId: string, name: string) {
    const slug = toSlug(name);
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new AppError('Organization slug already exists', 409, 'CONFLICT');

    return prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name, slug } });
      await tx.orgMembership.create({
        data: { userId, organizationId: org.id, role: Role.OWNER },
      });
      return org;
    });
  }

  static async listForUser(userId: string) {
    return prisma.organization.findMany({
      where: { memberships: { some: { userId } }, isActive: true },
      include: { memberships: { where: { userId }, select: { role: true } } },
    });
  }

  static async getById(id: string) {
    const org = await prisma.organization.findUnique({
      where: { id },
      include: { memberships: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    if (!org) throw new AppError('Organization not found', 404, 'NOT_FOUND');
    return org;
  }

  static async addMember(orgId: string, email: string, role: Role) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');

    return prisma.orgMembership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
      update: { role },
      create: { userId: user.id, organizationId: orgId, role },
    });
  }

  static async removeMember(orgId: string, userId: string) {
    await prisma.orgMembership.delete({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
  }
}
