import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from './error.middleware';

const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.VIEWER]: 0,
  [Role.MEMBER]: 1,
  [Role.ADMIN]: 2,
  [Role.OWNER]: 3,
};

export function requireRole(minRole: Role) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) return next(new AppError('Unauthorized', 401, 'UNAUTHORIZED'));

    const orgId = req.params.orgId;
    if (!orgId) return next(new AppError('Organization ID required', 400, 'BAD_REQUEST'));

    const membership = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });

    if (!membership) {
      return next(new AppError('Access denied', 403, 'FORBIDDEN'));
    }

    if (ROLE_HIERARCHY[membership.role] < ROLE_HIERARCHY[minRole]) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }

    next();
  };
}
