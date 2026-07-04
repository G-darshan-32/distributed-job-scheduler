import { PrismaClient, Role, RetryStrategy } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Default retry policies
  const expBackoff = await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Exponential Backoff',
      strategy: RetryStrategy.EXPONENTIAL,
      maxAttempts: 5,
      baseDelayMs: 1000,
      maxDelayMs: 3600000,
      multiplier: 2.0,
    },
  });

  await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Linear Backoff',
      strategy: RetryStrategy.LINEAR,
      maxAttempts: 3,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      multiplier: 1.0,
    },
  });

  await prisma.retryPolicy.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      name: 'Fixed Delay',
      strategy: RetryStrategy.FIXED,
      maxAttempts: 3,
      baseDelayMs: 5000,
      maxDelayMs: 5000,
      multiplier: 1.0,
    },
  });

  // Admin user
  const passwordHash = await bcrypt.hash('Admin@123', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'Admin User',
    },
  });

  // Demo org
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    update: {},
    create: {
      name: 'Demo Organization',
      slug: 'demo-org',
    },
  });

  await prisma.orgMembership.upsert({
    where: { userId_organizationId: { userId: adminUser.id, organizationId: org.id } },
    update: {},
    create: {
      userId: adminUser.id,
      organizationId: org.id,
      role: Role.OWNER,
    },
  });

  // Demo project
  const project = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'demo-project' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Demo Project',
      slug: 'demo-project',
      description: 'Default demo project',
    },
  });

  // Demo queues
  await prisma.queue.upsert({
    where: { projectId_slug: { projectId: project.id, slug: 'default' } },
    update: {},
    create: {
      projectId: project.id,
      retryPolicyId: expBackoff.id,
      name: 'Default',
      slug: 'default',
      description: 'Default queue',
      priority: 0,
      concurrencyLimit: 10,
    },
  });

  await prisma.queue.upsert({
    where: { projectId_slug: { projectId: project.id, slug: 'critical' } },
    update: {},
    create: {
      projectId: project.id,
      retryPolicyId: '00000000-0000-0000-0000-000000000003',
      name: 'Critical',
      slug: 'critical',
      description: 'High-priority critical jobs',
      priority: 100,
      concurrencyLimit: 5,
    },
  });

  console.log('Seed complete.');
  console.log('Admin credentials: admin@example.com / Admin@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
