import request from 'supertest';
import { Express } from 'express';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

export async function createTestUser(email = 'test@example.com', password = 'Test@1234') {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.create({ data: { email, passwordHash, name: 'Test User' } });
}

export async function loginTestUser(app: Express, email = 'test@example.com', password = 'Test@1234') {
  const res = await request(app).post('/api/v1/auth/login').send({ email, password });
  return res.body.data.accessToken as string;
}

export async function createTestOrg(userId: string, name = 'Test Org') {
  const org = await prisma.organization.create({ data: { name, slug: `test-org-${Date.now()}` } });
  await prisma.orgMembership.create({
    data: { userId, organizationId: org.id, role: 'OWNER' },
  });
  return org;
}

export async function createTestProject(orgId: string, name = 'Test Project') {
  return prisma.project.create({
    data: { organizationId: orgId, name, slug: `test-project-${Date.now()}` },
  });
}

export async function createTestQueue(projectId: string, name = 'Test Queue') {
  return prisma.queue.create({
    data: { projectId, name, slug: `test-queue-${Date.now()}`, concurrencyLimit: 5 },
  });
}

export async function createTestRetryPolicy() {
  return prisma.retryPolicy.create({
    data: {
      name: 'Test Policy',
      strategy: 'EXPONENTIAL',
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      multiplier: 2,
    },
  });
}
